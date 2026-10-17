# Mauli Furniture Mall - backend API regression tests
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
SOFA_SLUG = "royal-teak-3-seater-sofa"
ADDR = {"name": "TEST_Guest", "phone": "9876500002", "line1": "TEST lane 1", "city": "Pune", "state": "Maharashtra", "pincode": "411005"}


def staff_token(email, pw):
    r = requests.post(f"{API}/auth/staff/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="session")
def owner():
    return staff_token("admin@mauli.com", "Admin@123")


@pytest.fixture(scope="session")
def staff():
    return staff_token("staff@mauli.com", "Staff@123")


@pytest.fixture(scope="session")
def delivery():
    return staff_token("delivery@mauli.com", "Delivery@123")


@pytest.fixture(scope="session")
def customer():
    requests.post(f"{API}/auth/otp/send", json={"phone": "9999999999"})
    r = requests.post(f"{API}/auth/otp/verify", json={"phone": "9999999999", "otp": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def sofa():
    r = requests.get(f"{API}/products/{SOFA_SLUG}")
    assert r.status_code == 200
    d = r.json()
    return d.get("product", d)


def order(items, method="cod", coupon="", token=None, pincode="411005"):
    body = {"items": items, "coupon": coupon, "pincode": pincode, "address": {**ADDR, "pincode": pincode}, "payment_method": method, "slot": "", "delivery_date": ""}
    return requests.post(f"{API}/orders", json=body, headers=H(token) if token else {})


# ---- Health / public store ----
class TestPublic:
    def test_root_home(self):
        assert requests.get(f"{API}/").status_code == 200
        r = requests.get(f"{API}/home")
        assert r.status_code == 200 and isinstance(r.json(), dict)

    def test_listing_pagination(self):
        r = requests.get(f"{API}/products", params={"page": 1, "limit": 12})
        assert r.status_code == 200
        d = r.json()
        print("listing keys", list(d.keys()) if isinstance(d, dict) else type(d))

    @pytest.mark.parametrize("q", ["sofaa", "matress"])
    def test_fuzzy_suggest(self, q):
        r = requests.get(f"{API}/products/suggest", params={"q": q})
        assert r.status_code == 200
        print(q, str(r.json())[:200])
        assert len(str(r.json())) > 20

    @pytest.mark.parametrize("pin,ok,charge", [("411005", True, 0), ("400001", True, 499), ("110001", False, None)])
    def test_pincode(self, pin, ok, charge):
        d = requests.get(f"{API}/pincode/{pin}").json()
        assert d["serviceable"] is ok
        if charge is not None:
            assert d["charge"] == charge

    def test_pwa_and_misc(self):
        for p in ["/manifest.json", "/sw.js", "/offline.html", "/icons/maskable-512.png", "/.well-known/assetlinks.json", "/api/sitemap.xml", "/api/docs"]:
            r = requests.get(f"{BASE_URL}{p}")
            assert r.status_code == 200, p
            if p.endswith(".json"):
                r.json()

    def test_settings_public_no_secrets(self):
        d = requests.get(f"{API}/settings/public").json()
        assert "razorpay_key_secret" not in d
        print("razorpay_enabled", d.get("razorpay_enabled"))


# ---- Cart pricing / coupons ----
class TestCart:
    @pytest.mark.parametrize("code,expect", [("WELCOME10", "disc"), ("DIWALI2000", "disc"), ("FREESHIP", "ship"), ("TESTBAD", "invalid")])
    def test_coupons(self, sofa, code, expect):
        r = requests.post(f"{API}/cart/price", json={"items": [{"product_id": sofa["id"], "qty": 1}], "coupon": code, "pincode": "400001"})
        d = r.json()
        assert r.status_code == 200
        if expect == "disc":
            assert d["discount"] > 0 and d["coupon"] == code
        elif expect == "ship":
            assert d["delivery"] == 0 and d["coupon"] == code
        else:
            assert d["discount"] == 0 and d["coupon"] == "" and "Invalid" in d["coupon_msg"]
        assert d["total"] == round(d["subtotal"] - d["discount"] + d["delivery"], 2)


# ---- Auth ----
class TestAuth:
    def test_bad_login(self):
        r = requests.post(f"{API}/auth/staff/login", json={"email": "admin@mauli.com", "password": "wrong"})
        assert r.status_code == 401

    def test_bad_otp(self):
        requests.post(f"{API}/auth/otp/send", json={"phone": "9876500003"})
        r = requests.post(f"{API}/auth/otp/verify", json={"phone": "9876500003", "otp": "000000"})
        assert r.status_code == 400

    def test_me(self, customer):
        d = requests.get(f"{API}/auth/me", headers=H(customer)).json()
        assert d["phone"].endswith("9999999999") and "password_hash" not in d

    def test_rbac_staff(self, staff):
        assert requests.get(f"{API}/admin/reports/sales", headers=H(staff)).status_code == 403
        assert requests.put(f"{API}/admin/settings", json={}, headers=H(staff)).status_code == 403

    def test_rbac_customer_forbidden(self, customer):
        assert requests.get(f"{API}/admin/orders", headers=H(customer)).status_code == 403

    def test_delete_account_new_user(self):
        requests.post(f"{API}/auth/otp/send", json={"phone": "9876500001"})
        t = requests.post(f"{API}/auth/otp/verify", json={"phone": "9876500001", "otp": "123456"}).json()["token"]
        assert requests.delete(f"{API}/auth/me", headers=H(t)).status_code == 200
        assert requests.get(f"{API}/auth/me", headers=H(t)).status_code == 401


# ---- Orders lifecycle ----
class TestOrders:
    def test_razorpay_demo_and_cancel_restock(self, sofa, customer):
        before = requests.get(f"{API}/products/{SOFA_SLUG}").json()
        before = before.get("product", before)["stock"]
        r = order([{"product_id": sofa["id"], "qty": 1}], "razorpay", "WELCOME10", customer)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment"]["mode"] == "demo"
        oid = d["order"]["id"]
        assert requests.post(f"{API}/orders/{oid}/pay/demo").status_code == 200
        o = requests.get(f"{API}/orders/{oid}", headers=H(customer)).json()
        assert o["payment_status"] == "paid" and o["status"] == "confirmed"
        assert requests.get(f"{API}/orders/{oid}/invoice", headers=H(customer)).content[:4] == b"%PDF"
        assert requests.post(f"{API}/orders/{oid}/cancel", headers=H(customer)).status_code == 200
        after = requests.get(f"{API}/products/{SOFA_SLUG}").json()
        assert after.get("product", after)["stock"] == before
        o = requests.get(f"{API}/orders/{oid}", headers=H(customer)).json()
        assert o["status"] == "cancelled" and o["payment_status"] == "refund_pending"

    def test_guest_order_access_by_phone(self, sofa):
        r = order([{"product_id": sofa["id"], "qty": 1}], "cod")
        assert r.status_code == 200
        oid = r.json()["order"]["id"]
        assert requests.get(f"{API}/orders/{oid}").status_code == 403
        assert requests.get(f"{API}/orders/{oid}", params={"phone": ADDR["phone"]}).status_code == 200
        requests.post(f"{API}/orders/{oid}/cancel", params={"phone": ADDR["phone"]})

    def test_unserviceable(self, sofa):
        r = order([{"product_id": sofa["id"], "qty": 1}], "cod", pincode="110001")
        assert r.status_code == 400

    def test_admin_status_return_flow(self, sofa, customer, owner, delivery):
        oid = order([{"product_id": sofa["id"], "qty": 1}], "cod", token=customer).json()["order"]["id"]
        # unassigned order hidden from delivery; assign then delivery cannot mark packed
        assert requests.put(f"{API}/admin/orders/{oid}/status", json={"status": "packed"}, headers=H(delivery)).status_code == 404
        did = requests.get(f"{API}/auth/me", headers=H(delivery)).json()["id"]
        assert requests.put(f"{API}/admin/orders/{oid}", json={"assigned_to": did, "notes": "TEST_note"}, headers=H(owner)).json()["assigned_to"] == did
        assert requests.put(f"{API}/admin/orders/{oid}/status", json={"status": "packed"}, headers=H(delivery)).status_code == 403
        for s in ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"]:
            assert requests.put(f"{API}/admin/orders/{oid}/status", json={"status": s}, headers=H(owner)).status_code == 200
        o = requests.get(f"{API}/admin/orders/{oid}", headers=H(owner)).json()
        o = o.get("order", o)
        assert o["payment_status"] == "paid"
        assert requests.get(f"{API}/admin/orders/{oid}/packing-slip", headers=H(owner)).content[:4] == b"%PDF"
        assert requests.post(f"{API}/orders/{oid}/return", json={"type": "return", "reason": "TEST_damaged"}, headers=H(customer)).status_code == 200
        st0 = requests.get(f"{API}/products/{SOFA_SLUG}").json()
        st0 = st0.get("product", st0)["stock"]
        assert requests.post(f"{API}/admin/orders/{oid}/return/approved", headers=H(owner)).status_code == 200
        assert requests.post(f"{API}/admin/orders/{oid}/return/refunded", headers=H(owner)).status_code == 200
        st1 = requests.get(f"{API}/products/{SOFA_SLUG}").json()
        assert st1.get("product", st1)["stock"] == st0 + 1
        # approving the same return twice must not restock twice
        requests.post(f"{API}/admin/orders/{oid}/return/approved", headers=H(owner))
        st2 = requests.get(f"{API}/products/{SOFA_SLUG}").json()
        assert st2.get("product", st2)["stock"] == st0 + 1, "double restock on repeated return approval"
        logs = requests.get(f"{API}/admin/notification-logs", headers=H(owner)).json()
        assert len(logs) > 0

    def test_cancelled_order_cannot_be_reopened(self, sofa, owner):
        """Business-rule check: cancelled (restocked) order should not move back to shipped/delivered"""
        oid = order([{"product_id": sofa["id"], "qty": 1}], "cod").json()["order"]["id"]
        requests.put(f"{API}/admin/orders/{oid}/status", json={"status": "cancelled"}, headers=H(owner))
        r = requests.put(f"{API}/admin/orders/{oid}/status", json={"status": "delivered"}, headers=H(owner))
        assert r.status_code == 400, "cancelled order was moved to delivered (stock already restocked)"


# ---- Admin products / inventory / POS / CRUD ----
class TestAdmin:
    def test_dashboard_reports(self, owner):
        assert requests.get(f"{API}/admin/dashboard", headers=H(owner)).status_code == 200
        for k in ["sales", "stock", "profit", "customers", "gst"]:
            r = requests.get(f"{API}/admin/reports/{k}", headers=H(owner))
            print(k, r.status_code)

    def test_product_crud_stock_pos(self, owner):
        body = {"name": "TEST_Chair Pytest", "category": "chairs", "sku": "TEST-PY-001", "price": 1000, "mrp": 1500, "purchase_price": 600, "gst": 18, "stock": 5}
        r = requests.post(f"{API}/admin/products", json=body, headers=H(owner))
        assert r.status_code == 200, r.text
        p = r.json()
        pid = p["id"]
        try:
            assert requests.post(f"{API}/admin/stock/adjust", json={"product_id": pid, "type": "out", "qty": 10, "note": "TEST"}, headers=H(owner)).status_code == 400
            r = requests.post(f"{API}/admin/stock/adjust", json={"product_id": pid, "type": "in", "qty": 3, "note": "TEST"}, headers=H(owner))
            assert r.status_code == 200 and r.json()["stock"] == 8, r.text
            r = requests.post(f"{API}/admin/pos/sale", json={"items": [{"product_id": pid, "qty": 2}], "payment_mode": "cash", "discount": 100}, headers=H(owner))
            assert r.status_code == 200 and r.json()["total"] == 1900
            g = requests.get(f"{API}/admin/products/{pid}", headers=H(owner)).json()
            assert g["stock"] == 6
            assert requests.get(f"{API}/admin/products/code/TEST-PY-001", headers=H(owner)).status_code == 200
            assert requests.post(f"{API}/admin/pos/sale", json={"items": [{"product_id": pid, "qty": 99}], "payment_mode": "cash"}, headers=H(owner)).status_code == 400
        finally:
            assert requests.delete(f"{API}/admin/products/{pid}", headers=H(owner)).status_code == 200
        g = requests.get(f"{API}/admin/products/{pid}", headers=H(owner))
        print("after delete", g.status_code, g.text[:100])

    def test_template_and_bulk_upload(self, owner):
        r = requests.get(f"{API}/admin/products-template", headers=H(owner))
        assert r.status_code == 200
        print("template ctype", r.headers.get("content-type"))

    def test_coupon_crud(self, owner):
        r = requests.post(f"{API}/admin/c/coupons", json={"code": "testpy5", "type": "percent", "value": 5, "min_order": 0, "active": True, "public": False}, headers=H(owner))
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["code"] == "TESTPY5"
        r = requests.put(f"{API}/admin/c/coupons/{cid}", json={"value": 7}, headers=H(owner))
        assert r.json()["value"] == 7
        assert requests.delete(f"{API}/admin/c/coupons/{cid}", headers=H(owner)).status_code == 200
        assert not any(c["id"] == cid for c in requests.get(f"{API}/admin/c/coupons", headers=H(owner)).json())

    def test_unknown_collection(self, owner):
        assert requests.get(f"{API}/admin/c/users", headers=H(owner)).status_code == 404
