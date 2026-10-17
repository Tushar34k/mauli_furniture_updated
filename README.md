# माऊली फर्निचर मॉल — Mauli Furniture Mall

Full e-commerce storefront (PWA, Play-Store ready) + inventory/admin panel + REST API, from one codebase.

| Part | Path | Tech |
|---|---|---|
| Customer storefront (PWA) | `/` | React 19, Tailwind, shadcn/ui |
| Admin panel | `/admin` | same React app, role-based |
| REST API | `/api/*` (Swagger: `/api/docs`) | FastAPI + MongoDB (Motor) |

## Demo logins (TEST MODE)
| Role | Login | Password / OTP |
|---|---|---|
| Owner | admin@mauli.com | Admin@123 |
| Owner (you) | tusharkokane366@gmail.com | Admin@123 |
| Manager | manager@mauli.com | Manager@123 |
| Staff | staff@mauli.com | Staff@123 |
| Delivery | delivery@mauli.com | Delivery@123 |
| Customer | phone 9999999999 | OTP 123456 |

Admin login: `https://<your-domain>/admin/login`. With `OTP_MODE=test` any phone number works with OTP **123456**. Coupons: WELCOME10, DIWALI2000, FREESHIP.

### How to change the admin password
1. Log in to `/admin` → **Change Password** (sidebar). After this the `.env` password is no longer re-applied.
2. Or change `ADMIN_PASSWORD` in `backend/.env` and restart the backend (only until changed from the UI).
3. The Owner can reset any staff password in **Settings & Staff → Reset password**.

## Run locally
```bash
cd backend && cp .env.example .env && pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
cd frontend && cp .env.example .env   # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install && yarn start
```
First start seeds (only if products collection is empty): settings, 10 categories, 44 products (images saved to `backend/uploads/seed`), brands, banners, coupons, 69 delivery pincodes, slots, legal pages, blogs, reviews, 8 sample orders and demo users.

## Deploy
- **Emergent**: press *Deploy* — frontend, backend and MongoDB hosted together with HTTPS.
- **Self-host**: `yarn build` → serve `build/` on a CDN/static host with SPA fallback to `index.html`; backend `uvicorn server:app --workers 2` behind Nginx/Caddy (HTTPS); MongoDB Atlas; route `/api/*` to the backend; set `CORS_ORIGINS`. Persist `backend/uploads/` or switch `STORAGE_BACKEND`.

## Mock / test-mode integrations
- OTP: `OTP_MODE=test` (fixed 123456). MSG91/Twilio code ready in `backend/notify.py`.
- Payments: Razorpay placeholder keys → **Demo Payment** screen marks orders paid. Real keys → real Razorpay checkout + signature verification.
- SMS / WhatsApp / Email / Push: **MOCKED** — logged to server log and Admin › Notifications log.
- Storage: local disk (`backend/uploads`).

## Docs
`docs/API.md` (API reference) · `docs/ADMIN_GUIDE.md` · `docs/PLAYSTORE.md` (TWA/Capacitor, AAB, assetlinks, listing text EN+MR, screenshots, data safety) · `GO_LIVE_CHECKLIST.md` (all values + keys to replace).
