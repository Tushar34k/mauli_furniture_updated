# API Reference

Base URL: `${REACT_APP_BACKEND_URL}/api` · Interactive docs: `/api/docs` (Swagger) and `/api/redoc`.
Auth: `Authorization: Bearer <token>` (JWT, 7 days). Errors: `{"detail": "..."}`. Rate limited: login, OTP, orders, enquiries.

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /auth/otp/send | `{phone}` | real SMS via MSG91/Twilio; 503 if not configured; 60 s cooldown |
| POST | /auth/refresh | — | new token |
| POST | /auth/otp/verify | `{phone, otp, name?}` | → `{token, user}`; creates customer |
| POST | /auth/google | `{session_id}` | Emergent Google Auth exchange → `{token, user}` |
| POST | /auth/staff/login | `{email, password}` | staff/admin; 5 failures → 15 min lock |
| GET/PUT | /auth/me | `{name?, email?}` | profile |
| POST | /auth/change-password | `{old_password, new_password}` | staff |
| DELETE | /auth/me | — | delete customer account (Play Store requirement) |

## Catalog (public)
`GET /settings/public` · `GET /categories` · `GET /brands` · `GET /home` · `GET /slots` · `GET /coupons` · `GET /blogs` · `GET /blogs/{slug}` · `GET /pages/{slug}` · `GET /pincode/{pin}` · `GET /sitemap.xml`

`GET /products` query: `q, category (csv), room, material, color, brand (csv), min_price, max_price, rating, discount, in_stock=1, delivery_days, deal=1, ids, sort (popularity|newest|price_asc|price_desc|discount|rating), page, limit` → `{items, total, page, pages, facets}`

`GET /products/suggest?q=` → `{products, categories}` · `GET /products/{slug}` → `{product, similar, fbt, reviews, questions}`

## Cart, checkout & orders
| Method | Path | Notes |
|---|---|---|
| POST | /cart/price | `{items:[{product_id, qty, variant}], coupon, pincode, payment_method}` → totals, GST, delivery, ETA |
| POST | /orders | checkout (guest or logged in): `{items, coupon, address{name,phone,line1,line2,city,state,pincode}, email, slot, delivery_date, payment_method: razorpay|cod|store}` → `{order, payment}`; `payment.mode` = `razorpay` (key_id, rzp_order_id); razorpay rejected if keys missing |
| POST | /orders/{id}/pay/verify | Razorpay `{razorpay_payment_id, razorpay_order_id, razorpay_signature}` (HMAC verified) |
| POST | /orders/{id}/pay/retry | new Razorpay order for a pending payment |
| POST | /payments/razorpay/webhook | Razorpay webhook (X-Razorpay-Signature, RAZORPAY_WEBHOOK_SECRET) |
| GET | /health | DB health check |
| GET | /orders | my orders |
| GET | /orders/{id}?phone= | owner, staff, or guest with matching phone |
| POST | /orders/{id}/cancel | before shipping; restocks |
| POST | /orders/{id}/return | `{type: return|replace, reason}` |
| GET | /orders/{id}/invoice | GST invoice PDF |

## Account
`GET/POST /account/addresses`, `PUT/DELETE /account/addresses/{id}` · `GET /account/wishlist`, `POST /account/wishlist/{pid}` (toggle) · `GET /account/price-alerts`, `POST /account/price-alerts/{pid}` · `GET /account/notifications`, `POST /account/notifications/read` · `POST /account/push-token` · `POST /upload` (multipart `file`) · `POST /products/{id}/reviews` · `POST /products/{id}/questions` · `POST /enquiries` (multipart: name, phone, furniture_type, size, budget, description, photo)

## Admin (`/admin/*`, roles in brackets)
- `GET /dashboard` [owner, manager, staff]
- Products [o,m,s; delete/bulk = o,m]: `GET /products?q&category&stock=low|out&page`, `GET /products/{id}`, `GET /products/code/{barcode|sku}`, `POST /products`, `PUT /products/{id}`, `DELETE /products/{id}`, `POST /products/bulk-edit {ids, price_change_pct?, set{}}`, `GET /products-template`, `POST /products/bulk-upload` (CSV/XLSX, upsert by SKU)
- Inventory: `POST /stock/adjust {product_id, qty, type: in|out|damage|return, note}`, `GET /stock/movements`, `GET /inventory/valuation` [o,m]
- Orders [all staff; delivery sees only assigned]: `GET /orders?status&channel&q&page` (`status=returns` for return requests), `GET /orders/{id}`, `PUT /orders/{id}/status {status, note}`, `PUT /orders/{id} {assigned_to, notes, payment_status}`, `POST /orders/{id}/return/{approved|rejected|replaced|refunded}` [o,m], `GET /orders/{id}/invoice`, `GET /orders/{id}/packing-slip`
- POS: `POST /pos/sale {items:[{product_id, qty, price?}], customer_name, phone, payment_mode: cash|upi|card, discount}`
- Customers: `GET /customers`, `GET /customers/{id}`, `PUT /customers/{id}/notes`
- Generic CMS [read o,m,s; write o,m]: `GET|POST /c/{col}`, `PUT|DELETE /c/{col}/{id}` for `categories, brands, banners, coupons, pincodes, slots, blogs, pages`
- Moderation: `GET /reviews?status`, `PUT /reviews/{id} {status}`, `DELETE /reviews/{id}`, `GET /questions`, `PUT /questions/{id} {answer}`, `GET /enquiries`, `PUT /enquiries/{id}`
- Notifications [o,m]: `POST /broadcast {title, message, channels}`, `GET /notification-logs`; `GET /error-logs` [owner]
- Settings: `GET /settings` [o,m], `PUT /settings` [owner]; Staff: `GET /staff`, `POST /staff`, `PUT /staff/{id}` [owner]
- `POST /upload` (multipart `files`; JPG/PNG/WEBP/GIF/PDF, max 8 MB, stored on Cloudinary/S3) · `GET /integrations` [o,m] · `GET /export/{products|orders|customers|stock_movements|enquiries}` [owner] · `POST /orders/{id}/refund` [o,m] · `GET /reports/{sales|gst|stock|profit|customers}?start&end&fmt=json|xlsx|pdf` [o,m]
