"""Setup/teardown helper for iteration-3 UI checks: python iter3_ui_setup.py setup|teardown"""
import sys, json, requests
from conftest import API, H, mdb, OWNER_EMAIL, NEW_OWNER_PW
from test_mauli_prod import order

F = "/tmp/iter3_ui.json"
if sys.argv[1] == "setup":
    tok = requests.post(f"{API}/auth/staff/login", json={"email": OWNER_EMAIL, "password": NEW_OWNER_PW}).json()["token"]
    p = requests.post(f"{API}/admin/products", headers=H(tok), json={"name": "TEST_UI Cancel Chair", "category": "office", "price": 3000, "mrp": 4000, "stock": 2, "images": []}).json()
    o = order(p).json()["order"]
    requests.put(f"{API}/admin/orders/{o['id']}/status", headers=H(tok), json={"status": "confirmed", "note": "TEST confirm"})
    requests.put(f"{API}/admin/orders/{o['id']}/status", headers=H(tok), json={"status": "cancelled", "note": "TEST cancel"})
    unrated = mdb.products.find_one({"active": True, "rating": {"$in": [0, None]}, "name": {"$not": {"$regex": "^TEST_"}}}, {"_id": 0, "slug": 1, "name": 1})
    sample = mdb.products.find_one({"active": True, "name": {"$not": {"$regex": "^TEST_"}}}, {"_id": 0, "slug": 1})
    d = {"tok": tok, "pid": p["id"], "oid": o["id"], "order_no": o["order_no"], "unrated": unrated, "sample": sample["slug"]}
    json.dump(d, open(F, "w")); print(json.dumps(d))
else:
    d = json.load(open(F))
    mdb.orders.delete_one({"id": d["oid"]})
    mdb.stock_movements.delete_many({"product_id": d["pid"]})
    mdb.products.delete_one({"id": d["pid"]})
    mdb.notification_logs.delete_many({"message": {"$regex": d["order_no"]}})
    print("cleaned")
