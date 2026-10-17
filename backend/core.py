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


async def save_upload(f: UploadFile, folder: str = 'media') -> str:
    data = await f.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8MB)")
    backend = os.environ.get('STORAGE_BACKEND', 'local')
    if backend != 'local':
        raise HTTPException(500, f"Storage backend '{backend}' not configured. See GO_LIVE_CHECKLIST.md")
    d = UPLOAD_DIR / folder
    d.mkdir(exist_ok=True, parents=True)
    ct = (f.content_type or '')
    if ct.startswith('image/'):
        try:
            img = Image.open(io.BytesIO(data)).convert('RGB')
        except Exception:
            raise HTTPException(400, "Invalid image file")
        img.thumbnail((1400, 1400))
        name = f"{uid()}.jpg"
        img.save(d / name, 'JPEG', quality=82, optimize=True)
    else:
        ext = Path(f.filename or 'file').suffix[:6] or '.bin'
        name = f"{uid()}{ext}"
        (d / name).write_bytes(data)
    return f"/api/uploads/{folder}/{name}"


_hits = defaultdict(list)


def rate_limit(key: str, limit: int, window: int = 60):
    t = time.time()
    _hits[key] = [x for x in _hits[key] if t - x < window]
    if len(_hits[key]) >= limit:
        raise HTTPException(429, "Too many requests. Please try again later.")
    _hits[key].append(t)


def client_ip(request: Request) -> str:
    return (request.headers.get('x-forwarded-for') or (request.client.host if request.client else '')).split(',')[0].strip()
