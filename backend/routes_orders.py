import hmac
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from pymongo import ReturnDocument
from core import db, uid, now, get_user, optional_user, get_settings, razorpay_keys, rate_limit, client_ip
from routes_store import pincode_info
from routes_account import Address
import notify

router = APIRouter(prefix="/api")
FLOW = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"]


class CartItem(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=50)
    variant: Optional[str] = ""


class CartIn(BaseModel):
    items: List[CartItem]
    coupon: Optional[str] = ""
    pincode: Optional[str] = ""
    payment_method: Optional[str] = ""


class CheckoutIn(CartIn):
    address: Address
    email: Optional[str] = ""
    slot: Optional[str] = ""
    delivery_date: Optional[str] = ""
    payment_method: str = Field(pattern=r"^(razorpay|cod|store)$")


class PayVerify(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class ReturnIn(BaseModel):
    type: str = Field(pattern=r"^(return|replace)$")
    reason: str = Field(min_length=3, max_length=500)


async def next_order_no(prefix="MFM"):
    c = await db.counters.find_one_and_update({"id": "order"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"{prefix}{25000 + c['seq']}"


async def adjust_stock(pid, delta, mtype, note, by, ref=""):
    q = {"id": pid, "stock": {"$gte": -delta}} if mtype == "sale" else {"id": pid}
    p = await db.products.find_one_and_update(q, {"$inc": {"stock": delta, "sold": -delta if mtype == "sale" else 0}},
                                              return_document=ReturnDocument.AFTER)
    if p:
        await db.stock_movements.insert_one({"id": uid(), "product_id": pid, "sku": p["sku"], "name": p["name"], "type": mtype, "qty": delta,
                                             "balance": p["stock"], "note": note, "ref": ref, "by": by, "created_at": now()})
    return p


async def price_cart(body: CartIn, strict=False):
    s = await get_settings()
    lines, warnings = [], []
    for it in body.items:
        p = await db.products.find_one({"id": it.product_id, "active": True}, {"_id": 0})
        if not p:
            warnings.append(f"Product unavailable: {it.product_id}")
            continue
        delta = next((v["price_delta"] for v in p.get("variants", []) if v["value"] == it.variant), 0)
        qty = it.qty
        if p["stock"] < qty:
            if strict:
                raise HTTPException(400, f"Only {p['stock']} left for {p['name']}")
            warnings.append(f"Only {p['stock']} left for {p['name']}")
        price = p["price"] + delta
        lines.append({"product_id": p["id"], "slug": p["slug"], "name": p["name"], "name_mr": p.get("name_mr", ""), "image": p["images"][0] if p["images"] else "",
                      "sku": p["sku"], "price": price, "mrp": p["mrp"] + delta, "purchase_price": p.get("purchase_price", 0), "qty": qty, "gst": p["gst"],
                      "category": p["category"], "variant": it.variant or "", "stock": p["stock"], "line_total": price * qty, "delivery_days": p.get("delivery_days", 5)})
    subtotal = sum(l["line_total"] for l in lines)
    mrp_total = sum(l["mrp"] * l["qty"] for l in lines)
    discount, coupon_msg, free_ship, code = 0, "", False, (body.coupon or "").strip().upper()
    if code:
        c = await db.coupons.find_one({"code": code, "active": True}, {"_id": 0})
        if not c:
            coupon_msg = "Invalid coupon"
        elif subtotal < c.get("min_order", 0):
            coupon_msg = f"Minimum order ₹{c['min_order']} required"
        elif c["type"] == "shipping":
            free_ship, coupon_msg = True, "Free delivery applied"
        else:
            discount = subtotal * c["value"] / 100 if c["type"] == "percent" else c["value"]
            discount = round(min(discount, c.get("max_discount") or discount, subtotal), 2)
            coupon_msg = f"You saved ₹{discount:.0f}"
        if coupon_msg and not (free_ship or discount):
            code = ""
    delivery, eta, serviceable = 0, None, True
    if body.pincode:
        info = await pincode_info(body.pincode)
        serviceable = info["serviceable"]
        if serviceable:
            delivery = info["charge"]
            eta = max([info["days"]] + [l["delivery_days"] for l in lines]) if lines else info["days"]
    if serviceable and (subtotal >= s.get("free_delivery_above", 10000) or free_ship) or body.payment_method == "store":
        delivery = 0
    ratio = (subtotal - discount) / subtotal if subtotal else 1
    gst_total = round(sum(l["line_total"] * ratio * l["gst"] / (100 + l["gst"]) for l in lines), 2)
    return {"lines": lines, "subtotal": subtotal, "mrp_total": mrp_total, "discount": discount, "coupon": code, "coupon_msg": coupon_msg,
            "gst_total": gst_total, "delivery": delivery, "total": round(subtotal - discount + delivery, 2), "eta_days": eta,
            "serviceable": serviceable, "warnings": warnings}


@router.post("/cart/price")
async def cart_price(body: CartIn):
    return await price_cart(body)


@router.post("/orders")
async def create_order(body: CheckoutIn, request: Request):
    rate_limit(f"order:{client_ip(request)}", 20)
    user = await optional_user(request)
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    pr = await price_cart(body, strict=True)
    if not pr["serviceable"] and body.payment_method != "store":
        raise HTTPException(400, "Delivery not available for this pincode. Choose Pay at Store / Pick up.")
    s = await get_settings()
    if body.payment_method == "cod" and pr["total"] > s.get("cod_limit", 100000):
        raise HTTPException(400, "COD not available for this order value")
    if body.payment_method == "cod" and not (await pincode_info(body.address.pincode)).get("cod", False):
        raise HTTPException(400, "COD not available for this pincode")
    order = {
        "id": uid(), "order_no": await next_order_no(s.get("invoice_prefix", "MFM")), "user_id": (user or {}).get("id"), "channel": "online",
        "items": [{k: v for k, v in l.items() if k not in ("stock", "line_total", "delivery_days")} for l in pr["lines"]],
        "address": {**body.address.model_dump(), "email": body.email or (user or {}).get("email", "")}, "slot": body.slot, "delivery_date": body.delivery_date,
        **{k: pr[k] for k in ("subtotal", "mrp_total", "discount", "coupon", "gst_total", "delivery", "total")},
        "payment_method": body.payment_method, "payment_status": "pending", "status": "placed",
        "timeline": [{"status": "placed", "at": now(), "note": ""}], "assigned_to": "", "notes": "", "return_request": None, "created_at": now(),
    }
    done = []
    for l in pr["lines"]:
        if not await adjust_stock(l["product_id"], -l["qty"], "sale", "Online order", "customer", order["order_no"]):
            for d in done:
                await adjust_stock(d["product_id"], d["qty"], "return", "Rollback", "system", order["order_no"])
            raise HTTPException(400, f"{l['name']} just went out of stock")
        done.append(l)
    payment = None
    if body.payment_method == "razorpay":
        kid, sec = razorpay_keys(s)
        if not kid:
            raise HTTPException(400, "Online payment is not available right now. Choose COD or Pay at Store.")
        order["razorpay_order_id"], payment = await rzp_order(order, kid, sec)
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    if body.payment_method != "razorpay":
        await notify.order_update(order, "placed")
    return {"order": order, "payment": payment}


async def rzp_order(order, kid, sec):
    import razorpay
    try:
        rz = razorpay.Client(auth=(kid, sec)).order.create({"amount": int(round(order["total"] * 100)), "currency": "INR", "receipt": order["order_no"], "payment_capture": 1})
    except Exception as e:
        raise HTTPException(502, f"Payment gateway error: {str(e)[:120]}")
    return rz["id"], {"mode": "razorpay", "key_id": kid, "rzp_order_id": rz["id"], "amount": rz["amount"]}


async def mark_paid(order, ref):
    res = await db.orders.update_one({"id": order["id"], "payment_status": {"$ne": "paid"}}, {"$set": {"payment_status": "paid", "payment_ref": ref, "status": "confirmed"},
                                     "$push": {"timeline": {"status": "confirmed", "at": now(), "note": "Payment received"}}})
    if res.modified_count:
        await notify.order_update(order, "confirmed")


async def razorpay_refund(o):
    import razorpay
    kid, sec = razorpay_keys(await get_settings())
    if not kid or not o.get("payment_ref"):
        raise HTTPException(400, "Razorpay not configured or no payment reference")
    try:
        r = razorpay.Client(auth=(kid, sec)).payment.refund(o["payment_ref"], {"amount": int(round(o["total"] * 100))})
    except Exception as e:
        raise HTTPException(502, f"Refund failed: {str(e)[:150]}")
    return r.get("id")


@router.post("/orders/{oid}/pay/retry")
async def retry_payment(oid: str, request: Request, phone: Optional[str] = None):
    o = await load_order(oid, request, phone)
    kid, sec = razorpay_keys(await get_settings())
    if not kid or o["payment_method"] != "razorpay" or o["payment_status"] == "paid" or o["status"] == "cancelled":
        raise HTTPException(400, "Payment retry not available")
    rid, payment = await rzp_order(o, kid, sec)
    await db.orders.update_one({"id": o["id"]}, {"$set": {"razorpay_order_id": rid}})
    return {"order": o, "payment": payment}


@router.post("/payments/razorpay/webhook")
async def rzp_webhook(request: Request):
    import os
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    raw = await request.body()
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not secret or not hmac.compare_digest(sig, request.headers.get("X-Razorpay-Signature", "")):
        raise HTTPException(400, "Invalid signature")
    ev = (await request.json())
    ent = ev.get("payload", {}).get("payment", {}).get("entity", {})
    o = await db.orders.find_one({"razorpay_order_id": ent.get("order_id")}, {"_id": 0}) if ent else None
    if o and ev.get("event") in ("payment.captured", "order.paid"):
        await mark_paid(o, ent.get("id"))
    elif o and ev.get("event") == "payment.failed":
        await db.orders.update_one({"id": o["id"], "payment_status": "pending"}, {"$set": {"payment_status": "failed"}})
    elif ev.get("event") == "refund.processed":
        pid = ev.get("payload", {}).get("refund", {}).get("entity", {}).get("payment_id")
        await db.orders.update_one({"payment_ref": pid}, {"$set": {"payment_status": "refunded"}})
    return {"ok": True}


@router.post("/orders/{oid}/pay/verify")
async def verify_payment(oid: str, body: PayVerify):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o or o.get("razorpay_order_id") != body.razorpay_order_id:
        raise HTTPException(404, "Order not found")
    _, sec = razorpay_keys(await get_settings())
    if not sec:
        raise HTTPException(400, "Payments not configured")
    sig = hmac.new(sec.encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, body.razorpay_signature):
        raise HTTPException(400, "Payment verification failed")
    await mark_paid(o, body.razorpay_payment_id)
    return {"ok": True}


async def load_order(oid, request, phone=None):
    o = await db.orders.find_one({"$or": [{"id": oid}, {"order_no": oid}]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    u = await optional_user(request)
    ok = (u and (u["id"] == o.get("user_id") or u["role"] in ("owner", "manager", "staff", "delivery"))) or (phone and phone == o["address"].get("phone"))
    if not ok:
        raise HTTPException(403, "Not allowed")
    return o


@router.get("/orders")
async def my_orders(user=Depends(get_user)):
    return await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.get("/orders/{oid}")
async def order_detail(oid: str, request: Request, phone: Optional[str] = None):
    return await load_order(oid, request, phone)


@router.post("/orders/{oid}/cancel")
async def cancel_order(oid: str, request: Request, phone: Optional[str] = None):
    o = await load_order(oid, request, phone)
    if o["status"] not in ("placed", "confirmed", "packed"):
        raise HTTPException(400, "Order can no longer be cancelled")
    await cancel_and_restock(o, "Cancelled by customer", "customer")
    return {"ok": True}


async def cancel_and_restock(o, note, by):
    for it in o["items"]:
        await adjust_stock(it["product_id"], it["qty"], "return", f"Cancel {o['order_no']}", by, o["order_no"])
    upd = {"status": "cancelled"}
    if o["payment_status"] == "paid":
        upd["payment_status"] = "refund_pending"
    await db.orders.update_one({"id": o["id"]}, {"$set": upd, "$push": {"timeline": {"status": "cancelled", "at": now(), "note": note}}})
    await notify.order_update(o, "cancelled")


@router.post("/orders/{oid}/return")
async def request_return(oid: str, body: ReturnIn, request: Request):
    o = await load_order(oid, request)
    if o["status"] != "delivered":
        raise HTTPException(400, "Only delivered orders can be returned")
    await db.orders.update_one({"id": o["id"]}, {"$set": {"return_request": {**body.model_dump(), "status": "requested", "at": now()}}})
    return {"ok": True}


@router.get("/orders/{oid}/invoice")
async def invoice(oid: str, request: Request, phone: Optional[str] = None):
    from reports import invoice_pdf
    o = await load_order(oid, request, phone)
    pdf = invoice_pdf(o, await get_settings())
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="Invoice-{o["order_no"]}.pdf"'})
