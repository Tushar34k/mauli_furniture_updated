"""Mauli Furniture Mall - production build regression tests (iteration 2)."""
import io
import threading
import requests
from conftest import API, BASE_URL, H, STATE, mdb, NEW_OWNER_PW

ADDR = {"name": "TEST_Buyer", "phone": "9000000011", "line1": "TEST lane 1", "city": "Pune", "state": "Maharashtra", "pincode": "411001"}


def order(prod, method="cod", tok=None, qty=1):
    return requests.post(f"{API}/orders", headers=H(tok) if tok else {}, json={"items": [{"product_id": prod["id"], "qty": qty}], "address": ADDR,
                                                                               "pincode": "411001", "payment_method": method})


def stock(pid):
    return mdb.products.find_one({"id": pid})["stock"]


# ---- Health / headers / static ----
class TestHealth:
    def test_health_and_headers(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200 and r.json()["status"] == "ok"
        assert "max-age" in r.headers.get("Strict-Transport-Security", "")
        assert "default-src" in r.headers.get("Content-Security-Policy", "")

    def test_sitemap_manifest_sw(self):
        s = requests.get(f"{API}/sitemap.xml")
        assert s.status_code == 200 and "<urlset" in s.text
        assert requests.get(f"{BASE_URL}/manifest.json").json().get("name")
        sw = requests.get(f"{BASE_URL}/sw.js")
        assert sw.status_code == 200 and "<html" not in sw.text[:200].lower()


# ---- Auth: forced password change, OTP disabled, access control ----
class TestAuth:
    def test_owner_forced_change(self, owner_token):
        assert STATE["forced_change_verified"] in (True, None)  # None = already changed in earlier run
        r = requests.get(f"{API}/admin/dashboard", headers=H(owner_token))
        assert r.status_code == 200

    def test_otp_send_503(self):
        r = requests.post(f"{API}/auth/otp/send", json={"phone": "9876500001"})
        assert r.status_code == 503 and "Google" in r.json()["detail"] and "लॉगिन" in r.json()["detail"]

    def test_admin_requires_auth(self, customers):
        assert requests.get(f"{API}/admin/orders").status_code == 401
        assert requests.get(f"{API}/admin/orders", headers=H(customers[0][1])).status_code == 403

    def test_no_demo_pay(self, owner_token, test_product, created, customers):
        p = test_product(stock=3)
        o = order(p, "cod", customers[0][1]).json()["order"]
        created["orders"].append(o["id"])
        assert requests.post(f"{API}/orders/{o['id']}/pay/demo").status_code in (404, 405)
        # customer B cannot view A's order
        assert requests.get(f"{API}/orders/{o['id']}", headers=H(customers[1][1])).status_code == 403
        assert requests.get(f"{API}/orders/{o['id']}", headers=H(customers[0][1])).status_code == 200
        inv = requests.get(f"{API}/orders/{o['id']}/invoice", headers=H(customers[0][1]))
        assert inv.status_code == 200 and inv.content[:4] == b"%PDF"


# ---- Roles ----
class TestRoles:
    def _mk(self, owner_token, created, role):
        email = f"test_{role}_iter2@example.com"
        mdb.users.delete_many({"email": email})
        r = requests.post(f"{API}/admin/staff", headers=H(owner_token), json={"name": f"TEST_{role}", "email": email, "role": role, "password": "Temp#12345"})
        assert r.status_code == 200, r.text
        u = mdb.users.find_one({"email": email})
        created["users"].append(u["id"])
        tok = requests.post(f"{API}/auth/staff/login", json={"email": email, "password": "Temp#12345"}).json()["token"]
        g = requests.get(f"{API}/admin/orders", headers=H(tok))
        assert g.status_code == 403 and "PASSWORD_CHANGE_REQUIRED" in g.text
        assert requests.post(f"{API}/auth/change-password", headers=H(tok), json={"old_password": "Temp#12345", "new_password": "Temp#99999"}).status_code == 200
        return u["id"], tok

    def test_role_permissions(self, owner_token, created, test_product):
        for role in ("staff", "delivery"):
            _, tok = self._mk(owner_token, created, role)
            assert requests.put(f"{API}/admin/settings", headers=H(tok), json={"timings": "x"}).status_code == 403
            assert requests.get(f"{API}/admin/reports/sales", headers=H(tok)).status_code == 403
            assert requests.get(f"{API}/admin/integrations", headers=H(tok)).status_code == 403
            assert requests.get(f"{API}/admin/export/orders", headers=H(tok)).status_code == 403
        mid, mtok = self._mk(owner_token, created, "manager")
        assert requests.get(f"{API}/admin/reports/sales", headers=H(mtok)).status_code == 200
        assert requests.get(f"{API}/admin/export/orders", headers=H(mtok)).status_code == 403

    def test_delivery_sees_only_assigned(self, owner_token, created, test_product):
        did, dtok = self._mk(owner_token, created, "delivery")
        p = test_product(stock=4)
        o1 = order(p).json()["order"]; o2 = order(p).json()["order"]
        created["orders"] += [o1["id"], o2["id"]]
        assert requests.put(f"{API}/admin/orders/{o1['id']}", headers=H(owner_token), json={"assigned_to": did}).status_code == 200
        ids = [o["id"] for o in requests.get(f"{API}/admin/orders", headers=H(dtok)).json()["items"]]
        assert ids == [o1["id"]]
        assert requests.get(f"{API}/admin/orders/{o2['id']}", headers=H(dtok)).status_code == 404


# ---- Integrations / export ----
class TestIntegrations:
    def test_status(self, owner_token):
        rows = {r["key"]: r for r in requests.get(f"{API}/admin/integrations", headers=H(owner_token)).json()}
        for k in ("sms_otp", "razorpay", "email", "push_fcm", "whatsapp_api", "storage"):
            assert rows[k]["configured"] is False and rows[k]["help_en"] and rows[k]["help_mr"]
        assert rows["google_login"]["configured"] is True

    def test_exports(self, owner_token):
        for col in ("products", "orders", "customers", "stock_movements", "enquiries"):
            r = requests.get(f"{API}/admin/export/{col}", headers=H(owner_token))
            assert r.status_code == 200 and r.content[:2] == b"PK", col


# ---- Checkout / stock ----
class TestOrders:
    def test_razorpay_rejected_and_stock_unchanged(self, test_product):
        p = test_product(stock=2)
        r = order(p, "razorpay")
        assert r.status_code == 400
        assert stock(p["id"]) == 2, "stock leaked after rejected razorpay order"

    def test_guest_cod_store_and_cancel_restock(self, test_product, created):
        p = test_product(stock=3)
        for m in ("cod", "store"):
            r = order(p, m)
            assert r.status_code == 200, r.text
            created["orders"].append(r.json()["order"]["id"])
        assert stock(p["id"]) == 1
        oid = created["orders"][-1]
        assert requests.post(f"{API}/orders/{oid}/cancel?phone={ADDR['phone']}").status_code == 200
        assert stock(p["id"]) == 2
        assert requests.post(f"{API}/orders/{oid}/cancel?phone={ADDR['phone']}").status_code == 400  # no double restock
        assert stock(p["id"]) == 2

    def test_cannot_oversell(self, test_product):
        p = test_product(stock=1)
        assert order(p, qty=2).status_code == 400

    def test_concurrent_last_unit(self, test_product, created):
        p = test_product(stock=1)
        res = []
        ts = [threading.Thread(target=lambda: res.append(order(p))) for _ in range(4)]
        [t.start() for t in ts]; [t.join() for t in ts]
        ok = [r for r in res if r.status_code == 200]
        for r in ok:
            created["orders"].append(r.json()["order"]["id"])
        assert len(ok) == 1 and stock(p["id"]) == 0

    def test_pos_sale(self, owner_token, test_product, created):
        p = test_product(stock=2)
        r = requests.post(f"{API}/admin/pos/sale", headers=H(owner_token), json={"items": [{"product_id": p["id"], "qty": 2}], "payment_mode": "cash"})
        assert r.status_code == 200
        created["orders"].append(r.json()["id"])
        assert stock(p["id"]) == 0
        assert requests.post(f"{API}/admin/pos/sale", headers=H(owner_token), json={"items": [{"product_id": p["id"], "qty": 1}], "payment_mode": "cash"}).status_code == 400

    def test_admin_order_lifecycle(self, owner_token, test_product, created, customers):
        p = test_product(stock=3)
        o = order(p, "cod", customers[0][1]).json()["order"]
        created["orders"].append(o["id"])
        st = lambda s: requests.put(f"{API}/admin/orders/{o['id']}/status", headers=H(owner_token), json={"status": s})  # noqa
        assert st("packed").status_code == 200
        assert st("confirmed").status_code == 400  # backwards
        assert requests.put(f"{API}/admin/orders/{o['id']}", headers=H(owner_token), json={"notes": "TEST note"}).json()["notes"] == "TEST note"
        for doc in ("invoice", "packing-slip"):
            assert requests.get(f"{API}/admin/orders/{o['id']}/{doc}", headers=H(owner_token)).content[:4] == b"%PDF"
        assert st("delivered").status_code == 200
        assert mdb.orders.find_one({"id": o["id"]})["payment_status"] == "paid"
        assert requests.post(f"{API}/orders/{o['id']}/return", headers=H(customers[0][1]), json={"type": "return", "reason": "TEST damaged"}).status_code == 200
        assert requests.post(f"{API}/admin/orders/{o['id']}/return/refunded", headers=H(owner_token)).status_code == 400
        assert requests.post(f"{API}/admin/orders/{o['id']}/return/approved", headers=H(owner_token)).status_code == 200
        assert stock(p["id"]) == 3
        assert requests.post(f"{API}/admin/orders/{o['id']}/return/refunded", headers=H(owner_token)).status_code == 200
        assert mdb.orders.find_one({"id": o["id"]})["payment_status"] == "refunded"

    def test_refund_cancelled_paid(self, owner_token, test_product, created):
        p = test_product(stock=2)
        o = order(p).json()["order"]
        created["orders"].append(o["id"])
        requests.put(f"{API}/admin/orders/{o['id']}", headers=H(owner_token), json={"payment_status": "paid"})
        assert requests.post(f"{API}/admin/orders/{o['id']}/refund", headers=H(owner_token)).status_code == 400  # not cancelled
        assert requests.put(f"{API}/admin/orders/{o['id']}/status", headers=H(owner_token), json={"status": "cancelled"}).status_code == 200
        assert mdb.orders.find_one({"id": o["id"]})["payment_status"] == "refund_pending"
        assert requests.post(f"{API}/admin/orders/{o['id']}/refund", headers=H(owner_token)).status_code == 200
        assert mdb.orders.find_one({"id": o["id"]})["payment_status"] == "refunded"


# ---- Uploads ----
class TestUploads:
    def test_upload_states(self, owner_token, customers):
        from PIL import Image
        b = io.BytesIO(); Image.new("RGB", (20, 20), "red").save(b, "PNG")
        r = requests.post(f"{API}/admin/upload", headers=H(owner_token), files={"files": ("a.png", b.getvalue(), "image/png")})
        assert r.status_code == 503 and "not configured" in r.text.lower()
        r = requests.post(f"{API}/upload", headers=H(customers[0][1]), files={"file": ("a.png", b.getvalue(), "image/png")})
        assert r.status_code == 503
        assert requests.post(f"{API}/admin/upload", headers=H(owner_token), files={"files": ("a.exe", b"MZ\x90", "application/octet-stream")}).status_code == 400
        assert requests.post(f"{API}/admin/upload", headers=H(owner_token), files={"files": ("a.txt", b"hello", "text/plain")}).status_code == 400
        assert requests.post(f"{API}/admin/upload", headers=H(owner_token), files={"files": ("big.png", b"0" * (9 * 1024 * 1024), "image/png")}).status_code == 400


# ---- Catalog / CRUD / moderation / notifications / reports ----
class TestAdminCatalog:
    def test_product_crud_bulk(self, owner_token, created, test_product):
        p = test_product(stock=5)
        u = requests.put(f"{API}/admin/products/{p['id']}", headers=H(owner_token), json={**{k: p[k] for k in ("name", "category", "price", "mrp", "images")}, "stock": 7})
        assert u.status_code == 200 and u.json()["stock"] == 7
        assert requests.post(f"{API}/admin/stock/adjust", headers=H(owner_token), json={"product_id": p["id"], "qty": 100, "type": "out"}).status_code == 400
        assert requests.post(f"{API}/admin/stock/adjust", headers=H(owner_token), json={"product_id": p["id"], "qty": 2, "type": "damage"}).json()["stock"] == 5
        mv = requests.get(f"{API}/admin/stock/movements?product_id={p['id']}", headers=H(owner_token)).json()
        assert mv["total"] >= 3
        assert requests.get(f"{API}/admin/inventory/valuation", headers=H(owner_token)).json()["total"]["units"] > 0
        be = requests.post(f"{API}/admin/products/bulk-edit", headers=H(owner_token), json={"ids": [p["id"]], "set": {"is_deal": True}})
        assert be.status_code == 200 and mdb.products.find_one({"id": p["id"]})["is_deal"] is True
        csv = "name,category,sku,price,mrp,stock\nTEST_Bulk Stool,office,TEST-BULK-001,999,1499,4\n"
        r = requests.post(f"{API}/admin/products/bulk-upload", headers=H(owner_token), files={"file": ("p.csv", csv, "text/csv")})
        assert r.json()["created"] + r.json()["updated"] == 1
        bp = mdb.products.find_one({"sku": "TEST-BULK-001"})
        created["products"].append(bp["id"])
        assert requests.delete(f"{API}/admin/products/{bp['id']}", headers=H(owner_token)).status_code == 200
        assert mdb.products.find_one({"id": bp["id"]}) is None

    def test_generic_crud_and_coupon(self, owner_token, created, test_product):
        r = requests.post(f"{API}/admin/c/coupons", headers=H(owner_token), json={"code": "test_iter2", "type": "percent", "value": 10, "min_order": 0, "active": True})
        cid = r.json()["id"]; created["c"].append(("coupons", cid))
        assert r.json()["code"] == "TEST_ITER2"
        p = test_product(stock=2)
        pr = requests.post(f"{API}/cart/price", json={"items": [{"product_id": p["id"], "qty": 1}], "coupon": "TEST_ITER2"}).json()
        assert pr["discount"] == 500
        for col, body in [("pincodes", {"pincode": "999999", "city": "TEST", "charge": 0, "days": 3, "cod": True, "active": True}),
                          ("slots", {"label": "TEST slot", "active": True}), ("banners", {"title": "TEST_banner", "image": "https://x/y.jpg", "active": False})]:
            d = requests.post(f"{API}/admin/c/{col}", headers=H(owner_token), json=body).json()
            created["c"].append((col, d["id"]))
            assert requests.put(f"{API}/admin/c/{col}/{d['id']}", headers=H(owner_token), json={"active": False}).json()["active"] is False
            assert requests.delete(f"{API}/admin/c/{col}/{d['id']}", headers=H(owner_token)).status_code == 200

    def test_reviews_questions_enquiry(self, owner_token, customers, test_product, created):
        p = test_product(stock=1)
        xss = "<script>alert(1)</script> TEST great"
        r = requests.post(f"{API}/products/{p['id']}/reviews", headers=H(customers[0][1]), json={"rating": 4, "text": xss})
        assert r.status_code == 200, r.text
        rv = mdb.reviews.find_one({"product_id": p["id"]})
        assert requests.put(f"{API}/admin/reviews/{rv['id']}", headers=H(owner_token), json={"status": "approved"}).status_code == 200
        assert mdb.products.find_one({"id": p["id"]})["rating"] == 4
        assert requests.post(f"{API}/products/{p['id']}/questions", json={"name": "TEST_q", "question": "TEST is it teak?"}).status_code == 200
        q = mdb.questions.find_one({"product_id": p["id"]})
        assert requests.put(f"{API}/admin/questions/{q['id']}", headers=H(owner_token), json={"answer": "Yes"}).status_code == 200
        e = requests.post(f"{API}/enquiries", data={"name": "TEST_Enq", "phone": "9000000099", "description": xss})
        assert e.status_code == 200
        en = mdb.enquiries.find_one({"name": "TEST_Enq"}, sort=[("created_at", -1)])
        created["enquiries"].append(en["id"])
        assert requests.put(f"{API}/admin/enquiries/{en['id']}", headers=H(owner_token), json={"status": "contacted"}).status_code == 200

    def test_broadcast_logs_skipped(self, owner_token, customers):
        r = requests.post(f"{API}/admin/broadcast", headers=H(owner_token), json={"title": "TEST_bc", "message": "TEST message", "channels": ["inapp", "sms", "email", "push"]})
        assert r.status_code == 200 and r.json()["sent_to"] >= 2
        logs = [l for l in requests.get(f"{API}/admin/notification-logs", headers=H(owner_token)).json() if l["title"] == "TEST_bc"]
        assert logs and all(l["status"].startswith("skipped") for l in logs), {l["channel"]: l["status"] for l in logs}
        mdb.notification_logs.delete_many({"title": "TEST_bc"}); mdb.notifications.delete_many({"title": "TEST_bc"})

    def test_reports(self, owner_token):
        for fmt, magic in (("json", None), ("xlsx", b"PK"), ("pdf", b"%PDF")):
            r = requests.get(f"{API}/admin/reports/sales?fmt={fmt}", headers=H(owner_token))
            assert r.status_code == 200 and (magic is None or r.content[:len(magic)] == magic)


# ---- Settings reflect on public endpoints ----
class TestSettings:
    def test_settings_reflect(self, owner_token):
        orig = requests.get(f"{API}/admin/settings", headers=H(owner_token)).json()
        try:
            requests.put(f"{API}/admin/settings", headers=H(owner_token), json={"shop_name": "TEST_Shop", "phone": "+91 90000 00000", "address": "TEST Addr"})
            pub = requests.get(f"{API}/settings/public").json()
            assert pub["shop_name"] == "TEST_Shop" and pub["phone"] == "+91 90000 00000"
            assert "razorpay_key_secret" not in pub
            priv = requests.get(f"{API}/pages/privacy").json()
            assert "TEST_Shop" in str(priv) or "TEST Addr" in str(priv)
        finally:
            requests.put(f"{API}/admin/settings", headers=H(owner_token), json={k: orig.get(k, "") for k in ("shop_name", "phone", "address")})


# ---- Storefront / security ----
class TestStore:
    def test_listing_search(self):
        assert len(requests.get(f"{API}/products?limit=12").json()["items"]) > 0
        s = requests.get(f"{API}/products/suggest?q=sofa").json()
        assert s
        t = requests.get(f"{API}/products?q=sofaa").json()
        assert t["items"], "typo tolerance failed"
        assert requests.get(f"{API}/home").status_code == 200 and requests.get(f"{API}/categories").json()

    def test_nosql_injection(self):
        for qs in ("q[$ne]=1", 'category={"$gt":""}', "q=.*", "sort[$gt]=", "min_price[$gt]=0", "page=-1", "page=abc", "limit=x"):
            r = requests.get(f"{API}/products?{qs}")
            assert r.status_code in (200, 400, 422), (qs, r.status_code)
        r = requests.post(f"{API}/auth/staff/login", json={"email": {"$ne": None}, "password": {"$ne": None}})
        assert r.status_code == 422
        assert requests.get(f"{API}/orders/x?phone[$ne]=1").status_code in (403, 404)

    def test_account_wishlist_delete(self, test_product):
        import conftest
        cid = "testcustDEL01"
        conftest.mdb.users.insert_one({"id": cid, "role": "customer", "name": "TEST_Del", "email": "test_del@example.com", "phone": "9000000077", "addresses": [], "wishlist": []})
        tok = conftest.mint(cid)
        p = test_product(stock=1)
        assert requests.post(f"{API}/account/wishlist/{p['id']}", headers=H(tok)).status_code == 200
        assert requests.get(f"{API}/auth/me", headers=H(tok)).json()["id"] == cid
        assert requests.post(f"{API}/auth/refresh", headers=H(tok)).json()["token"]
        assert requests.delete(f"{API}/auth/me", headers=H(tok)).status_code == 200
        assert requests.get(f"{API}/auth/me", headers=H(tok)).status_code == 401
        conftest.mdb.users.delete_one({"id": cid})


class TestLockout:
    def test_bruteforce(self):
        e = "test_nobody_iter2@example.com"
        codes = [requests.post(f"{API}/auth/staff/login", json={"email": e, "password": "bad"}).status_code for _ in range(6)]
        mdb.login_attempts.delete_many({"identifier": {"$regex": e}})
        assert codes[:5] == [401] * 5 and codes[5] == 429
        h = mdb.users.find_one({"role": "owner"})["password_hash"]
        assert h.startswith("$2b$")
