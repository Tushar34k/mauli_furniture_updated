from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from core import db, uid, now, get_user, optional_user, save_upload, rate_limit, client_ip

router = APIRouter(prefix="/api")


class Address(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    line1: str = Field(min_length=3, max_length=200)
    line2: Optional[str] = ""
    city: str = Field(min_length=2, max_length=60)
    state: str = "Maharashtra"
    pincode: str = Field(pattern=r"^\d{6}$")
    default: bool = False


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=3, max_length=1500)
    photos: List[str] = []


class QuestionIn(BaseModel):
    question: str = Field(min_length=5, max_length=500)
    name: Optional[str] = "Customer"


@router.get("/account/addresses")
async def list_addresses(user=Depends(get_user)):
    return user.get("addresses", [])


@router.post("/account/addresses")
async def add_address(a: Address, user=Depends(get_user)):
    addrs = user.get("addresses", [])
    d = {"id": uid(), **a.model_dump()}
    if d["default"] or not addrs:
        d["default"] = True
        for x in addrs:
            x["default"] = False
    addrs.append(d)
    await db.users.update_one({"id": user["id"]}, {"$set": {"addresses": addrs}})
    return addrs


@router.put("/account/addresses/{aid}")
async def edit_address(aid: str, a: Address, user=Depends(get_user)):
    addrs = user.get("addresses", [])
    for i, x in enumerate(addrs):
        if a.default:
            x["default"] = False
        if x["id"] == aid:
            addrs[i] = {"id": aid, **a.model_dump()}
    await db.users.update_one({"id": user["id"]}, {"$set": {"addresses": addrs}})
    return addrs


@router.delete("/account/addresses/{aid}")
async def del_address(aid: str, user=Depends(get_user)):
    addrs = [x for x in user.get("addresses", []) if x["id"] != aid]
    await db.users.update_one({"id": user["id"]}, {"$set": {"addresses": addrs}})
    return addrs


@router.get("/account/wishlist")
async def wishlist(user=Depends(get_user)):
    ids = user.get("wishlist", [])
    from routes_store import card, PUB
    prods = await db.products.find({"id": {"$in": ids}}, PUB).to_list(200)
    return {"ids": ids, "items": [card(p) for p in prods]}


@router.post("/account/wishlist/{pid}")
async def toggle_wishlist(pid: str, user=Depends(get_user)):
    ids = user.get("wishlist", [])
    ids = [x for x in ids if x != pid] if pid in ids else ids + [pid]
    await db.users.update_one({"id": user["id"]}, {"$set": {"wishlist": ids}})
    return {"ids": ids, "added": pid in ids}


@router.post("/account/price-alerts/{pid}")
async def price_alert(pid: str, user=Depends(get_user)):
    p = await db.products.find_one({"id": pid}, {"_id": 0, "price": 1, "name": 1})
    if not p:
        raise HTTPException(404, "Product not found")
    await db.price_alerts.update_one({"user_id": user["id"], "product_id": pid},
                                     {"$set": {"id": uid(), "user_id": user["id"], "product_id": pid, "name": p["name"], "price_at": p["price"], "created_at": now()}}, upsert=True)
    return {"ok": True}


@router.get("/account/price-alerts")
async def my_alerts(user=Depends(get_user)):
    return await db.price_alerts.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)


@router.get("/account/notifications")
async def notifications(user=Depends(get_user)):
    return await db.notifications.find({"user_id": {"$in": [user["id"], "all"]}}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("/account/notifications/read")
async def mark_read(user=Depends(get_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/account/push-token")
async def push_token(body: dict, user=Depends(get_user)):
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"fcm_tokens": str(body.get("token", ""))[:300]}})
    return {"ok": True}


@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_user)):
    return {"url": await save_upload(file, "user")}


@router.post("/products/{pid}/reviews")
async def add_review(pid: str, r: ReviewIn, user=Depends(get_user)):
    p = await db.products.find_one({"id": pid}, {"name": 1})
    if not p:
        raise HTTPException(404, "Product not found")
    await db.reviews.insert_one({"id": uid(), "product_id": pid, "product_name": p["name"], "user_id": user["id"], "name": user.get("name") or "Customer",
                                 **r.model_dump(), "status": "pending", "created_at": now()})
    return {"ok": True, "message": "Review submitted for approval"}


@router.post("/products/{pid}/questions")
async def ask_question(pid: str, q: QuestionIn, request: Request):
    rate_limit(f"q:{client_ip(request)}", 10)
    u = await optional_user(request)
    await db.questions.insert_one({"id": uid(), "product_id": pid, "name": (u or {}).get("name") or q.name, "question": q.question,
                                   "answer": "", "status": "pending", "created_at": now()})
    return {"ok": True}


@router.post("/enquiries")
async def enquiry(request: Request, name: str = Form(..., min_length=2, max_length=80), phone: str = Form(..., pattern=r"^[6-9]\d{9}$"),
                  furniture_type: str = Form(""), size: str = Form(""), budget: str = Form(""), description: str = Form("", max_length=2000),
                  photo: Optional[UploadFile] = File(None)):
    rate_limit(f"enq:{client_ip(request)}", 5)
    url = await save_upload(photo, "enquiries") if photo and photo.filename else ""
    u = await optional_user(request)
    await db.enquiries.insert_one({"id": uid(), "name": name, "phone": phone, "furniture_type": furniture_type, "size": size, "budget": budget,
                                   "description": description, "photo": url, "user_id": (u or {}).get("id"), "status": "new", "notes": "", "created_at": now()})
    return {"ok": True}
