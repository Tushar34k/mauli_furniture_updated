# GO LIVE CHECKLIST

Everything replaceable lives in **two places only**: `backend/.env` (+ `frontend/.env`) and **Admin › Settings**.

## 1. API keys / accounts you need to provide
| Service | Why | Where to get it | Put it in |
|---|---|---|---|
| Razorpay Key ID + Secret | Online payments (UPI, cards, net banking, wallets, EMI) | dashboard.razorpay.com → Settings → API Keys (needs KYC; requires the legal pages already included) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in .env **or** Admin › Settings › Payment keys |
| SMS / OTP provider: MSG91 (recommended for India, needs DLT template) or Twilio | Real OTP login + SMS order updates | msg91.com → Auth key + Flow template ID / twilio.com → Account SID, Auth Token, From number | `OTP_MODE=live`, `SMS_MODE=live`, `SMS_PROVIDER=msg91|twilio`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` or `TWILIO_*` |
| Firebase Cloud Messaging | Push notifications in the Android app | console.firebase.google.com → Project settings → Cloud Messaging; download `google-services.json` for Capacitor | `FCM_SERVER_KEY` (+ `android/app/google-services.json`) |
| WhatsApp Business API (optional) | WhatsApp order updates | Meta Business / Gupshup / Interakt | add provider code in `backend/notify.py` (`send()` already routes the `whatsapp` channel) |
| Email (optional) | Order emails | Resend / SendGrid | `backend/notify.py` `email` channel |
| Google Maps | Showroom map | maps.google.com → Share → Embed a map → copy `src` URL (no key needed for embed) | Admin › Settings › Google Maps embed URL |
| Google Analytics 4 | Analytics | analytics.google.com → Measurement ID `G-XXXX` | `REACT_APP_GA_ID` in `frontend/.env` |
| Cloud storage (optional) | Product images on CDN | Cloudinary or AWS S3 | `STORAGE_BACKEND=cloudinary|s3` + implement in `core.save_upload` |
| Google login | Customer social login | Already works via Emergent-managed Google Auth | — |

## 2. backend/.env — replace for production
- [ ] `DB_NAME` / `MONGO_URL` — production database (e.g. MongoDB Atlas)
- [ ] `JWT_SECRET` — new random 64-char hex (`python -c "import secrets;print(secrets.token_hex(32))"`)
- [ ] `ADMIN_EMAIL`, `ADMIN_PASSWORD` — real owner login (then change password from Admin › Change Password)
- [ ] `CORS_ORIGINS` — your exact domain(s), comma-separated (not `*`)
- [ ] `FRONTEND_URL` — public site URL (used by sitemap)
- [ ] `OTP_MODE=live`, `SMS_MODE=live` + SMS provider keys
- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (live keys `rzp_live_...`). Demo payment is automatically disabled once valid keys exist.
- [ ] `FCM_SERVER_KEY`
- [ ] `SHOP_*` values (only used on first seed; afterwards edit in Admin › Settings)
- [ ] Remove demo accounts (manager/staff/delivery@mauli.com, phone 9999999999) or change their passwords in Admin › Settings & Staff

## 3. Admin › Settings — replace
- [ ] Shop name, address, phone, WhatsApp (format `91XXXXXXXXXX`), email, **GST number**, timings
- [ ] Google Maps embed URL, logo URL, invoice prefix & terms
- [ ] Free-delivery threshold, default delivery charge, COD limit
- [ ] Social links
- [ ] Homepage sections order/visibility

## 4. Content — replace
- [ ] Logo: replace `frontend/public/logo.svg`, `frontend/public/icons/*.png` (192, 512, maskable-192/512, apple-touch-icon) and `backend/assets/logo.png` (invoices) with the real Mauli logo. **Placeholder logo currently used — the original logo file was not received.**
- [ ] Product photos: Admin › Products › Edit › Images (upload). Seed images are free Unsplash/Pexels photos.
- [ ] Banners, categories images, coupons, delivery pincodes & charges, slots (Admin › Catalog & Store)
- [ ] Legal pages: Admin › Catalog & Store › Legal / info pages — replace `[DATE]` and review with your CA/lawyer
- [ ] `frontend/public/.well-known/assetlinks.json` — SHA-256 fingerprint from Play Console
- [ ] `frontend/capacitor.config.json` — `server.url` = your domain

## 5. Final checks
- [ ] HTTPS on both frontend and API
- [ ] Place one live ₹1 test order with Razorpay live keys, then refund it
- [ ] Lighthouse (mobile) ≥ 90: serve `yarn build` output with gzip/brotli + CDN caching
- [ ] Submit `/api/sitemap.xml` in Google Search Console
