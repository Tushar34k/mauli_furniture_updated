import io
import re
import csv
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field, EmailStr
from openpyxl import load_workbook
from core import db, uid, now, require, save_upload, get_settings, hash_pw, STAFF_ROLES
from routes_orders import adjust_stock, next_order_no, cancel_and_restock, FLOW, razorpay_refund, reserve_lines
from routes_store import discount_pct
from reports import invoice_pdf, build_report, to_xlsx, to_pdf
import notify

router = APIRouter(prefix="/api/admin")
ALL = require("owner", "manager", "staff")
MGR = require("owner", "manager")
OWN = require("owner")
ANY = require()


class Variant(BaseModel):
    type: str = "size"
    value: str
    price_delta: float = 0


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    name_mr: str = ""
    category: str
    brand: str = ""
    material: str = ""
    color: str = ""
    room: str = ""
    description: str = ""
    description_mr: str = ""
    images: List[str] = []
    video: str = ""
    variants: List[Variant] = []
    sku: str = ""
    barcode: str = ""
    purchase_price: float = Field(0, ge=0)
    price: float = Field(gt=0)
    mrp: float = Field(gt=0)
    gst: float = Field(18, ge=0, le=28)
    stock: int = Field(0, ge=0)
    reorder_level: int = Field(5, ge=0)
    supplier: str = ""
    location: str = ""
    dimensions: str = ""
    weight: str = ""
    specs: Dict[str, str] = {}
    warranty: str = ""
    assembly: str = "free_installation"
    delivery_days: int = Field(5, ge=0, le=60)
    is_deal: bool = False
    active: bool = True


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


async def unique_slug(name, pid=None):
    base = slugify(name) or uid()
    slug, n = base, 1
    while await db.products.find_one({"slug": slug, "id": {"$ne": pid}}):
        n += 1
        slug = f"{base}-{n}"
    return slug


# ---------- Dashboard ----------
@router.get("/dashboard")
async def dashboard(u=Depends(ALL)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    since = (datetime.now(timezone.utc) - timedelta(days=13)).strftime("%Y-%m-%d")
    orders = await db.orders.find({"created_at": {"$gte": since}, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(20000)
    days = {(datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d"): 0 for i in range(13, -1, -1)}
    cat_sales, top = {}, {}
    for o in orders:
        d = o["created_at"][:10]
        if d in days:
            days[d] += o["total"]
        for it in o["items"]:
            cat_sales[it.get("category", "other")] = cat_sales.get(it.get("category", "other"), 0) + it["price"] * it["qty"]
            top[it["name"]] = top.get(it["name"], 0) + it["qty"]
    tod = [o for o in orders if o["created_at"][:10] == today]
    low = await db.products.find({"$expr": {"$lte": ["$stock", "$reorder_level"]}}, {"_id": 0, "id": 1, "name": 1, "sku": 1, "stock": 1, "reorder_level": 1}).to_list(50)
    return {
        "today_sales": sum(o["total"] for o in tod), "today_orders": len(tod),
        "pending_orders": await db.orders.count_documents({"status": {"$in": ["placed", "confirmed", "packed"]}}),
        "new_customers": await db.users.count_documents({"role": "customer", "created_at": {"$gte": since}}),
        "total_products": await db.products.count_documents({}), "low_stock": low,
        "revenue_graph": [{"date": k[5:], "revenue": round(v)} for k, v in days.items()],
        "category_sales": [{"category": k, "sales": round(v)} for k, v in sorted(cat_sales.items(), key=lambda x: -x[1])],
        "top_products": [{"name": k, "qty": v} for k, v in sorted(top.items(), key=lambda x: -x[1])[:5]],
        "recent_orders": await db.orders.find({}, {"_id": 0, "id": 1, "order_no": 1, "total": 1, "status": 1, "created_at": 1, "address.name": 1, "channel": 1}).sort("created_at", -1).to_list(6),
        "new_enquiries": await db.enquiries.count_documents({"status": "new"}),
        "pending_reviews": await db.reviews.count_documents({"status": "pending"}),
    }


# ---------- Products / Inventory ----------
@router.get("/products")
async def list_products(q: str = "", category: str = "", stock: str = "", page: int = 1, limit: int = 20, u=Depends(ALL)):
    f = {}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        f["$or"] = [{"name": rx}, {"sku": rx}, {"barcode": rx}, {"name_mr": rx}]
    if category:
        f["category"] = category
    if stock == "low":
        f["$expr"] = {"$and": [{"$lte": ["$stock", "$reorder_level"]}, {"$gt": ["$stock", 0]}]}
    elif stock == "out":
        f["stock"] = {"$lte": 0}
    total = await db.products.count_documents(f)
    items = await db.products.find(f, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": items, "total": total, "pages": (total + limit - 1) // limit}


@router.get("/products/code/{code}")
async def by_code(code: str, u=Depends(ANY)):
    p = await db.products.find_one({"$or": [{"barcode": code}, {"sku": code}, {"id": code}]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "No product with this barcode/SKU")
    return p


@router.get("/products/{pid}")
async def get_product(pid: str, u=Depends(ALL)):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


@router.post("/products")
async def create_product(body: ProductIn, u=Depends(ALL)):
    d = body.model_dump()
    d.update({"id": uid(), "slug": await unique_slug(body.name), "rating": 0, "reviews_count": 0, "sold": 0, "created_at": now(),
              "sku": body.sku or f"MFM-{body.category[:3].upper()}-{uid()[:5].upper()}", "barcode": body.barcode or f"890{int(datetime.now().timestamp() * 1000) % 10**10}",
              "room": body.room or (await db.categories.find_one({"slug": body.category}) or {}).get("room", ""), "tags": [body.category, body.material.lower()]})
    if await db.products.find_one({"sku": d["sku"]}):
        raise HTTPException(400, "SKU already exists")
    await db.products.insert_one(dict(d))
    if d["stock"]:
        await db.stock_movements.insert_one({"id": uid(), "product_id": d["id"], "sku": d["sku"], "name": d["name"], "type": "in", "qty": d["stock"],
                                             "balance": d["stock"], "note": "Opening stock", "by": u["name"], "created_at": now()})
    d.pop("_id", None)
    return d


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, u=Depends(ALL)):
    old = await db.products.find_one({"id": pid}, {"_id": 0})
    if not old:
        raise HTTPException(404, "Not found")
    d = body.model_dump()
    stock_new = d.pop("stock")
    if old["name"] != body.name:
        d["slug"] = await unique_slug(body.name, pid)
    await db.products.update_one({"id": pid}, {"$set": d})
    if stock_new != old["stock"]:
        await adjust_stock(pid, stock_new - old["stock"], "adjust", "Edited in product form", u["name"])
    if body.price < old["price"]:
        async for a in db.price_alerts.find({"product_id": pid}):
            await notify.send(["inapp", "push"], "Price dropped!", f"{body.name} is now ₹{body.price:.0f} (was ₹{old['price']:.0f})", user_id=a["user_id"], event="price_drop")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.delete("/products/{pid}")
async def delete_product(pid: str, u=Depends(MGR)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


class BulkEdit(BaseModel):
    ids: List[str]
    price_change_pct: Optional[float] = None
    set: Dict[str, Any] = {}


@router.post("/products/bulk-edit")
async def bulk_edit(body: BulkEdit, u=Depends(MGR)):
    allowed = {k: v for k, v in body.set.items() if k in ("category", "gst", "active", "is_deal", "location", "supplier", "reorder_level", "brand", "delivery_days")}
    if allowed:
        await db.products.update_many({"id": {"$in": body.ids}}, {"$set": allowed})
    if body.price_change_pct:
        async for p in db.products.find({"id": {"$in": body.ids}}):
            await db.products.update_one({"id": p["id"]}, {"$set": {"price": round(p["price"] * (1 + body.price_change_pct / 100))}})
    return {"updated": len(body.ids)}


TEMPLATE_COLS = ["name", "name_mr", "category", "brand", "material", "color", "sku", "barcode", "purchase_price", "price", "mrp", "gst", "stock",
                 "reorder_level", "supplier", "location", "dimensions", "warranty", "assembly", "delivery_days", "images", "description"]


@router.get("/products-template")
async def template(u=Depends(ALL)):
    sample = ["Sample Teak Chair", "सागवान खुर्ची", "office", "Mauli Craft", "Solid Wood", "Brown", "MFM-OFF-9001", "", "3000", "4999", "6999", "18", "10",
              "3", "Local Supplier", "Showroom Floor 1", "W 50 x D 50 x H 90 cm", "1 Year", "free_installation", "3", "https://... | https://...", "Description"]
    return Response(",".join(TEMPLATE_COLS) + "\n" + ",".join(f'"{x}"' for x in sample) + "\n", media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="products-template.csv"'})


@router.post("/products/bulk-upload")
async def bulk_upload(file: UploadFile = File(...), u=Depends(MGR)):
    data = await file.read()
    if file.filename.lower().endswith((".xlsx", ".xlsm")):
        ws = load_workbook(io.BytesIO(data), read_only=True).active
        vals = list(ws.iter_rows(values_only=True))
        hdr = [str(h or "").strip() for h in vals[0]]
        rows = [dict(zip(hdr, r)) for r in vals[1:]]
    else:
        rows = list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
    created, updated, errors = 0, 0, []
    for i, r in enumerate(rows, start=2):
        r = {k: ("" if v is None else str(v).strip()) for k, v in r.items() if k}
        if not r.get("name"):
            continue
        try:
            body = ProductIn(**{k: r[k] for k in TEMPLATE_COLS if k in r and r[k] != "" and k != "images"},
                             images=[x.strip() for x in r.get("images", "").split("|") if x.strip()])
        except Exception as e:
            errors.append(f"Row {i}: {str(e)[:120]}")
            continue
        ex = await db.products.find_one({"sku": body.sku}) if body.sku else None
        if ex:
            d = body.model_dump()
            if not d["images"]:
                d.pop("images")
            await db.products.update_one({"id": ex["id"]}, {"$set": {k: v for k, v in d.items() if k != "stock"}})
            if body.stock != ex["stock"]:
                await adjust_stock(ex["id"], body.stock - ex["stock"], "adjust", "Bulk upload", u["name"])
            updated += 1
        else:
            await create_product(body, u)
            created += 1
    return {"created": created, "updated": updated, "errors": errors}


class StockAdjust(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=100000)
    type: str = Field(pattern=r"^(in|out|damage|return)$")
    note: str = ""


@router.post("/stock/adjust")
async def stock_adjust(body: StockAdjust, u=Depends(ALL)):
    delta = body.qty if body.type in ("in", "return") else -body.qty
    p = await db.products.find_one({"id": body.product_id})
    if not p:
        raise HTTPException(404, "Not found")
    if p["stock"] + delta < 0:
        raise HTTPException(400, "Stock cannot go below zero")
    p = await adjust_stock(body.product_id, delta, body.type, body.note, u["name"])
    if not p:
        raise HTTPException(400, "Stock cannot go below zero")
    return {"stock": p["stock"]}


@router.get("/stock/movements")
async def movements(product_id: str = "", page: int = 1, u=Depends(ALL)):
    f = {"product_id": product_id} if product_id else {}
    total = await db.stock_movements.count_documents(f)
    items = await db.stock_movements.find(f, {"_id": 0}).sort("created_at", -1).skip((page - 1) * 50).limit(50).to_list(50)
    return {"items": items, "total": total, "pages": (total + 49) // 50}


@router.get("/inventory/valuation")
async def valuation(u=Depends(MGR)):
    prods = await db.products.find({}, {"_id": 0, "category": 1, "stock": 1, "purchase_price": 1, "price": 1, "mrp": 1}).to_list(10000)
    cats = {}
    for p in prods:
        c = cats.setdefault(p["category"], {"category": p["category"], "items": 0, "units": 0, "cost_value": 0, "sale_value": 0, "mrp_value": 0})
        st = max(p["stock"], 0)
        c["items"] += 1
        c["units"] += st
        c["cost_value"] += st * p.get("purchase_price", 0)
        c["sale_value"] += st * p["price"]
        c["mrp_value"] += st * p["mrp"]
    rows = list(cats.values())
    return {"rows": rows, "total": {k: sum(r[k] for r in rows) for k in ("items", "units", "cost_value", "sale_value", "mrp_value")}}


# ---------- Orders ----------
@router.get("/orders")
async def admin_orders(status: str = "", q: str = "", channel: str = "", page: int = 1, u=Depends(ANY)):
    f = {}
    if u["role"] == "delivery":
        f["assigned_to"] = u["id"]
    if status:
        f["status"] = status
    if channel:
        f["channel"] = channel
    if status == "returns":
        f.pop("status")
        f["return_request"] = {"$ne": None}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        f["$or"] = [{"order_no": rx}, {"address.name": rx}, {"address.phone": rx}]
    total = await db.orders.count_documents(f)
    items = await db.orders.find(f, {"_id": 0}).sort("created_at", -1).skip((page - 1) * 20).limit(20).to_list(20)
    return {"items": items, "total": total, "pages": (total + 19) // 20}


async def _order(oid, u):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o or (u["role"] == "delivery" and o.get("assigned_to") != u["id"]):
        raise HTTPException(404, "Order not found")
    return o


@router.get("/orders/{oid}")
async def admin_order(oid: str, u=Depends(ANY)):
    return await _order(oid, u)


class StatusIn(BaseModel):
    status: str
    note: str = ""


@router.put("/orders/{oid}/status")
async def set_status(oid: str, body: StatusIn, u=Depends(ANY)):
    o = await _order(oid, u)
    if body.status not in FLOW + ["cancelled"]:
        raise HTTPException(400, "Invalid status")
    if u["role"] == "delivery" and body.status not in ("out_for_delivery", "delivered"):
        raise HTTPException(403, "Delivery staff can only mark out for delivery / delivered")
    if o["status"] in ("cancelled", "delivered"):
        raise HTTPException(400, f"Order is already {o['status']}; use returns for delivered orders")
    if body.status != "cancelled" and FLOW.index(body.status) <= FLOW.index(o["status"]):
        raise HTTPException(400, "Status can only move forward")
    if body.status == "cancelled":
        await cancel_and_restock(o, body.note or "Cancelled by store", u["name"])
        return {"ok": True}
    upd = {"status": body.status}
    if body.status == "delivered" and o["payment_method"] in ("cod", "store"):
        upd["payment_status"] = "paid"
    await db.orders.update_one({"id": oid}, {"$set": upd, "$push": {"timeline": {"status": body.status, "at": now(), "note": body.note, "by": u["name"]}}})
    await notify.order_update(o, body.status)
    return {"ok": True}


class OrderPatch(BaseModel):
    assigned_to: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)
    payment_status: Optional[str] = Field(None, pattern=r"^(pending|paid|refund_pending|refunded)$")


@router.put("/orders/{oid}")
async def patch_order(oid: str, body: OrderPatch, u=Depends(ALL)):
    await _order(oid, u)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "payment_status" in upd and u["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner/Manager can change payment status")
    await db.orders.update_one({"id": oid}, {"$set": upd})
    return await db.orders.find_one({"id": oid}, {"_id": 0})


@router.post("/orders/{oid}/return/{action}")
async def handle_return(oid: str, action: str, u=Depends(MGR)):
    o = await _order(oid, u)
    rr = o.get("return_request") or {}
    allowed = {"requested": ("approved", "rejected"), "approved": ("refunded",) if rr.get("type") == "return" else ("replaced",)}
    if not rr or action not in allowed.get(rr.get("status"), ()):
        raise HTTPException(400, f"Cannot mark '{action}' from '{rr.get('status')}'")
    rr["status"] = action
    upd = {"return_request": rr}
    if action == "approved" and rr.get("type") == "return":
        for it in o["items"]:
            await adjust_stock(it["product_id"], it["qty"], "return", f"Return {o['order_no']}", u["name"], o["order_no"])
    if action == "refunded":
        if o["payment_method"] == "razorpay" and o["payment_status"] == "paid":
            upd["refund_id"] = await razorpay_refund(o)
        upd["payment_status"] = "refunded"
    await db.orders.update_one({"id": oid}, {"$set": upd})
    await notify.send(["inapp", "sms"], f"Return {action}", f"Your {rr.get('type')} request for {o['order_no']} is {action}.", user_id=o.get("user_id"), phone=o["address"].get("phone"))
    return {"ok": True}


@router.post("/orders/{oid}/refund")
async def refund_order(oid: str, u=Depends(MGR)):
    o = await _order(oid, u)
    if o["payment_status"] not in ("paid", "refund_pending") or o["status"] != "cancelled":
        raise HTTPException(400, "Only cancelled, paid orders can be refunded here (use Returns for delivered orders)")
    upd = {"payment_status": "refunded"}
    if o["payment_method"] == "razorpay":
        upd["refund_id"] = await razorpay_refund(o)
    await db.orders.update_one({"id": oid}, {"$set": upd})
    await notify.send(["inapp", "sms", "email"], "Refund processed", f"Refund of Rs.{o['total']:.0f} for {o['order_no']} has been processed.",
                      user_id=o.get("user_id"), phone=o["address"].get("phone"), email=o["address"].get("email"))
    return {"ok": True}


@router.get("/integrations")
async def integrations_status(u=Depends(MGR)):
    import integrations as ig
    from core import razorpay_keys
    s = await get_settings()
    return ig.status(s, bool(razorpay_keys(s)[0]))


@router.get("/export/{col}")
async def export(col: str, u=Depends(OWN)):
    from openpyxl import Workbook
    q = {"products": ({}, "products"), "orders": ({}, "orders"), "customers": ({"role": "customer", "deleted": {"$ne": True}}, "users"),
         "stock_movements": ({}, "stock_movements"), "enquiries": ({}, "enquiries")}.get(col)
    if not q:
        raise HTTPException(404, "Unknown export")
    docs = await db[q[1]].find(q[0], {"_id": 0, "password_hash": 0}).to_list(100000)
    wb = Workbook()
    ws = wb.active
    keys = sorted({k for d in docs for k in d})
    ws.append(keys)
    for d in docs:
        ws.append([v if isinstance(v, (int, float, str, bool)) or v is None else str(v) for v in (d.get(k) for k in keys)])
    buf = io.BytesIO()
    wb.save(buf)
    return Response(buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{col}.xlsx"'})


@router.get("/orders/{oid}/{doc}")
async def order_doc(oid: str, doc: str, u=Depends(ANY)):
    o = await _order(oid, u)
    pdf = invoice_pdf(o, await get_settings(), packing=doc == "packing-slip")
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{doc}-{o["order_no"]}.pdf"'})


# ---------- POS ----------
class PosItem(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=100)
    price: Optional[float] = None


class PosSale(BaseModel):
    items: List[PosItem]
    customer_name: str = "Walk-in Customer"
    phone: str = ""
    payment_mode: str = Field(pattern=r"^(cash|upi|card)$")
    discount: float = Field(0, ge=0)


@router.post("/pos/sale")
async def pos_sale(body: PosSale, u=Depends(ALL)):
    if not body.items:
        raise HTTPException(400, "No items")
    s = await get_settings()
    lines = []
    for it in body.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(404, "Product not found")
        if p["stock"] < it.qty:
            raise HTTPException(400, f"Only {p['stock']} in stock for {p['name']}")
        price = it.price if it.price and u["role"] in ("owner", "manager") else p["price"]
        lines.append({"product_id": p["id"], "name": p["name"], "image": (p["images"] or [""])[0], "sku": p["sku"], "price": price, "mrp": p["mrp"],
                      "purchase_price": p.get("purchase_price", 0), "qty": it.qty, "gst": p["gst"], "category": p["category"], "variant": ""})
    sub = sum(l["price"] * l["qty"] for l in lines)
    disc = min(body.discount, sub)
    ratio = (sub - disc) / sub
    customer = None
    if re.fullmatch(r"[6-9]\d{9}", body.phone or ""):
        customer = await db.users.find_one({"phone": body.phone, "role": "customer"}, {"_id": 0, "id": 1})
    order = {"id": uid(), "order_no": await next_order_no(s.get("invoice_prefix", "MFM")), "user_id": (customer or {}).get("id"), "channel": "pos", "items": lines,
             "address": {"name": body.customer_name, "phone": body.phone, "line1": "Showroom sale", "city": "Pune", "state": "Maharashtra", "pincode": ""},
             "slot": "", "subtotal": sub, "mrp_total": sum(l["mrp"] * l["qty"] for l in lines), "discount": disc, "coupon": "",
             "gst_total": round(sum(l["price"] * l["qty"] * ratio * l["gst"] / (100 + l["gst"]) for l in lines), 2), "delivery": 0, "total": round(sub - disc, 2),
             "payment_method": body.payment_mode, "payment_status": "paid", "status": "delivered", "assigned_to": "", "notes": f"POS by {u['name']}",
             "timeline": [{"status": "delivered", "at": now(), "note": "Showroom sale"}], "return_request": None, "created_at": now()}
    await reserve_lines(lines, "POS sale", u["name"], order["order_no"])
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    return order


# ---------- Customers ----------
@router.get("/customers")
async def customers(q: str = "", page: int = 1, u=Depends(ALL)):
    f = {"role": "customer", "deleted": {"$ne": True}}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        f["$or"] = [{"name": rx}, {"phone": rx}, {"email": rx}]
    total = await db.users.count_documents(f)
    users = await db.users.find(f, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip((page - 1) * 20).limit(20).to_list(20)
    for c in users:
        os_ = await db.orders.find({"user_id": c["id"]}, {"total": 1, "status": 1}).to_list(500)
        c["orders"] = len(os_)
        c["spent"] = sum(o["total"] for o in os_ if o["status"] != "cancelled")
    return {"items": users, "total": total, "pages": (total + 19) // 20}


@router.get("/customers/{cid}")
async def customer(cid: str, u=Depends(ALL)):
    c = await db.users.find_one({"id": cid, "role": "customer"}, {"_id": 0, "password_hash": 0})
    if not c:
        raise HTTPException(404, "Not found")
    c["order_list"] = await db.orders.find({"user_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return c


@router.put("/customers/{cid}/notes")
async def customer_notes(cid: str, body: dict, u=Depends(ALL)):
    await db.users.update_one({"id": cid}, {"$set": {"admin_notes": str(body.get("notes", ""))[:2000]}})
    return {"ok": True}


# ---------- Generic CRUD ----------
CRUD = {
    "categories": ["slug", "name", "name_mr", "icon", "image", "room", "sort", "active"],
    "brands": ["name", "active"],
    "banners": ["title", "title_mr", "subtitle", "subtitle_mr", "image", "link", "sort", "active"],
    "coupons": ["code", "type", "value", "max_discount", "min_order", "description", "active", "public"],
    "pincodes": ["pincode", "city", "charge", "days", "cod", "active"],
    "slots": ["label", "label_mr", "sort", "active"],
    "blogs": ["slug", "title", "title_mr", "image", "content", "active"],
    "pages": ["slug", "title", "title_mr", "content", "active"],
}
NUMERIC = {"sort", "value", "max_discount", "min_order", "charge", "days"}


def clean_doc(col, body):
    if col not in CRUD:
        raise HTTPException(404, "Unknown collection")
    d = {}
    for k in CRUD[col]:
        if k in body:
            v = body[k]
            d[k] = float(v or 0) if k in NUMERIC else (bool(v) if k in ("active", "public", "cod") else str(v)[:5000])
    if col == "coupons" and "code" in d:
        d["code"] = d["code"].upper().strip()
    return d


@router.get("/c/{col}")
async def crud_list(col: str, u=Depends(ALL)):
    clean_doc(col, {})
    return await db[col].find({}, {"_id": 0}).to_list(2000)


@router.post("/c/{col}")
async def crud_create(col: str, body: dict, u=Depends(MGR)):
    d = {"id": uid(), "created_at": now(), **clean_doc(col, body)}
    if col == "categories" and not d.get("slug"):
        d["slug"] = slugify(d.get("name", "")) or uid()
    await db[col].insert_one(dict(d))
    return d


@router.put("/c/{col}/{did}")
async def crud_update(col: str, did: str, body: dict, u=Depends(MGR)):
    d = clean_doc(col, body)
    if col == "categories" and not d.get("slug"):
        d["slug"] = slugify(d.get("name", "")) or uid()
    await db[col].update_one({"id": did}, {"$set": d})
    return await db[col].find_one({"id": did}, {"_id": 0})


@router.delete("/c/{col}/{did}")
async def crud_delete(col: str, did: str, u=Depends(MGR)):
    clean_doc(col, {})
    await db[col].delete_one({"id": did})
    return {"ok": True}


# ---------- Moderation / Enquiries / Notifications ----------
@router.get("/reviews")
async def reviews(status: str = "", u=Depends(ALL)):
    return await db.reviews.find({"status": status} if status else {}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/reviews/{rid}")
async def moderate(rid: str, body: dict, u=Depends(ALL)):
    st = body.get("status")
    if st not in ("approved", "rejected", "pending"):
        raise HTTPException(400, "Invalid status")
    await db.reviews.update_one({"id": rid}, {"$set": {"status": st}})
    r = await db.reviews.find_one({"id": rid})
    if r:
        rs = await db.reviews.find({"product_id": r["product_id"], "status": "approved"}).to_list(1000)
        if rs:
            await db.products.update_one({"id": r["product_id"]}, {"$set": {"rating": round(sum(x["rating"] for x in rs) / len(rs), 1), "reviews_count": len(rs)}})
    return {"ok": True}


@router.delete("/reviews/{rid}")
async def del_review(rid: str, u=Depends(MGR)):
    await db.reviews.delete_one({"id": rid})
    return {"ok": True}


@router.get("/questions")
async def questions(u=Depends(ALL)):
    return await db.questions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/questions/{qid}")
async def answer(qid: str, body: dict, u=Depends(ALL)):
    await db.questions.update_one({"id": qid}, {"$set": {"answer": str(body.get("answer", ""))[:1000], "status": "answered" if body.get("answer") else "pending"}})
    return {"ok": True}


@router.get("/enquiries")
async def enquiries(u=Depends(ALL)):
    return await db.enquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/enquiries/{eid}")
async def upd_enquiry(eid: str, body: dict, u=Depends(ALL)):
    await db.enquiries.update_one({"id": eid}, {"$set": {k: str(body[k])[:2000] for k in ("status", "notes") if k in body}})
    return {"ok": True}


class Broadcast(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    message: str = Field(min_length=2, max_length=500)
    channels: List[str] = ["inapp", "push"]


@router.post("/broadcast")
async def broadcast(body: Broadcast, u=Depends(MGR)):
    n = 0
    async for c in db.users.find({"role": "customer", "deleted": {"$ne": True}}, {"_id": 0}):
        await notify.send([ch for ch in body.channels if ch in ("inapp", "push", "sms", "whatsapp", "email")], body.title, body.message,
                          user_id=c["id"], phone=c.get("phone"), email=c.get("email"), event="broadcast")
        n += 1
    return {"sent_to": n}


@router.get("/notification-logs")
async def notif_logs(u=Depends(MGR)):
    return await db.notification_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)


@router.get("/error-logs")
async def error_logs(u=Depends(OWN)):
    return await db.error_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- Settings / Staff / Upload / Reports ----------
@router.get("/settings")
async def get_set(u=Depends(MGR)):
    s = await get_settings()
    if u["role"] != "owner":
        s.pop("razorpay_key_secret", None)
    elif s.get("razorpay_key_secret"):
        s["razorpay_key_secret"] = "********"
    return s


@router.put("/settings")
async def put_set(body: dict, u=Depends(OWN)):
    body.pop("_id", None)
    body.pop("id", None)
    if body.get("razorpay_key_secret") == "********":
        body.pop("razorpay_key_secret")
    await db.settings.update_one({"id": "shop"}, {"$set": body})
    return await get_set(u)


class StaffIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = ""
    role: str
    password: Optional[str] = Field(None, min_length=8)
    active: bool = True


@router.get("/staff")
async def staff(u=Depends(ALL)):
    f = {"role": {"$in": STAFF_ROLES}}
    if u["role"] != "owner":
        f = {"role": "delivery"}
    return await db.users.find(f, {"_id": 0, "password_hash": 0}).to_list(200)


@router.post("/staff")
async def add_staff(body: StaffIn, u=Depends(OWN)):
    if body.role not in STAFF_ROLES or not body.password:
        raise HTTPException(400, "Valid role and password (min 8 chars) required")
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already exists")
    d = {"id": uid(), "name": body.name, "email": body.email.lower(), "phone": body.phone, "role": body.role, "active": body.active,
         "password_hash": hash_pw(body.password), "must_change_password": True, "created_at": now()}
    await db.users.insert_one(d)
    return {"ok": True}


@router.put("/staff/{sid}")
async def edit_staff(sid: str, body: StaffIn, u=Depends(OWN)):
    upd = {"name": body.name, "phone": body.phone, "role": body.role, "active": body.active}
    if body.role not in STAFF_ROLES:
        raise HTTPException(400, "Invalid role")
    if body.password:
        upd["password_hash"] = hash_pw(body.password)
        upd["must_change_password"] = sid != u["id"]
    await db.users.update_one({"id": sid, "role": {"$in": STAFF_ROLES}}, {"$set": upd})
    return {"ok": True}


@router.post("/upload")
async def admin_upload(files: List[UploadFile] = File(...), u=Depends(ALL)):
    return {"urls": [await save_upload(f, "products") for f in files]}


@router.get("/reports/{kind}")
async def report(kind: str, start: str = "", end: str = "", fmt: str = "json", u=Depends(MGR)):
    rep = await build_report(kind, start or None, end or None)
    if not rep:
        raise HTTPException(404, "Unknown report")
    if fmt == "xlsx":
        return Response(to_xlsx(rep), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="{kind}-report.xlsx"'})
    if fmt == "pdf":
        return Response(to_pdf(rep, await get_settings()), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{kind}-report.pdf"'})
    return rep
