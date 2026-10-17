import os
import random
import httpx
import logging
from datetime import datetime, timezone, timedelta
from PIL import Image
import io
from core import db, uid, now, hash_pw, verify_pw, UPLOAD_DIR
from seed_data import IMAGES, CATEGORIES, PRODUCTS, DIMENSIONS, BLOGS, legal_pages, img

log = logging.getLogger("seed")

ROLE_ACCOUNTS = [("manager@mauli.com", "Manager@123", "manager", "Store Manager"),
                 ("staff@mauli.com", "Staff@123", "staff", "Showroom Staff"),
                 ("delivery@mauli.com", "Delivery@123", "delivery", "Delivery Ramesh")]


def default_settings():
    e = os.environ.get
    return {
        "id": "shop", "shop_name": e("SHOP_NAME", "Mauli Furniture Mall"), "shop_name_mr": "माऊली फर्निचर मॉल",
        "address": e("SHOP_ADDRESS", "Pune, Maharashtra 411001"), "phone": e("SHOP_PHONE", "+91 98765 43210"),
        "whatsapp": e("SHOP_WHATSAPP", "919876543210"), "email": e("SHOP_EMAIL", "info@maulifurniture.test"),
        "gst_number": e("SHOP_GST", "27ABCDE1234F1Z5"), "state_code": "27", "timings": "10 AM - 9 PM (All days)",
        "map_embed": "https://www.google.com/maps?q=Pune+Maharashtra+411001&output=embed",
        "logo": "/logo.svg", "invoice_prefix": "MFM", "invoice_terms": "Goods once sold will be exchanged only as per return policy. Subject to Pune jurisdiction.",
        "free_delivery_above": 10000, "default_delivery_charge": 499, "cod_limit": 100000,
        "razorpay_key_id": "", "razorpay_key_secret": "",
        "social": {"facebook": "https://facebook.com/", "instagram": "https://instagram.com/", "youtube": "https://youtube.com/"},
        "home_sections": [{"key": k, "enabled": True} for k in ["banners", "categories", "deals", "new_arrivals", "best_sellers", "rooms", "price", "reviews", "blog"]],
        "deal_hours": 24, "emi_text": "No-cost EMI from ₹999/month on cards. UPI, cards, net banking & wallets accepted.",
    }


async def download_images():
    d = UPLOAD_DIR / "seed"
    d.mkdir(exist_ok=True, parents=True)
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        for k, url in IMAGES.items():
            p = d / f"{k}.jpg"
            if p.exists():
                continue
            try:
                r = await c.get(url)
                im = Image.open(io.BytesIO(r.content)).convert("RGB")
                im.thumbnail((1200, 1200))
                im.save(p, "JPEG", quality=80, optimize=True)
            except Exception as ex:
                log.warning(f"image {k} failed: {ex}")


async def seed_users():
    ae, ap = os.environ["ADMIN_EMAIL"].lower(), os.environ["ADMIN_PASSWORD"]
    owners = [(ae, ap, "owner", "Owner")]
    if os.environ.get("OWNER_EMAIL"):
        owners.append((os.environ["OWNER_EMAIL"].lower(), ap, "owner", "Owner"))
    for email, pw, role, name in owners + ROLE_ACCOUNTS:
        ex = await db.users.find_one({"email": email})
        if not ex:
            await db.users.insert_one({"id": uid(), "email": email, "name": name, "role": role, "password_hash": hash_pw(pw),
                                       "phone": "", "active": True, "created_at": now()})
        elif role == "owner" and not verify_pw(pw, ex["password_hash"]) and not ex.get("pw_changed"):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_pw(pw)}})
    if not await db.users.find_one({"phone": "9999999999"}):
        await db.users.insert_one({"id": "demo-customer", "phone": "9999999999", "name": "Demo Customer", "email": "demo@example.com",
                                   "role": "customer", "addresses": [{"id": uid(), "name": "Demo Customer", "phone": "9999999999",
                                   "line1": "Flat 12, Shivaji Nagar", "line2": "Near FC Road", "city": "Pune", "state": "Maharashtra", "pincode": "411005", "default": True}],
                                   "wishlist": [], "created_at": now()})


def make_product(i, t):
    cat, name, name_mr, brand, mat, color, price, mrp, stock, imgs = t
    rnd = random.Random(i)
    slug = name.lower().replace("&", "and").replace("(", "").replace(")", "").replace(" ", "-")
    gst = 18
    variants = []
    if cat in ("sofa", "bed", "mattress"):
        variants = [{"type": "size", "value": v, "price_delta": d} for v, d in
                    ({"sofa": [("3 Seater", 0), ("3+1+1 Set", 14000)], "bed": [("Queen", 0), ("King", 6000)], "mattress": [("Queen 72x60", 0), ("King 78x72", 3500)]}[cat])]
    created = datetime.now(timezone.utc) - timedelta(days=i * 2)
    return {
        "id": uid(), "slug": slug, "name": name, "name_mr": name_mr, "category": cat, "brand": brand, "material": mat, "color": color,
        "room": next(c[5] for c in CATEGORIES if c[0] == cat),
        "description": f"{name} by {brand} is crafted from premium {mat.lower()} with a beautiful {color.lower()} finish. Designed for Indian homes, it combines comfort, durability and timeless style. Quality-checked at our Pune showroom before dispatch.",
        "description_mr": f"{name_mr} - उत्तम दर्जाच्या {mat} पासून बनवलेले, {color} रंगात. भारतीय घरांसाठी टिकाऊ, आरामदायी आणि सुंदर डिझाइन.",
        "images": [img(k) for k in imgs], "video": "", "variants": variants,
        "sku": f"MFM-{cat[:3].upper()}-{1000 + i}", "barcode": f"890{1000000000 + i * 7919}",
        "purchase_price": round(price * 0.68), "price": price, "mrp": mrp, "gst": gst, "stock": stock, "reorder_level": 5,
        "supplier": rnd.choice(["Shree Ganesh Timber, Pune", "Jodhpur Wood Crafts", "Kirti Foam Industries", "Sai Steel Works"]),
        "location": rnd.choice(["Showroom Floor 1", "Showroom Floor 2", "Warehouse Hadapsar"]),
        "dimensions": DIMENSIONS[cat], "weight": f"{rnd.randint(8, 95)} kg",
        "specs": {"Material": mat, "Colour": color, "Finish": rnd.choice(["Matte", "Glossy", "Natural Polish"]), "Brand": brand, "Country of Origin": "India"},
        "warranty": rnd.choice(["1 Year", "3 Years", "5 Years"]) if cat != "decor" else "6 Months",
        "assembly": "diy" if cat in ("decor", "study-table") else "free_installation",
        "delivery_days": rnd.choice([2, 3, 5, 7]), "rating": round(rnd.uniform(3.8, 4.9), 1), "reviews_count": rnd.randint(4, 180),
        "sold": rnd.randint(5, 400), "is_deal": i % 5 == 0, "active": True, "tags": [cat, mat.lower(), color.lower()],
        "created_at": created.isoformat(),
    }


async def seed_catalog():
    await db.categories.insert_many([{"id": uid(), "slug": s, "name": n, "name_mr": m, "icon": ic, "image": img(im), "room": r, "sort": i, "active": True}
                                     for i, (s, n, m, ic, im, r) in enumerate(CATEGORIES)])
    brands = sorted({p[3] for p in PRODUCTS})
    await db.brands.insert_many([{"id": uid(), "name": b, "active": True} for b in brands])
    prods = [make_product(i, t) for i, t in enumerate(PRODUCTS)]
    await db.products.insert_many(prods)
    for p in prods:
        await db.stock_movements.insert_one({"id": uid(), "product_id": p["id"], "sku": p["sku"], "name": p["name"], "type": "in", "qty": p["stock"],
                                             "balance": p["stock"], "note": "Opening stock", "by": "system", "created_at": p["created_at"]})
    await db.banners.insert_many([
        {"id": uid(), "title": "Diwali Dhamaka Sale", "title_mr": "दिवाळी धमाका सेल", "subtitle": "Up to 40% off on Sofas & Beds", "subtitle_mr": "सोफा आणि बेडवर ४०% पर्यंत सूट", "image": img("banner1"), "link": "/products?category=sofa", "sort": 1, "active": True},
        {"id": uid(), "title": "New Bedroom Collection", "title_mr": "नवीन बेडरूम कलेक्शन", "subtitle": "Solid Sheesham beds with free installation", "subtitle_mr": "मोफत इन्स्टॉलेशनसह शिसम बेड", "image": img("bed1"), "link": "/products?category=bed", "sort": 2, "active": True},
        {"id": uid(), "title": "Dine Together", "title_mr": "एकत्र जेवण, आनंदाचे क्षण", "subtitle": "Dining sets from ₹24,999", "subtitle_mr": "डायनिंग सेट ₹२४,९९९ पासून", "image": img("banner2"), "link": "/products?category=dining", "sort": 3, "active": True},
    ])
    await db.coupons.insert_many([
        {"id": uid(), "code": "WELCOME10", "type": "percent", "value": 10, "max_discount": 2000, "min_order": 2000, "description": "10% off on first order (max ₹2,000)", "active": True, "public": True},
        {"id": uid(), "code": "DIWALI2000", "type": "flat", "value": 2000, "max_discount": 2000, "min_order": 20000, "description": "Flat ₹2,000 off on orders above ₹20,000", "active": True, "public": True},
        {"id": uid(), "code": "FREESHIP", "type": "shipping", "value": 0, "max_discount": 0, "min_order": 0, "description": "Free delivery on any order", "active": True, "public": True},
    ])
    pins = [(f"4110{n:02d}", "Pune", 0, 2) for n in range(1, 63)] + [("400001", "Mumbai", 499, 4), ("400050", "Mumbai", 499, 4), ("422001", "Nashik", 399, 3),
                                                                    ("416001", "Kolhapur", 399, 4), ("431001", "Chh. Sambhajinagar", 499, 5), ("413001", "Solapur", 399, 4), ("440001", "Nagpur", 799, 6)]
    await db.pincodes.insert_many([{"id": uid(), "pincode": p, "city": c, "charge": ch, "days": d, "cod": True, "active": True} for p, c, ch, d in pins])
    await db.slots.insert_many([{"id": uid(), "label": l, "label_mr": m, "active": True, "sort": i} for i, (l, m) in
                                enumerate([("10 AM - 1 PM", "सकाळी १० - दुपारी १"), ("1 PM - 5 PM", "दुपारी १ - ५"), ("5 PM - 9 PM", "संध्या ५ - रात्री ९")])])
    s = await db.settings.find_one({"id": "shop"}, {"_id": 0})
    await db.pages.insert_many([{"id": uid(), "slug": sl, "title": t, "title_mr": tm, "content": c, "active": True} for sl, t, tm, c in legal_pages(s)])
    await db.blogs.insert_many([{"id": uid(), "slug": sl, "title": t, "title_mr": tm, "image": img(im), "content": c, "active": True, "created_at": now()} for sl, t, tm, im, c in BLOGS])
    names = ["Sachin Patil", "Priya Deshmukh", "Amit Kulkarni", "Snehal Jadhav", "Rahul Pawar", "Manisha Shinde"]
    texts = ["Excellent quality, delivery on time and free installation was very professional.", "उत्तम दर्जा आणि योग्य किंमत. माऊली फर्निचरचे आभार!",
             "Showroom staff helped us choose the perfect bed. Very happy.", "Sofa is very comfortable, exactly like the photos.", "Good packaging and fast delivery to Nashik.", "किंमत आणि सेवा दोन्ही छान. पुन्हा खरेदी करू."]
    reviews = []
    for i, p in enumerate(prods[:18]):
        reviews.append({"id": uid(), "product_id": p["id"], "product_name": p["name"], "user_id": "demo-customer", "name": names[i % 6], "rating": 5 - (i % 3 == 2),
                        "text": texts[i % 6], "photos": [], "status": "approved", "created_at": now()})
    await db.reviews.insert_many(reviews)
    await db.questions.insert_one({"id": uid(), "product_id": prods[0]["id"], "name": "Kiran", "question": "Is the wood termite proof?",
                                   "answer": "Yes, it is treated with anti-termite polish and has a 5 year warranty.", "status": "answered", "created_at": now()})
    await seed_orders(prods)


async def seed_orders(prods):
    cust = await db.users.find_one({"id": "demo-customer"}, {"_id": 0})
    addr = cust["addresses"][0]
    statuses = ["delivered", "delivered", "shipped", "packed", "confirmed", "placed", "out_for_delivery", "cancelled"]
    flow = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"]
    for i, st in enumerate(statuses):
        p = prods[(i * 5) % len(prods)]
        qty = 1 + (i % 2)
        when = datetime.now(timezone.utc) - timedelta(days=9 - i, hours=i)
        sub = p["price"] * qty
        gst_amt = round(sub * p["gst"] / (100 + p["gst"]), 2)
        tl = [{"status": s, "at": (when + timedelta(hours=6 * k)).isoformat(), "note": ""} for k, s in enumerate(flow[: flow.index(st) + 1])] if st != "cancelled" else [
            {"status": "placed", "at": when.isoformat(), "note": ""}, {"status": "cancelled", "at": when.isoformat(), "note": "Customer request"}]
        await db.orders.insert_one({
            "id": uid(), "order_no": f"MFM{24100 + i}", "user_id": cust["id"], "channel": "online" if i % 3 else "pos",
            "items": [{"product_id": p["id"], "name": p["name"], "image": p["images"][0], "sku": p["sku"], "price": p["price"], "mrp": p["mrp"],
                       "purchase_price": p["purchase_price"], "qty": qty, "gst": p["gst"], "category": p["category"], "variant": ""}],
            "address": {**addr, "email": cust["email"]}, "slot": "10 AM - 1 PM", "delivery_date": "", "subtotal": sub, "mrp_total": p["mrp"] * qty,
            "discount": 0, "coupon": "", "gst_total": gst_amt, "delivery": 0, "total": sub,
            "payment_method": ["razorpay", "cod", "store", "demo"][i % 4], "payment_status": "paid" if st in ("delivered", "shipped") or i % 2 else "pending",
            "status": st, "timeline": tl, "assigned_to": "", "notes": "", "return_request": None, "created_at": when.isoformat(),
        })


async def run_seed():
    if not await db.settings.find_one({"id": "shop"}):
        await db.settings.insert_one(default_settings())
    await seed_users()
    await download_images()
    if await db.products.count_documents({}) == 0:
        await seed_catalog()
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email", sparse=True)
    await db.users.create_index("phone", sparse=True)
    await db.products.create_index("slug", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.otps.create_index("created", expireAfterSeconds=600)
