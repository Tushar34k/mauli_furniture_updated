from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / '.env')

import os
import io
import uuid
import time
import jwt
import bcrypt
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
UPLOAD_DIR = ROOT / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
STAFF_ROLES = ['owner', 'manager', 'staff', 'delivery']
JWT_ALG = 'HS256'


def now():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return uuid.uuid4().hex[:12]


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def make_token(user: dict) -> str:
    payload = {"sub": user['id'], "role": user['role'], "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=int(os.environ.get('JWT_DAYS', '7')))}
    return jwt.encode(payload, os.environ['JWT_SECRET'], algorithm=JWT_ALG)


def public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ('_id', 'password_hash')}


async def optional_user(request: Request):
    auth = request.headers.get('Authorization', '')
    token = auth[7:] if auth.startswith('Bearer ') else request.query_params.get('token')
    if not token:
        return None
    try:
        payload = jwt.decode(token, os.environ['JWT_SECRET'], algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        return None
    return await db.users.find_one({"id": payload['sub'], "deleted": {"$ne": True}}, {"_id": 0, "password_hash": 0})


async def get_user(request: Request):
    u = await optional_user(request)
    if not u:
        raise HTTPException(401, "Not authenticated")
    return u


def require(*roles):
    allowed = roles or tuple(STAFF_ROLES)

    async def dep(request: Request):
        u = await get_user(request)
        if u['role'] not in allowed:
            raise HTTPException(403, "Permission denied")
        if u.get('must_change_password') and not request.url.path.endswith('/auth/change-password'):
            raise HTTPException(403, "PASSWORD_CHANGE_REQUIRED")
        return u
    return dep


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "shop"}, {"_id": 0})
    return s or {}


def razorpay_keys(s: dict):
    kid = s.get('razorpay_key_id') or os.environ.get('RAZORPAY_KEY_ID', '')
    sec = s.get('razorpay_key_secret') or os.environ.get('RAZORPAY_KEY_SECRET', '')
    if not kid or 'placeholder' in kid.lower() or not sec or 'placeholder' in sec.lower():
        return None, None
    return kid, sec


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}


async def save_upload(f: UploadFile, folder: str = 'media') -> str:
    from integrations import store_file
    data = await f.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8MB)")
    ct = (f.content_type or '')
    if ct not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPG, PNG, WEBP, GIF images or PDF files are allowed")
    if ct.startswith('image/'):
        try:
            img = Image.open(io.BytesIO(data))
            img.verify()
            img = Image.open(io.BytesIO(data)).convert('RGB')
        except Exception:
            raise HTTPException(400, "Invalid image file")
        img.thumbnail((1400, 1400))
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=82, optimize=True)
        data, ct, name = buf.getvalue(), 'image/jpeg', f"{uid()}.jpg"
    else:
        if not data.startswith(b'%PDF'):
            raise HTTPException(400, "Invalid PDF file")
        name = f"{uid()}.pdf"
    try:
        return await store_file(data, name, ct, folder)
    except RuntimeError as e:
        raise HTTPException(503, f"{e}. Admin > Integrations / स्टोरेज सेट केलेले नाही.")


_hits = defaultdict(list)


def rate_limit(key: str, limit: int, window: int = 60):
    t = time.time()
    _hits[key] = [x for x in _hits[key] if t - x < window]
    if len(_hits[key]) >= limit:
        raise HTTPException(429, "Too many requests. Please try again later.")
    _hits[key].append(t)


def client_ip(request: Request) -> str:
    return (request.headers.get('x-forwarded-for') or (request.client.host if request.client else '')).split(',')[0].strip()
