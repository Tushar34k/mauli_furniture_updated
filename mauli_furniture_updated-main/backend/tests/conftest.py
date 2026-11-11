import os
import sys
import pytest
import requests
from pathlib import Path
from dotenv import dotenv_values
from pymongo import MongoClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
ENV = dotenv_values(BACKEND / ".env")
FE = dotenv_values(BACKEND.parent / "frontend" / ".env")
BASE_URL = FE["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"
OWNER_EMAIL = ENV["OWNER_EMAIL"]
NEW_OWNER_PW = "TestOwner#2026"
mdb = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
STATE = {"forced_change_verified": None}


def mint(uid, role="customer"):
    os.environ.setdefault("JWT_SECRET", ENV["JWT_SECRET"])
    import jwt
    from datetime import datetime, timezone, timedelta
    return jwt.encode({"sub": uid, "role": role, "type": "access", "exp": datetime.now(timezone.utc) + timedelta(days=1)}, ENV["JWT_SECRET"], algorithm="HS256")


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def owner_token():
    mdb.login_attempts.delete_many({})
    r = requests.post(f"{API}/auth/staff/login", json={"email": OWNER_EMAIL, "password": ENV["OWNER_PASSWORD"]})
    if r.status_code == 200:
        tok = r.json()["token"]
        assert r.json()["user"].get("must_change_password") is True
        g = requests.get(f"{API}/admin/dashboard", headers=H(tok))
        STATE["forced_change_verified"] = (g.status_code == 403 and "PASSWORD_CHANGE_REQUIRED" in g.text)
        c = requests.post(f"{API}/auth/change-password", headers=H(tok), json={"old_password": ENV["OWNER_PASSWORD"], "new_password": NEW_OWNER_PW})
        assert c.status_code == 200, c.text
        return tok
    r = requests.post(f"{API}/auth/staff/login", json={"email": OWNER_EMAIL, "password": NEW_OWNER_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def customers():
    """Two TEST_ customer docs + minted tokens; removed at session end."""
    ids = ["testcustA001", "testcustB001"]
    for i, cid in enumerate(ids):
        mdb.users.update_one({"id": cid}, {"$set": {"id": cid, "role": "customer", "name": f"TEST_Cust{i}", "email": f"test_cust{i}@example.com",
                                                   "phone": f"90000000{i}{i}", "addresses": [], "wishlist": [], "created_at": "2026-01-01"}}, upsert=True)
    yield [(cid, mint(cid)) for cid in ids]
    mdb.users.delete_many({"id": {"$in": ids}})
    mdb.notifications.delete_many({"user_id": {"$in": ids}})


@pytest.fixture(scope="session")
def created():
    """Track everything tests create for final cleanup by id."""
    d = {"products": [], "orders": [], "users": [], "c": [], "reviews": [], "enquiries": [], "questions": []}
    yield d
    if d["orders"]:
        nos = [o["order_no"] for o in mdb.orders.find({"id": {"$in": d["orders"]}})]
        mdb.orders.delete_many({"id": {"$in": d["orders"]}})
        mdb.stock_movements.delete_many({"ref": {"$in": nos}})
        mdb.notification_logs.delete_many({"message": {"$regex": "|".join(nos)}}) if nos else None
    if d["products"]:
        mdb.products.delete_many({"id": {"$in": d["products"]}})
        mdb.stock_movements.delete_many({"product_id": {"$in": d["products"]}})
        mdb.reviews.delete_many({"product_id": {"$in": d["products"]}})
        mdb.questions.delete_many({"product_id": {"$in": d["products"]}})
    if d["users"]:
        mdb.users.delete_many({"id": {"$in": d["users"]}})
    for col, did in d["c"]:
        mdb[col].delete_one({"id": did})
    if d["enquiries"]:
        mdb.enquiries.delete_many({"id": {"$in": d["enquiries"]}})


@pytest.fixture(scope="session")
def test_product(owner_token, created):
    def make(stock=5, price=5000, name="TEST_Chair"):
        r = requests.post(f"{API}/admin/products", headers=H(owner_token), json={"name": f"{name} {len(created['products'])}", "category": "office", "price": price, "mrp": price + 1000,
                                                                                  "stock": stock, "images": ["https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1"]})
        assert r.status_code == 200, r.text
        created["products"].append(r.json()["id"])
        return r.json()
    return make
