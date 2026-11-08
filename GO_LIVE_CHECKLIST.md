# GO LIVE CHECKLIST

All shop details live in **Admin › Settings** (database). All secrets live in **backend/.env** only. Status of every integration: **Admin › Integrations**.

## 1. Integrations (exact .env variables)
| Service | .env variables | Where to get keys | Without keys |
|---|---|---|---|
| SMS / OTP (MSG91 primary) | `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` (DLT-approved Flow template with variable `##otp##`/`##var##`) | msg91.com → Authkey; Flow → create template; DLT registration (Jio/Vi portal) | OTP login hidden; Google login only |
| SMS / OTP (Twilio optional) | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | console.twilio.com | same |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | dashboard.razorpay.com → Settings → API Keys; Webhooks → URL `https://<domain>/api/payments/razorpay/webhook`, events payment.captured, payment.failed, order.paid, refund.processed | Online payment hidden; COD + Pay at Store work |
| Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` (verified domain) | resend.com → API Keys + Domains | Emails skipped (logged as "skipped") |
| Email (SMTP alternative) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Gmail Workspace / Zoho / any SMTP | same |
| Push (FCM HTTP v1) | `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` (service-account JSON on one line) | Firebase console → Project settings → Service accounts → Generate key | Push skipped |
| WhatsApp Business (optional) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | developers.facebook.com → WhatsApp Cloud API | Click-to-chat links still work |
| Storage | `STORAGE_BACKEND=cloudinary` + `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — or `STORAGE_BACKEND=s3` + `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | cloudinary.com console / AWS IAM + S3 bucket (public-read objects or CloudFront) | Uploads disabled; paste image URLs |
| Google login | none (Emergent-managed) | — | works |
| Google Maps | Admin › Settings › "Google Maps embed URL" | maps.google.com → Share → Embed a map → copy `src` | Map hidden, address shown |
| Analytics | `REACT_APP_GA_ID` (frontend/.env) | analytics.google.com | off |

## 2. Before publishing
- [ ] `APP_ENV=production`, new `JWT_SECRET`, `CORS_ORIGINS` = exact domain, `FRONTEND_URL`
- [ ] Log in as Owner with `OWNER_PASSWORD`, set a new password (forced), then remove `OWNER_PASSWORD` from .env
- [ ] Admin › Settings: shop name (EN/MR), address, phone, WhatsApp, email, GST number, timings, logo URL, invoice prefix/footer, social links, map
- [ ] Replace sample products (44 placeholder products currently loaded on request) with your real catalogue or edit them; upload real photos
- [ ] Create staff/delivery users (Admin › Settings & Staff)
- [ ] Add coupons, banners, delivery pincodes & charges, delivery slots (Admin › Catalog & Store)
- [ ] Replace the placeholder logo files `frontend/public/logo.svg`, `frontend/public/icons/*`, `backend/assets/logo.png` with the real logo (the original logo file was never received)
- [ ] Review legal pages (auto-generated from Settings; customise in Catalog & Store › Legal pages)
- [ ] `frontend/public/.well-known/assetlinks.json` SHA-256 + `capacitor.config.json` server.url
- [ ] Place a ₹1 live Razorpay order, refund it from Admin › Orders

## 3. Backups
- MongoDB Atlas: enable Cloud Backup (daily snapshots, 7–30 day retention) — Cluster › Backup.
- Self-hosted: cron `0 2 * * * mongodump --uri "$MONGO_URL" --db $DB_NAME --gzip --archive=/backups/mfm-$(date +\%F).gz` and copy off-server.
- Manual: Admin › Integrations › Data export (products, orders, customers, stock history, enquiries as Excel).
