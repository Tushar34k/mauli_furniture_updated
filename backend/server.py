from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
import os
import logging
from core import client, UPLOAD_DIR
from seed import run_seed
import routes_auth
import routes_store
import routes_account
import routes_orders
import routes_admin

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

app = FastAPI(title="Mauli Furniture Mall API", version="1.0", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url="/api/redoc")
for r in (routes_auth, routes_store, routes_account, routes_orders, routes_admin):
    app.include_router(r.router)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/api/")
async def root():
    return {"name": "Mauli Furniture Mall API", "status": "ok"}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "SAMEORIGIN"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith("/api/uploads/"):
        resp.headers["Cache-Control"] = "public, max-age=2592000"
    return resp


origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(GZipMiddleware, minimum_size=800)
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=origins != ['*'], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await run_seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
