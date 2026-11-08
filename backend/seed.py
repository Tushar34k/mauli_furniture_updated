import os
import logging
from core import db, uid, now, hash_pw
from seed_data import CATEGORIES

log = logging.getLogger("setup")


def default_settings():
    e = lambda k: os.environ.get(k, "")  # noqa: E731
    return {
        "id": "shop", "shop_name": e("SHOP_NAME"), "shop_name_mr": e("SHOP_NAME_MR"), "address": e("SHOP_ADDRESS"), "phone": e("SHOP_PHONE"),
        "whatsapp": e("SHOP_WHATSAPP"), "email": e("SHOP_EMAIL"), "gst_number": e("SHOP_GST"), "state_code": "27", "timings": "", "map_embed": "",
        "logo": "", "invoice_prefix": "INV", "invoice_terms": "", "announcement": "", "free_delivery_above": 10000, "default_delivery_charge": 499,
        "cod_limit": 100000, "razorpay_key_id": "", "razorpay_key_secret": "", "social": {}, "emi_text": "", "deal_hours": 24,
        "home_sections": [{"key": k, "enabled": True} for k in ["banners", "categories", "deals", "new_arrivals", "best_sellers", "rooms", "price", "reviews", "blog"]],
    }


async def run_setup():
    """Production first-run: settings, default categories, one Owner from env. No demo data."""
    if not await db.settings.find_one({"id": "shop"}):
        await db.settings.insert_one(default_settings())
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([{"id": uid(), "slug": s, "name": n, "name_mr": m, "icon": ic, "image": "", "room": r, "sort": i, "active": True}
                                         for i, (s, n, m, ic, _im, r) in enumerate(CATEGORIES)])
    email, pw = os.environ.get("OWNER_EMAIL", "").strip().lower(), os.environ.get("OWNER_PASSWORD", "")
    if email and pw and not await db.users.find_one({"role": "owner"}):
        await db.users.insert_one({"id": uid(), "email": email, "name": "Owner", "role": "owner", "password_hash": hash_pw(pw), "phone": "",
                                   "active": True, "must_change_password": True, "created_at": now()})
        log.info(f"Owner account created for {email} (password change required on first login)")
    for col, keys in [("users", ["id"]), ("products", ["id", "slug"]), ("orders", ["id"])]:
        for k in keys:
            await db[col].create_index(k, unique=True)
    for col, k in [("users", "role"), ("products", "category"), ("products", "sku"), ("products", "barcode"),
                   ("orders", "user_id"), ("orders", "order_no"), ("orders", "status"), ("orders", "created_at"), ("orders", "razorpay_order_id"),
                   ("stock_movements", "product_id"), ("reviews", "product_id"), ("notifications", "user_id"), ("login_attempts", "identifier")]:
        await db[col].create_index(k)
    await db.users.create_index("email", sparse=True)
    await db.users.create_index("phone", sparse=True)
    await db.otps.create_index("created", expireAfterSeconds=600)
