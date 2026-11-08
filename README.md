# Mauli Furniture Mall — Storefront + Inventory Admin

One codebase: customer storefront (PWA, Play-Store ready) at `/`, admin panel at `/admin`, REST API at `/api` (Swagger `/api/docs`, health `/api/health`). React 19 + Tailwind · FastAPI · MongoDB.

## First-run setup (production)
1. Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`; fill values (see GO_LIVE_CHECKLIST.md).
2. Set `OWNER_EMAIL` and `OWNER_PASSWORD`. On first start the API creates **one Owner** (only if no owner exists), default categories, settings and indexes — no demo data.
3. Open `/admin/login`, sign in as Owner → you are forced to set a new password. Then remove `OWNER_PASSWORD` from .env.
4. Fill **Admin › Settings** (shop details, GST, logo, map, invoice footer, social links) and check **Admin › Integrations**.

## Adding staff
Admin › Settings & Staff → name, email, temporary password, role (Manager / Staff / Delivery / Owner) → Add. New staff must change the password on first login. Owner can reset passwords or deactivate staff there.

## Development only
`APP_ENV=development python backend/seed_demo.py` seeds full demo data (refuses to run unless APP_ENV=development; generated passwords are printed to the console). `python backend/seed_demo.py --products-only` adds sample catalogue products only.

## Run locally
```bash
cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8001 --reload
cd frontend && yarn install && yarn start
```

## Deploy
- **Emergent**: press Deploy (HTTPS, managed MongoDB).
- **Self-host**: `yarn build` → static host/CDN with SPA fallback; backend `uvicorn server:app --workers 2` behind Nginx/Caddy with HTTPS; route `/api/*` to backend; MongoDB Atlas.

## Backup
MongoDB Atlas Cloud Backup (recommended) or nightly `mongodump` (see GO_LIVE_CHECKLIST.md §3). Owner can export products/orders/customers/stock history/enquiries to Excel from **Admin › Integrations › Data export**.

## Integrations
Every integration shows "Connected" / "Not configured" in Admin › Integrations with the exact .env keys (English + Marathi). Missing keys never fake success: the feature is hidden for customers (OTP login, online payment, photo upload) or the message is logged as "skipped".

Docs: `docs/API.md`, `docs/ADMIN_GUIDE.md`, `docs/PLAYSTORE.md`, `GO_LIVE_CHECKLIST.md`.
