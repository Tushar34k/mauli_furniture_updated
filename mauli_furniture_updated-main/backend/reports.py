import io
from datetime import datetime, timezone, timedelta
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from core import db

LOGO = Path(__file__).parent / "assets" / "logo.png"
ORANGE, MAROON = colors.HexColor("#E8671B"), colors.HexColor("#7A1F1F")
ST = getSampleStyleSheet()


def _header(s, title):
    els = []
    head = [[RLImage(str(LOGO), 22 * mm, 22 * mm) if LOGO.exists() else "",
             Paragraph(f"<font size=16 color='#7A1F1F'><b>{s.get('shop_name', '')}</b></font><br/>{s.get('address', '')}<br/>"
                       f"Ph: {s.get('phone', '')} | {s.get('email', '')}<br/><b>GSTIN: {s.get('gst_number', '')}</b>", ST["Normal"]),
             Paragraph(f"<font size=14 color='#E8671B'><b>{title}</b></font>", ST["Normal"])]]
    t = Table(head, colWidths=[26 * mm, 110 * mm, 44 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 1.5, ORANGE)]))
    els += [t, Spacer(1, 6)]
    return els


def _tbl(rows, widths, head_bg=MAROON):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), head_bg), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 8),
                           ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    return t


def invoice_pdf(o, s, packing=False):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=12 * mm, bottomMargin=12 * mm)
    a = o.get("address") or {}
    els = _header(s, "PACKING SLIP" if packing else "TAX INVOICE")
    meta = f"<b>Invoice No:</b> {o['order_no']}<br/><b>Date:</b> {o['created_at'][:10]}<br/><b>Payment:</b> {o['payment_method'].upper()} ({o['payment_status']})<br/><b>Channel:</b> {o.get('channel', 'online')}"
    bill = f"<b>Bill / Ship To:</b><br/>{a.get('name', '')}<br/>{a.get('line1', '')} {a.get('line2', '')}<br/>{a.get('city', '')}, {a.get('state', '')} {a.get('pincode', '')}<br/>Ph: {a.get('phone', '')}"
    els += [Table([[Paragraph(bill, ST["Normal"]), Paragraph(meta, ST["Normal"])]], colWidths=[95 * mm, 85 * mm]), Spacer(1, 8)]
    intra = (a.get("state", "Maharashtra") or "Maharashtra").lower().startswith("maha")
    if packing:
        rows = [["#", "Item", "SKU", "Variant", "Qty", "Checked"]] + [[i + 1, Paragraph(it["name"], ST["Normal"]), it["sku"], it.get("variant", ""), it["qty"], "[  ]"] for i, it in enumerate(o["items"])]
        els += [_tbl(rows, [8 * mm, 80 * mm, 32 * mm, 28 * mm, 12 * mm, 20 * mm]), Spacer(1, 10), Paragraph(f"Delivery slot: {o.get('slot', '')}  |  Notes: {o.get('notes', '')}", ST["Normal"])]
    else:
        ratio = (o["subtotal"] - o["discount"]) / o["subtotal"] if o["subtotal"] else 1
        hdr = ["#", "Item", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total"] if intra else ["#", "Item", "HSN", "Qty", "Rate", "Taxable", "IGST", "", "Total"]
        rows = [hdr]
        for i, it in enumerate(o["items"]):
            gross = it["price"] * it["qty"] * ratio
            taxable = gross * 100 / (100 + it["gst"])
            tax = gross - taxable
            c1, c2 = (f"{tax / 2:.2f}\n@{it['gst'] / 2}%", f"{tax / 2:.2f}\n@{it['gst'] / 2}%") if intra else (f"{tax:.2f}\n@{it['gst']}%", "")
            rows.append([i + 1, Paragraph(f"{it['name']} {it.get('variant', '')}<br/><font size=7>{it['sku']}</font>", ST["Normal"]), "9403", it["qty"], f"{it['price']:.2f}", f"{taxable:.2f}", c1, c2, f"{gross:.2f}"])
        els.append(_tbl(rows, [7 * mm, 58 * mm, 13 * mm, 9 * mm, 18 * mm, 20 * mm, 18 * mm, 18 * mm, 21 * mm]))
        tot = [["Subtotal", f"Rs. {o['subtotal']:.2f}"], ["Discount " + (o.get("coupon") or ""), f"- Rs. {o['discount']:.2f}"],
               ["GST included", f"Rs. {o['gst_total']:.2f}"], ["Delivery", f"Rs. {o['delivery']:.2f}"], ["Grand Total", f"Rs. {o['total']:.2f}"]]
        t = Table(tot, colWidths=[40 * mm, 35 * mm], hAlign="RIGHT")
        t.setStyle(TableStyle([("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("LINEABOVE", (0, -1), (-1, -1), 1, ORANGE), ("ALIGN", (1, 0), (1, -1), "RIGHT")]))
        els += [Spacer(1, 6), t, Spacer(1, 12), Paragraph(f"<font size=8>{s.get('invoice_terms', '')}</font>", ST["Normal"]),
                Paragraph("<font size=8>This is a computer generated invoice.</font>", ST["Normal"])]
    doc.build(els)
    return buf.getvalue()


def _range(start, end):
    e = datetime.fromisoformat(end) + timedelta(days=1) if end else datetime.now(timezone.utc) + timedelta(days=1)
    s = datetime.fromisoformat(start) if start else e - timedelta(days=31)
    return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")


async def build_report(kind, start=None, end=None):
    s, e = _range(start, end)
    oq = {"created_at": {"$gte": s, "$lt": e}, "status": {"$ne": "cancelled"}}
    if kind == "sales":
        orders = await db.orders.find(oq, {"_id": 0}).sort("created_at", 1).to_list(20000)
        cols = ["Date", "Order No", "Channel", "Customer", "Items", "Payment", "Status", "Discount", "GST", "Total"]
        rows = [[o["created_at"][:10], o["order_no"], o.get("channel", ""), o["address"].get("name", ""), sum(i["qty"] for i in o["items"]),
                 o["payment_method"], o["status"], o["discount"], o["gst_total"], o["total"]] for o in orders]
    elif kind == "gst":
        orders = await db.orders.find(oq, {"_id": 0}).to_list(20000)
        agg = {}
        for o in orders:
            ratio = (o["subtotal"] - o["discount"]) / o["subtotal"] if o["subtotal"] else 1
            for it in o["items"]:
                g = it["price"] * it["qty"] * ratio
                r = agg.setdefault(it["gst"], [0, 0])
                r[0] += g * 100 / (100 + it["gst"])
                r[1] += g - g * 100 / (100 + it["gst"])
        cols = ["GST Rate %", "Taxable Value", "CGST", "SGST", "Total Tax", "Invoice Value"]
        rows = [[k, round(v[0], 2), round(v[1] / 2, 2), round(v[1] / 2, 2), round(v[1], 2), round(v[0] + v[1], 2)] for k, v in sorted(agg.items())]
    elif kind == "stock":
        prods = await db.products.find({}, {"_id": 0}).sort("category", 1).to_list(10000)
        cols = ["SKU", "Product", "Category", "Location", "Stock", "Reorder Lvl", "Purchase", "Selling", "Stock Value (Cost)", "Stock Value (MRP)", "Status"]
        rows = [[p["sku"], p["name"], p["category"], p.get("location", ""), p["stock"], p.get("reorder_level", 0), p.get("purchase_price", 0), p["price"],
                 p["stock"] * p.get("purchase_price", 0), p["stock"] * p["mrp"], "OUT" if p["stock"] <= 0 else "LOW" if p["stock"] <= p.get("reorder_level", 0) else "OK"] for p in prods]
    elif kind == "profit":
        orders = await db.orders.find(oq, {"_id": 0}).to_list(20000)
        agg = {}
        for o in orders:
            ratio = (o["subtotal"] - o["discount"]) / o["subtotal"] if o["subtotal"] else 1
            for it in o["items"]:
                r = agg.setdefault(it["name"], [it.get("category", ""), 0, 0, 0])
                net = it["price"] * it["qty"] * ratio * 100 / (100 + it["gst"])
                r[1] += it["qty"]
                r[2] += net
                r[3] += it.get("purchase_price", 0) * it["qty"]
        cols = ["Product", "Category", "Qty", "Net Revenue (ex-GST)", "Cost", "Profit", "Margin %"]
        rows = [[k, v[0], v[1], round(v[2], 2), round(v[3], 2), round(v[2] - v[3], 2), round((v[2] - v[3]) * 100 / v[2], 1) if v[2] else 0] for k, v in sorted(agg.items(), key=lambda x: -(x[1][2] - x[1][3]))]
    elif kind == "customers":
        users = await db.users.find({"role": "customer", "deleted": {"$ne": True}}, {"_id": 0}).to_list(20000)
        cols = ["Name", "Phone", "Email", "Joined", "Orders", "Total Spent"]
        rows = []
        for u in users:
            os_ = await db.orders.find({"user_id": u["id"], "status": {"$ne": "cancelled"}}, {"total": 1}).to_list(1000)
            rows.append([u.get("name", ""), u.get("phone", ""), u.get("email", ""), u.get("created_at", "")[:10], len(os_), sum(x["total"] for x in os_)])
    else:
        return None
    return {"kind": kind, "start": s, "end": e, "columns": cols, "rows": rows}


def to_xlsx(rep):
    wb = Workbook()
    ws = wb.active
    ws.title = rep["kind"].title()
    ws.append([f"{rep['kind'].upper()} REPORT  {rep['start']} to {rep['end']}"])
    ws.append(rep["columns"])
    for c in ws[2]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="7A1F1F")
    for r in rep["rows"]:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_pdf(rep, s):
    from reportlab.lib.pagesizes import landscape
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=10 * mm, rightMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm)
    els = _header(s, f"{rep['kind'].upper()} REPORT") + [Paragraph(f"Period: {rep['start']} to {rep['end']}", ST["Normal"]), Spacer(1, 6)]
    rows = [rep["columns"]] + [[Paragraph(str(x), ST["Normal"]) if isinstance(x, str) and len(x) > 22 else x for x in r] for r in rep["rows"]]
    els.append(_tbl(rows, None))
    doc.build(els)
    return buf.getvalue()
