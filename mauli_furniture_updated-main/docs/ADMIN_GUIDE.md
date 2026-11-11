# Admin User Guide (माऊली फर्निचर मॉल)

Open `https://<your-domain>/admin/login`.

## Roles
| Role | Can do |
|---|---|
| Owner | Everything, incl. Settings, payment keys, staff accounts |
| Manager | Everything except Settings/staff: products, bulk upload, reports, coupons, banners, returns/refunds, broadcasts |
| Staff | Products & stock in/out, orders, POS, customers, reviews, enquiries |
| Delivery | Only orders assigned to them; can mark *Out for delivery* / *Delivered* |

## Daily tasks
1. **Dashboard** — today's sales/orders, revenue graph, low-stock alerts, top products, category sales.
2. **Orders** — filter by status/channel, click a row → update status (customer gets in-app + SMS/WhatsApp notification), assign delivery person, add notes, print **Invoice** / **Packing slip**, handle **returns** (approve → stock is added back, refunded → payment marked refunded). Cancelling restocks automatically.
3. **POS / Walk-in** — search or **Scan** barcode (phone camera), adjust qty, discount, choose Cash/UPI/Card → *Complete sale*. Stock reduces from the same inventory as the website. Print GST invoice.

## Inventory
- **Products › Add product**: English + Marathi name/description, multiple images (first = main), variants (size/colour/material with extra price), SKU & barcode (auto-generated if blank), purchase price, selling price, MRP, GST %, stock, reorder level, supplier, location, dimensions, warranty, assembly, delivery days, "Deals of the Day" flag, visible flag.
- **QR label**: click the QR icon on a product row → Print and stick on the item; scan it in POS/Inventory.
- **Bulk upload**: download the CSV template, fill in Excel, upload `.csv` or `.xlsx`. Rows with an existing SKU are updated; new SKUs are created. Multiple image URLs separated by `|`.
- **Bulk edit**: tick products → change price by ±%, mark/remove deal, hide/show.
- **Inventory page**: Stock IN (purchase), OUT, Damaged, Customer return — every change is logged in *Stock history* with user & note. *Inventory valuation* shows stock value at cost / selling / MRP.
- Low-stock = stock ≤ reorder level (shown on dashboard + Products filter).

## Store management (no code)
**Catalog & Store**: categories, brands, homepage banners, coupons (percent / flat / shipping), delivery charges by pincode, delivery slots, blog posts and legal pages. **Settings**: shop details, GST number, logo, invoice prefix/terms, Razorpay keys, free-delivery limit, COD limit, social links, homepage section order & visibility.

## Other
- **Reviews & Q&A** — approve/reject customer reviews (product rating recalculates), answer questions.
- **Enquiries** — custom furniture requests with photo, size, budget; set status and notes; WhatsApp the customer in one click.
- **Notifications** — broadcast offers to all customers (in-app/push/SMS/WhatsApp/email) and view the notification log. In test mode messages are only logged (MOCK).
- **Reports** — Sales, GST (rate-wise CGST/SGST), Stock, Profit (ex-GST revenue minus cost), Customers. Choose dates → export Excel or PDF.
- **Change password** — sidebar → Change Password.
