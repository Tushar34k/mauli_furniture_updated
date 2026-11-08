import logging
from core import db, uid, now
import integrations as ig

log = logging.getLogger("notify")


async def _deliver(ch, to, title, message, html=None, attachments=None, user_id=None):
    if ch == "sms":
        await ig.send_sms(to, message)
    elif ch == "whatsapp":
        await ig.send_whatsapp(to, message)
    elif ch == "email":
        await ig.send_email(to, title, html or f"<p>{message}</p>", attachments)
    elif ch == "push":
        u = await db.users.find_one({"id": user_id}, {"fcm_tokens": 1}) or {}
        await ig.send_push(u.get("fcm_tokens", []), title, message)


async def send(channels, title: str, message: str, user_id: str = None, phone: str = None, email: str = None, event: str = "general", html=None, attachments=None):
    for ch in channels:
        to = {"sms": phone, "whatsapp": phone, "email": email, "push": user_id, "inapp": user_id}.get(ch)
        if not to:
            continue
        if ch == "inapp":
            await db.notifications.insert_one({"id": uid(), "user_id": user_id, "title": title, "message": message, "read": False, "created_at": now()})
            continue
        try:
            await _deliver(ch, to, title, message, html, attachments, user_id)
            status = "sent"
        except RuntimeError as e:
            status = f"skipped: {e}" if "not configured" in str(e) else f"failed: {e}"
        except Exception as e:
            status = f"failed: {e}"
        if status.startswith("failed"):
            log.error(f"[NOTIFY:{ch}] {status}")
        await db.notification_logs.insert_one({"id": uid(), "channel": ch, "to": to, "title": title, "message": message[:500],
                                               "event": event, "status": status[:300], "created_at": now()})


async def order_update(order: dict, status: str):
    from core import get_settings
    from reports import invoice_pdf
    s = await get_settings()
    a = order.get("address") or {}
    shop = s.get("shop_name") or "Store"
    msg = f"{shop}: Order {order['order_no']} is now {status.replace('_', ' ').upper()}. Total Rs.{order['total']:.0f}"
    html = (f"<div style='font-family:Arial'><h2 style='color:#7A1F1F'>{shop}</h2><p>Namaskar {a.get('name', '')},</p>"
            f"<p>Your order <b>{order['order_no']}</b> is now <b>{status.replace('_', ' ').title()}</b>.</p><p>Total: <b>Rs. {order['total']:.2f}</b></p>"
            f"<p style='color:#666;font-size:12px'>{s.get('address', '')} | {s.get('phone', '')}</p></div>")
    att = [(f"Invoice-{order['order_no']}.pdf", invoice_pdf(order, s))] if status in ("placed", "confirmed") else None
    await send(["inapp", "push", "sms", "whatsapp", "email"], f"Order {order['order_no']} - {status.replace('_', ' ').title()}", msg,
               user_id=order.get("user_id"), phone=a.get("phone"), email=a.get("email"), event=f"order_{status}", html=html, attachments=att)
