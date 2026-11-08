"""Iteration 3: verify fixes from iteration 2 (razorpay rollback, page parsing, POS/stock races, payment_status perms, suggest, questions)."""
import threading
import requests
from conftest import API, H, mdb
from test_mauli_prod import ADDR, order, stock


def _staff(owner_token, created, role):
    email = f"test_{role}_iter3@example.com"
    mdb.users.delete_many({"email": email})
    r = requests.post(f"{API}/admin/staff", headers=H(owner_token), json={"name": f"TEST_{role}3", "email": email, "role": role, "password": "Temp#12345"})
    assert r.status_code == 200, r.text
    u = mdb.users.find_one({"email": email})
    created["users"].append(u["id"])
    tok = requests.post(f"{API}/auth/staff/login", json={"email": email, "password": "Temp#12345"}).json()["token"]
    assert requests.post(f"{API}/auth/change-password", headers=H(tok), json={"old_password": "Temp#12345", "new_password": "Temp#99999"}).status_code == 200
    return tok


class TestIter3Fixes:
    # Razorpay not configured -> 400, no stock leak, no movement
    def test_razorpay_no_stock_leak(self, test_product):
        p = test_product(stock=2)
        before = mdb.stock_movements.count_documents({"product_id": p["id"]})
        r = order(p, "razorpay")
        assert r.status_code == 400, r.text
        assert stock(p["id"]) == 2
        assert mdb.stock_movements.count_documents({"product_id": p["id"]}) == before

    # page/limit parsing
    def test_page_limit_400(self):
        for qs in ("page=abc", "limit=x"):
            r = requests.get(f"{API}/products?{qs}")
            assert r.status_code == 400, (qs, r.status_code)
            assert "number" in r.json()["detail"]
        assert requests.get(f"{API}/products?page=1&limit=5").status_code == 200

    # POS race on last unit
    def test_pos_race(self, owner_token, test_product, created):
        p = test_product(stock=1)
        res = []
        def go():
            res.append(requests.post(f"{API}/admin/pos/sale", headers=H(owner_token), json={"items": [{"product_id": p["id"], "qty": 1}], "payment_mode": "cash"}))
        ts = [threading.Thread(target=go) for _ in range(4)]
        [t.start() for t in ts]; [t.join() for t in ts]
        ok = [r for r in res if r.status_code == 200]
        for r in ok:
            created["orders"].append(r.json()["id"])
        assert len(ok) == 1, [r.status_code for r in res]
        assert all(r.status_code == 400 for r in res if r.status_code != 200)
        assert stock(p["id"]) == 0

    # concurrent stock out/damage
    def test_stock_adjust_race(self, owner_token, test_product):
        p = test_product(stock=3)
        res = []
        def go(t):
            res.append(requests.post(f"{API}/admin/stock/adjust", headers=H(owner_token), json={"product_id": p["id"], "qty": 2, "type": t}))
        ts = [threading.Thread(target=go, args=(t,)) for t in ("out", "damage", "out", "damage")]
        [t.start() for t in ts]; [t.join() for t in ts]
        codes = sorted(r.status_code for r in res)
        assert codes == [200, 400, 400, 400], codes
        assert stock(p["id"]) == 1

    # payment_status permission
    def test_payment_status_roles(self, owner_token, test_product, created):
        p = test_product(stock=3)
        o = order(p).json()["order"]; created["orders"].append(o["id"])
        stok = _staff(owner_token, created, "staff")
        r = requests.put(f"{API}/admin/orders/{o['id']}", headers=H(stok), json={"payment_status": "paid"})
        assert r.status_code == 403
        assert mdb.orders.find_one({"id": o["id"]})["payment_status"] == "pending"
        assert requests.put(f"{API}/admin/orders/{o['id']}", headers=H(stok), json={"notes": "TEST staff note"}).status_code == 200
        mtok = _staff(owner_token, created, "manager")
        r = requests.put(f"{API}/admin/orders/{o['id']}", headers=H(mtok), json={"payment_status": "paid"})
        assert r.status_code == 200 and r.json()["payment_status"] == "paid"
        r = requests.put(f"{API}/admin/orders/{o['id']}", headers=H(owner_token), json={"payment_status": "pending"})
        assert r.status_code == 200 and r.json()["payment_status"] == "pending"
        assert requests.put(f"{API}/admin/orders/nonexistent123", headers=H(owner_token), json={"notes": "x"}).status_code == 404

    # suggest with product without images
    def test_suggest_no_images(self, owner_token, created):
        r = requests.post(f"{API}/admin/products", headers=H(owner_token), json={"name": "TEST_Zzyxwq Noimg Stool", "category": "office", "price": 1000, "mrp": 1500, "stock": 1, "images": []})
        assert r.status_code == 200, r.text
        created["products"].append(r.json()["id"])
        s = requests.get(f"{API}/products/suggest?q=Zzyxwq")
        assert s.status_code == 200, s.text
        hit = [x for x in s.json()["products"] if x["slug"] == r.json()["slug"]]
        assert hit and hit[0]["image"] == ""
        assert requests.get(f"{API}/products?q=Zzyxwq").status_code == 200
        assert requests.get(f"{API}/products/{r.json()['slug']}").status_code == 200

    # question on unknown product
    def test_question_unknown_404(self):
        r = requests.post(f"{API}/products/nonexistent999/questions", json={"name": "TEST_q", "question": "TEST does this exist?"})
        assert r.status_code == 404
        assert mdb.questions.count_documents({"product_id": "nonexistent999"}) == 0

    # price > mrp validation
    def test_price_gt_mrp(self, owner_token, created):
        r = requests.post(f"{API}/admin/products", headers=H(owner_token), json={"name": "TEST_BadPrice", "category": "office", "price": 2000, "mrp": 1000, "stock": 1, "images": []})
        if r.status_code == 200:
            created["products"].append(r.json()["id"])
        assert r.status_code in (400, 422), r.status_code
