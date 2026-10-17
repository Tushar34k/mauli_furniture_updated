# PRD — माऊली फर्निचर मॉल (Mauli Furniture Mall)

## Original problem statement (customer's words, condensed headings kept)
Build a complete, production-ready, deployable e-commerce platform for "माऊली फर्निचर मॉल" (Mauli Furniture Mall), a real furniture showroom in Maharashtra, India. It should work like Flipkart/Pepperfry for furniture, with a full inventory system behind it. Use the uploaded logo in header, splash, login screens, invoices, emails and app icon.
1 PLATFORM: customer storefront (mobile-first PWA, packagable as Android TWA/Capacitor), admin panel, REST API + DB from one codebase; .env.example, seed data, deployment steps.
2 BRAND & UI: orange #E8671B, maroon #7A1F1F, yellow #F5B800, bg #FFFAF5, text #2B2B2B; logo top-left; Marathi default + English toggle (Mukta/Noto Devanagari + Poppins); premium rounded cards; bottom nav on mobile (Home, Categories, Search, Cart, Account); skeletons, empty states, toasts.
3 CUSTOMER: home (banners, 10 category icons, deals + countdown, new arrivals, best sellers, shop by room/price, reviews, WhatsApp), search (autosuggest, typo tolerance, voice, recent), listing filters/sort/grid-list/infinite scroll, product page (gallery zoom, video, variants, MRP/discount/GST, stock, specs, warranty, assembly, pincode, EMI, reviews w/ photos, Q&A, similar, FBT, share, wishlist), cart (qty, save for later, coupons, breakdown, pincode ETA), checkout (guest/login, saved addresses, slots, Razorpay + COD + pay at store, GST invoice PDF), auth (phone OTP, Google, JWT), account (profile, addresses, orders, tracking timeline, cancel/return/replace, invoice, wishlist, notifications, delete account), compare (3), recently viewed, price-drop alerts, custom furniture enquiry, showroom page, blog, share app, push/email/SMS/WhatsApp updates.
4 ADMIN: roles Owner/Manager/Staff/Delivery; dashboard; inventory (images, variants, SKU, barcode/QR, purchase/selling/MRP, GST, stock, reorder, supplier, location, bulk CSV/Excel, bulk edit, stock history, alerts, camera scanning, valuation); orders (filter, status, assign delivery, invoice, packing slip, returns/refunds, notes); POS; customers; categories, brands, banners, coupons, pincode delivery charges, slots, homepage sections; reviews moderation, enquiries, broadcast; reports (sales, GST, stock, profit, customers → Excel/PDF); settings.
5 NON-FUNCTIONAL: security, performance, SEO (meta, schema.org, sitemap), legal pages, analytics + error logging.
6 DATA: 10 categories, 40+ products, coupons, sample orders, demo admin admin@mauli.com / Admin@123.
7 PLAY STORE: manifest, SW, maskable icons, splash, offline page, TWA/Capacitor AAB steps, assetlinks, listing text EN+MR, screenshots, data-safety.
8 DELIVERABLES: live preview, README, API docs, admin guide, list of API keys.
9 TEST MODE (user): no questions; demo values; OTP 123456 (OTP_MODE=test); Razorpay placeholder → Demo Payment; Google/FCM/Maps/email/SMS/WhatsApp mock-logged + Admin Notification Log; Unsplash/Pexels images replaceable; local storage w/ switch; demo logins for 4 roles + customer 9999999999; change-password page; legal templates; GO LIVE CHECKLIST.

## Architecture
- Backend FastAPI (`/app/backend`): core.py (db, JWT, roles, upload, rate limit), routes_auth/store/account/orders/admin.py, reports.py (ReportLab invoices/reports, openpyxl), notify.py (mock/live SMS), seed.py + seed_data.py. Mongo collections use string `id` (uuid), `_id` never returned. Swagger at /api/docs.
- Frontend React 19 CRA + Tailwind + shadcn (`/app/frontend`): lazy-loaded pages, AppProvider context (lang, auth, cart, wishlist, compare, recent), admin under /admin with role-guarded routes. PWA: manifest.json, sw.js, offline.html, icons, assetlinks, capacitor.config.json.
- Auth: Bearer JWT (localStorage). Staff email/password (bcrypt, lockout), customer OTP, Emergent Google Auth.

## User personas
Walk-in/online furniture buyers in Maharashtra (Marathi-first); Owner; Manager; Showroom staff; Delivery staff.

## Implemented (2026-10-17)
- All 4 phases: auth + catalog + admin inventory; cart/checkout/payments(demo)/orders/invoices; POS + reports; notifications log, PWA, Play Store docs.
- Docs: README.md, GO_LIVE_CHECKLIST.md, docs/API.md, docs/ADMIN_GUIDE.md, docs/PLAYSTORE.md.
- Testing iteration 1: backend 29/29 passing after fixes (status-transition validation, idempotent return state machine, profile email, upload 400, razorpay_enabled, atomic stock, COD pincode, duplicate reviews, unserviceable delivery display, i18n gaps, admin route guards, FAB overlap).

## MOCKED / test mode
Razorpay (demo payment), OTP fixed 123456, SMS/WhatsApp/Email/Push (logged only), placeholder logo (original logo file was NOT received).

## Backlog
- P1: real logo files; Razorpay live keys; MSG91 DLT template; FCM native push via Capacitor; release stock for abandoned unpaid Razorpay orders (expiry job); IST-based report/dashboard dates.
- P2: shadcn calendar for delivery date; split routes_admin.py; S3/Cloudinary storage implementation; WhatsApp Business provider; email templates.

## Next tasks
Swap in real logo & photos, add live keys per GO_LIVE_CHECKLIST, build signed AAB.
