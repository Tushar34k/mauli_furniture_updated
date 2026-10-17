import os
import re
import random
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from core import db, uid, now, hash_pw, verify_pw, make_token, public_user, get_user, require, rate_limit, client_ip
import notify

router = APIRouter(prefix="/api/auth")


class StaffLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class OtpSend(BaseModel):
    phone: str


class OtpVerify(BaseModel):
    phone: str
    otp: str = Field(min_length=4, max_length=8)
    name: Optional[str] = None


class GoogleSession(BaseModel):
    session_id: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    email: Optional[EmailStr] = None


class ChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


def norm_phone(p: str) -> str:
    d = re.sub(r"\D", "", p)[-10:]
    if not re.fullmatch(r"[6-9]\d{9}", d):
        raise HTTPException(400, "Enter a valid 10-digit Indian mobile number")
    return d


def auth_response(u):
    return {"token": make_token(u), "user": public_user(u)}


@router.post("/staff/login")
async def staff_login(body: StaffLogin, request: Request):
    rate_limit(f"login:{client_ip(request)}", 20)
    email = body.email.lower()
    ident = f"{client_ip(request)}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("until", "") > now():
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    u = await db.users.find_one({"email": email, "role": {"$ne": "customer"}}, {"_id": 0})
    if not u or not verify_pw(body.password, u.get("password_hash", "")):
        cnt = (att or {}).get("count", 0) + 1
        until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": cnt, "until": until}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    if not u.get("active", True):
        raise HTTPException(403, "Account disabled")
    await db.login_attempts.delete_one({"identifier": ident})
    return auth_response(u)


@router.post("/otp/send")
async def otp_send(body: OtpSend, request: Request):
    phone = norm_phone(body.phone)
    rate_limit(f"otp:{phone}", 5)
    rate_limit(f"otpip:{client_ip(request)}", 15)
    test = os.environ.get("OTP_MODE", "test") == "test"
    code = "123456" if test else f"{random.randint(0, 999999):06d}"
    await db.otps.delete_many({"phone": phone})
    await db.otps.insert_one({"phone": phone, "hash": hash_pw(code), "tries": 0, "created": datetime.now(timezone.utc)})
    if not test:
        os.environ["SMS_MODE"] = "live"
    await notify.send(["sms"], "OTP", f"{code} is your Mauli Furniture login OTP. Valid for 10 minutes.", phone=phone, event="otp")
    return {"sent": True, "test_mode": test, "hint": "Test mode: use OTP 123456" if test else None}


@router.post("/otp/verify")
async def otp_verify(body: OtpVerify):
    phone = norm_phone(body.phone)
    rec = await db.otps.find_one({"phone": phone})
    if not rec or rec["tries"] >= 5:
        raise HTTPException(400, "OTP expired. Please request a new one.")
    if not verify_pw(body.otp, rec["hash"]):
        await db.otps.update_one({"phone": phone}, {"$inc": {"tries": 1}})
        raise HTTPException(400, "Incorrect OTP")
    await db.otps.delete_many({"phone": phone})
    u = await db.users.find_one({"phone": phone, "role": "customer", "deleted": {"$ne": True}}, {"_id": 0})
    if not u:
        u = {"id": uid(), "phone": phone, "name": body.name or "", "email": "", "role": "customer", "addresses": [], "wishlist": [], "created_at": now()}
        await db.users.insert_one(dict(u))
        await notify.send(["inapp"], "स्वागत आहे! Welcome", "Use code WELCOME10 for 10% off your first order.", user_id=u["id"])
    return auth_response(u)


@router.post("/google")
async def google_session(body: GoogleSession):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Google login failed")
    d = r.json()
    email = d["email"].lower()
    u = await db.users.find_one({"email": email, "role": "customer", "deleted": {"$ne": True}}, {"_id": 0})
    if not u:
        u = {"id": uid(), "email": email, "name": d.get("name", ""), "picture": d.get("picture", ""), "phone": "", "role": "customer",
             "addresses": [], "wishlist": [], "created_at": now()}
        await db.users.insert_one(dict(u))
    return auth_response(u)


@router.get("/me")
async def me(user=Depends(get_user)):
    return user


@router.put("/me")
async def update_me(body: ProfileUpdate, user=Depends(get_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    return {**user, **upd}


@router.post("/change-password")
async def change_password(body: ChangePassword, user=Depends(require())):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_pw(body.old_password, full.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(body.new_password), "pw_changed": True}})
    return {"ok": True}


@router.delete("/me")
async def delete_account(user=Depends(get_user)):
    if user["role"] != "customer":
        raise HTTPException(400, "Staff accounts are managed by the owner")
    await db.users.update_one({"id": user["id"]}, {"$set": {"deleted": True, "name": "Deleted User", "email": "", "phone": f"deleted-{uid()}",
                                                          "addresses": [], "wishlist": [], "deleted_at": now()}})
    await db.notifications.delete_many({"user_id": user["id"]})
    await db.price_alerts.delete_many({"user_id": user["id"]})
    return {"ok": True}
