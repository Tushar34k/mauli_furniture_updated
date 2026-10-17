import os
import logging
import httpx
from core import db, uid, now

log = logging.getLogger("notify")


def _live(channel: str) -> bool:
    return os.environ.get(f"{channel.upper()}_MODE", "mock") == "live"


async def _send_sms_live(phone: str, msg: str):
    provider = os.environ.get('SMS_PROVIDER', 'msg91')
    async with httpx.AsyncClient(timeout=10) as c:
        if provider == 'twilio':
            sid, tok = os.environ['TWILIO_ACCOUNT_SID'], os.environ['TWILIO_AUTH_TOKEN']
            await c.post(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", auth=(sid, tok),
                         data={"To": f"+91{phone}", "From": os.environ['TWILIO_FROM'], "Body": msg})
        else:
            await c.post("https://control.msg91.com/api/v5/flow/", headers={"authkey": os.environ['MSG91_AUTH_KEY']},
                         json={"template_id": os.environ.get('MSG91_TEMPLATE_ID', ''), "recipients": [{"mobiles": f"91{phone}", "message": msg}]})


async def send(channels, title: str, message: str, user_id: str = None, phone: str = None, email: str = None, event: str = "general"):
    for ch in channels:
        to = {"sms": phone, "whatsapp": phone, "email": email, "push": user_id, "inapp": user_id}.get(ch)
        if not to:
            continue
        status = "mock-logged"
        try:
            if ch == "sms" and _live("sms"):
                await _send_sms_live(phone, message)
                status = "sent"
        except Exception as e:
            status = f"failed: {e}"
        if ch == "inapp":
            await db.notifications.insert_one({"id": uid(), "user_id": user_id, "title": title, "message": message, "read": False, "created_at": now()})
            continue
        log.info(f"[NOTIFY:{ch.upper()}:{status}] to={to} | {title} | {message}")
        await db.notification_logs.insert_one({"id": uid(), "channel": ch, "to": to, "title": title, "message": message,
                                               "event": event, "status": status, "created_at": now()})


async def order_update(order: dict, status: str):
    a = order.get('address') or {}
    msg = f"Mauli Furniture: Order {order['order_no']} is now {status.replace('_', ' ').upper()}. Total Rs.{order['total']:.0f}"
    await send(["inapp", "push", "sms", "whatsapp", "email"], f"Order {order['order_no']}", msg,
               user_id=order.get('user_id'), phone=a.get('phone'), email=a.get('email'), event=f"order_{status}")
