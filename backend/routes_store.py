import re
import os
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from rapidfuzz import fuzz
from core import db, get_settings, rate_limit, client_ip, now, uid, razorpay_keys

router = APIRouter(prefix="/api")
PUB = {"_id": 0, "purchase_price": 0, "supplier": 0}
SECRET_KEYS = ("razorpay_key_secret",)


def discount_pct(p):
    return round((p["mrp"] - p["price"]) * 100 / p["mrp"]) if p.get("mrp") else 0


def card(p):
    keys = ("id", "slug", "name", "name_mr", "category", "brand", "price", "mrp", "rating", "reviews_count", "stock", "images", "delivery_days", "material", "color", "is_deal", "assembly")
    d = {k: p.get(k) for k in keys}
    d["images"] = (p.get("images") or [])[:2]
    d["discount"] = discount_pct(p)
    return d


async def pincode_info(pin: str):
    s = await get_settings()
    rec = await db.pincodes.find_one({"pincode": pin, "active": True}, {"_id": 0})
    if rec:
        return {"serviceable": True, "city": rec["city"], "charge": rec["charge"], "days": rec["days"], "cod": rec.get("cod", True)}
    if re.fullmatch(r"4[0-4]\d{4}", pin):
        return {"serviceable": True, "city": "Maharashtra", "charge": s.get("default_delivery_charge", 499), "days": 7, "cod": True}
    return {"serviceable": False}


@router.get("/settings/public")
async def public_settings():
    s = await get_settings()
    import integrations as ig
    s["razorpay_enabled"] = bool(razorpay_keys(s)[0])
    s["sms_enabled"] = bool(ig.sms_provider())
    s["upload_enabled"] = bool(ig.storage_provider())
    for k in SECRET_KEYS + ("razorpay_key_id",):
        s.pop(k, None)
    return s


@router.get("/categories")
async def categories():
    cats = await db.categories.find({"active": True}, {"_id": 0}).sort("sort", 1).to_list(100)
    for c in cats:
        c["count"] = await db.products.count_documents({"category": c["slug"], "active": True})
    return cats


@router.get("/brands")
async def brands():
    return await db.brands.find({"active": True}, {"_id": 0}).to_list(200)


@router.get("/home")
async def home():
    s = await get_settings()
    q = {"active": True}
    hrs = s.get("deal_hours", 24)
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    ends = start + timedelta(hours=hrs)
    while ends < datetime.now(timezone.utc):
        ends += timedelta(hours=hrs)
    return {
        "banners": await db.banners.find({"active": True}, {"_id": 0}).sort("sort", 1).to_list(20),
        "deals": [card(p) for p in await db.products.find({**q, "is_deal": True}, PUB).to_list(12)],
        "deal_ends_at": ends.isoformat(),
        "new_arrivals": [card(p) for p in await db.products.find(q, PUB).sort("created_at", -1).to_list(10)],
        "best_sellers": [card(p) for p in await db.products.find(q, PUB).sort("sold", -1).to_list(10)],
        "reviews": await db.reviews.find({"status": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(8),
        "blogs": await db.blogs.find({"active": True}, {"_id": 0, "content": 0}).to_list(3),
        "sections": s.get("home_sections", []),
    }


def build_query(a: dict):
    q = {"active": True}
    if a.get("category"):
        q["category"] = {"$in": a["category"].split(",")}
    if a.get("room"):
        q["room"] = a["room"]
    for f in ("material", "color", "brand"):
        if a.get(f):
            q[f] = {"$in": a[f].split(",")}
    pr = {}
    if a.get("min_price"):
        pr["$gte"] = float(a["min_price"])
    if a.get("max_price"):
        pr["$lte"] = float(a["max_price"])
    if pr:
        q["price"] = pr
    if a.get("rating"):
        q["rating"] = {"$gte": float(a["rating"])}
    if a.get("in_stock") == "1":
        q["stock"] = {"$gt": 0}
    if a.get("delivery_days"):
        q["delivery_days"] = {"$lte": int(a["delivery_days"])}
    if a.get("deal") == "1":
        q["is_deal"] = True
    if a.get("ids"):
        q["id"] = {"$in": a["ids"].split(",")}
    return q


def fuzzy_score(p, term):
    hay = f"{p['name']} {p.get('name_mr', '')} {p['category']} {p.get('brand', '')} {p.get('material', '')} {p.get('color', '')}".lower()
    words = term.lower().split()
    return min(max(fuzz.partial_ratio(w, hay), 100 if w in hay else 0) for w in words) if words else 100


SORTS = {"price_asc": ("price", 1), "price_desc": ("price", -1), "newest": ("created_at", -1), "popularity": ("sold", -1), "rating": ("rating", -1)}


@router.get("/products")
async def products(request: Request):
    a = dict(request.query_params)
    page, limit = max(int(a.get("page", 1)), 1), min(int(a.get("limit", 12)), 60)
    q = build_query(a)
    docs = await db.products.find(q, PUB).to_list(5000)
    term = (a.get("q") or "").strip()
    if term:
        docs = [p for p in docs if fuzzy_score(p, term) >= 75]
    if a.get("discount"):
        docs = [p for p in docs if discount_pct(p) >= int(a["discount"])]
    sort = a.get("sort", "popularity")
    if sort == "discount":
        docs.sort(key=discount_pct, reverse=True)
    elif sort in SORTS:
        k, d = SORTS[sort]
        docs.sort(key=lambda p: p.get(k) or 0, reverse=d == -1)
    elif term:
        docs.sort(key=lambda p: fuzzy_score(p, term), reverse=True)
    facet_docs = await db.products.find({"active": True}, {"material": 1, "color": 1, "brand": 1, "_id": 0}).to_list(5000)
    facets = {f: sorted({d[f] for d in facet_docs if d.get(f)}) for f in ("material", "color", "brand")}
    total = len(docs)
    return {"items": [card(p) for p in docs[(page - 1) * limit: page * limit]], "total": total, "page": page,
            "pages": (total + limit - 1) // limit, "facets": facets}


@router.get("/products/suggest")
async def suggest(q: str = ""):
    if len(q.strip()) < 2:
        return {"products": [], "categories": []}
    docs = await db.products.find({"active": True}, {"_id": 0, "name": 1, "name_mr": 1, "slug": 1, "images": 1, "price": 1, "category": 1, "brand": 1, "material": 1, "color": 1}).to_list(5000)
    scored = sorted(((fuzzy_score(p, q), p) for p in docs), key=lambda x: -x[0])
    prods = [{"name": p["name"], "name_mr": p["name_mr"], "slug": p["slug"], "image": p["images"][0], "price": p["price"]} for s, p in scored if s >= 75][:6]
    cats = await db.categories.find({}, {"_id": 0, "slug": 1, "name": 1, "name_mr": 1}).to_list(50)
    cats = [c for c in cats if fuzz.partial_ratio(q.lower(), c["name"].lower()) >= 75 or q in c["name_mr"]][:3]
    return {"products": prods, "categories": cats}


@router.get("/products/{slug}")
async def product_detail(slug: str):
    p = await db.products.find_one({"$or": [{"slug": slug}, {"id": slug}], "active": True}, PUB)
    if not p:
        raise HTTPException(404, "Product not found")
    p["discount"] = discount_pct(p)
    similar = await db.products.find({"category": p["category"], "id": {"$ne": p["id"]}, "active": True}, PUB).to_list(8)
    fbt_cat = {"bed": "mattress", "mattress": "bed", "sofa": "decor", "dining": "decor", "office": "study-table", "study-table": "office"}.get(p["category"], "decor")
    fbt = await db.products.find({"category": fbt_cat, "active": True, "stock": {"$gt": 0}}, PUB).sort("sold", -1).to_list(2)
    reviews = await db.reviews.find({"product_id": p["id"], "status": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    questions = await db.questions.find({"product_id": p["id"], "status": "answered"}, {"_id": 0}).to_list(50)
    return {"product": p, "similar": [card(x) for x in similar], "fbt": [card(x) for x in fbt], "reviews": reviews, "questions": questions}


@router.get("/pincode/{pin}")
async def check_pincode(pin: str):
    if not re.fullmatch(r"\d{6}", pin):
        raise HTTPException(400, "Invalid pincode")
    return await pincode_info(pin)


@router.get("/slots")
async def slots():
    return await db.slots.find({"active": True}, {"_id": 0}).sort("sort", 1).to_list(20)


@router.get("/coupons")
async def public_coupons():
    return await db.coupons.find({"active": True, "public": True}, {"_id": 0}).to_list(20)


@router.get("/blogs")
async def blogs():
    return await db.blogs.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.get("/blogs/{slug}")
async def blog(slug: str):
    b = await db.blogs.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    return b


@router.get("/pages/{slug}")
async def page(slug: str):
    p = await db.pages.find_one({"slug": slug, "active": True}, {"_id": 0})
    if p:
        return p
    from seed_data import legal_pages
    s = await get_settings()
    vals = {k: s.get(k) or f"[{k.replace('_', ' ').title()} - set in Admin > Settings]" for k in ("shop_name", "address", "phone", "email", "timings", "whatsapp", "gst_number")}
    for sl, t, tm, c in legal_pages(vals):
        if sl == slug:
            return {"id": sl, "slug": sl, "title": t, "title_mr": tm, "content": c, "active": True}
    raise HTTPException(404, "Not found")


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    urls = ["/", "/categories", "/products", "/showroom", "/blog", "/enquiry"] + [f"/page/{x}" for x in ("about", "contact", "privacy", "terms", "refund", "shipping")]
    urls += [f"/product/{p['slug']}" for p in await db.products.find({"active": True}, {"slug": 1}).to_list(5000)]
    urls += [f"/products?category={c['slug']}" for c in await db.categories.find({}, {"slug": 1}).to_list(100)]
    urls += [f"/blog/{b['slug']}" for b in await db.blogs.find({}, {"slug": 1}).to_list(100)]
    xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(
        f"<url><loc>{base}{u.replace('&', '&amp;')}</loc></url>" for u in urls) + "</urlset>"
    return Response(xml, media_type="application/xml")


@router.post("/log/error")
async def log_error(body: dict, request: Request):
    rate_limit(f"err:{client_ip(request)}", 30)
    await db.error_logs.insert_one({"id": uid(), "message": str(body.get("message", ""))[:1000], "stack": str(body.get("stack", ""))[:3000],
                                    "url": str(body.get("url", ""))[:300], "created_at": now()})
    logging.getLogger("client").error(f"Client error: {str(body.get('message'))[:200]}")
    return {"ok": True}
