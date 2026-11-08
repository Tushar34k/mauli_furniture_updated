import os
import io
import json
import time
import hashlib
import asyncio
import smtplib
import logging
from email.message import EmailMessage
import httpx

log = logging.getLogger("integrations")
E = lambda k: os.environ.get(k, "").strip()  # noqa: E731


def _real(v):
    return bool(v) and "placeholder" not in v.lower()


def sms_provider():
    p = E("SMS_PROVIDER") or "msg91"
    if p == "twilio" and _real(E("TWILIO_ACCOUNT_SID")) and _real(E("TWILIO_AUTH_TOKEN")) and E("TWILIO_FROM"):
        return "twilio"
    if p == "msg91" and _real(E("MSG91_AUTH_KEY")) and E("MSG91_TEMPLATE_ID"):
        return "msg91"
    return None


def email_provider():
    if _real(E("RESEND_API_KEY")) and E("EMAIL_FROM"):
        return "resend"
    if E("SMTP_HOST") and E("SMTP_USER") and E("SMTP_PASSWORD") and E("EMAIL_FROM"):
        return "smtp"
    return None


def storage_provider():
    b = E("STORAGE_BACKEND")
    if b == "cloudinary" and E("CLOUDINARY_CLOUD_NAME") and _real(E("CLOUDINARY_API_KEY")) and E("CLOUDINARY_API_SECRET"):
        return "cloudinary"
    if b == "s3" and E("S3_BUCKET") and E("AWS_ACCESS_KEY_ID") and E("AWS_SECRET_ACCESS_KEY"):
        return "s3"
    if b == "local" and E("APP_ENV") == "development":
        return "local"
    return None


def fcm_ready():
    return bool(E("FCM_SERVICE_ACCOUNT_JSON")) and bool(E("FCM_PROJECT_ID"))


def whatsapp_ready():
    return _real(E("WHATSAPP_TOKEN")) and bool(E("WHATSAPP_PHONE_NUMBER_ID"))


def status(settings, rzp_ready):
    def row(key, ok, env, en, mr, provider=None):
        return {"key": key, "configured": bool(ok), "provider": provider, "env": env, "help_en": en, "help_mr": mr}
    return [
        row("sms_otp", sms_provider(), ["SMS_PROVIDER=msg91", "MSG91_AUTH_KEY", "MSG91_TEMPLATE_ID", "or SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM"],
            "Phone OTP login is disabled until an SMS provider key is added. Customers can still log in with Google.",
            "SMS प्रोव्हायडरची की जोडेपर्यंत OTP लॉगिन बंद आहे. ग्राहक Google ने लॉगिन करू शकतात.", sms_provider()),
        row("razorpay", rzp_ready, ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET (recommended)"],
            "Online payment is hidden at checkout until Razorpay keys are added. COD and Pay at Store still work.",
            "Razorpay की जोडेपर्यंत ऑनलाइन पेमेंट लपवले आहे. COD आणि शोरूम पेमेंट चालू आहेत.", "razorpay" if rzp_ready else None),
        row("email", email_provider(), ["RESEND_API_KEY + EMAIL_FROM", "or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM"],
            "Order emails are not sent until Resend or SMTP is configured.", "Resend किंवा SMTP सेट करेपर्यंत ऑर्डर ईमेल पाठवले जात नाहीत.", email_provider()),
        row("push_fcm", fcm_ready(), ["FCM_PROJECT_ID", "FCM_SERVICE_ACCOUNT_JSON (single-line JSON)"],
            "Push notifications are off until Firebase is configured.", "Firebase सेट करेपर्यंत पुश नोटिफिकेशन बंद आहेत.", "fcm" if fcm_ready() else None),
        row("whatsapp_api", whatsapp_ready(), ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
            "Optional. Click-to-chat links always work; automatic WhatsApp order updates need the WhatsApp Business Cloud API.",
            "ऐच्छिक. WhatsApp चॅट लिंक नेहमी चालते; आपोआप WhatsApp अपडेटसाठी Business API लागते.", "meta" if whatsapp_ready() else None),
        row("storage", storage_provider(), ["STORAGE_BACKEND=cloudinary + CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET", "or STORAGE_BACKEND=s3 + S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_PUBLIC_URL"],
            "Image/photo uploads are disabled until Cloudinary or S3 is configured. You can paste image URLs meanwhile.",
            "Cloudinary किंवा S3 सेट करेपर्यंत फोटो अपलोड बंद आहे. तोपर्यंत इमेज URL टाकू शकता.", storage_provider()),
        row("google_login", True, ["(managed by Emergent - no key needed)"], "Google login is active.", "Google लॉगिन चालू आहे.", "emergent"),
        row("maps", bool(settings.get("map_embed")), ["Admin > Settings > Google Maps embed URL"],
            "Showroom map is hidden until you paste the Google Maps embed URL in Settings.", "Settings मध्ये Google Maps embed URL टाकेपर्यंत नकाशा लपवला आहे.", "google" if settings.get("map_embed") else None),
    ]


async def send_sms(phone: str, text: str, otp: str = None):
    p = sms_provider()
    if not p:
        raise RuntimeError("SMS not configured")
    async with httpx.AsyncClient(timeout=15) as c:
        if p == "twilio":
            sid = E("TWILIO_ACCOUNT_SID")
            r = await c.post(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", auth=(sid, E("TWILIO_AUTH_TOKEN")),
                             data={"To": f"+91{phone}", "From": E("TWILIO_FROM"), "Body": text})
        else:
            r = await c.post("https://control.msg91.com/api/v5/flow", headers={"authkey": E("MSG91_AUTH_KEY"), "Content-Type": "application/json"},
                             json={"template_id": E("MSG91_TEMPLATE_ID"), "short_url": "0", "recipients": [{"mobiles": f"91{phone}", "otp": otp or "", "var": otp or "", "message": text}]})
    if r.status_code >= 300:
        raise RuntimeError(f"SMS provider error {r.status_code}: {r.text[:200]}")


async def send_email(to: str, subject: str, html: str, attachments=None):
    p = email_provider()
    if not p or not to:
        raise RuntimeError("Email not configured")
    if p == "resend":
        import base64
        body = {"from": E("EMAIL_FROM"), "to": [to], "subject": subject, "html": html}
        if attachments:
            body["attachments"] = [{"filename": n, "content": base64.b64encode(b).decode()} for n, b in attachments]
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {E('RESEND_API_KEY')}"}, json=body)
        if r.status_code >= 300:
            raise RuntimeError(f"Resend error {r.status_code}: {r.text[:200]}")
        return

    def _smtp():
        m = EmailMessage()
        m["From"], m["To"], m["Subject"] = E("EMAIL_FROM"), to, subject
        m.set_content("Please view this email in an HTML-capable client.")
        m.add_alternative(html, subtype="html")
        for n, b in attachments or []:
            m.add_attachment(b, maintype="application", subtype="pdf", filename=n)
        with smtplib.SMTP(E("SMTP_HOST"), int(E("SMTP_PORT") or 587), timeout=20) as s:
            s.starttls()
            s.login(E("SMTP_USER"), E("SMTP_PASSWORD"))
            s.send_message(m)
    await asyncio.to_thread(_smtp)


_fcm_token = {"t": None, "exp": 0}


async def send_push(tokens, title, body):
    if not fcm_ready() or not tokens:
        raise RuntimeError("FCM not configured")
    if time.time() > _fcm_token["exp"]:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        cred = service_account.Credentials.from_service_account_info(json.loads(E("FCM_SERVICE_ACCOUNT_JSON")), scopes=["https://www.googleapis.com/auth/firebase.messaging"])
        await asyncio.to_thread(cred.refresh, Request())
        _fcm_token.update(t=cred.token, exp=time.time() + 3000)
    async with httpx.AsyncClient(timeout=15) as c:
        for tk in tokens:
            await c.post(f"https://fcm.googleapis.com/v1/projects/{E('FCM_PROJECT_ID')}/messages:send", headers={"Authorization": f"Bearer {_fcm_token['t']}"},
                         json={"message": {"token": tk, "notification": {"title": title, "body": body}}})


async def send_whatsapp(phone, text):
    if not whatsapp_ready():
        raise RuntimeError("WhatsApp API not configured")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"https://graph.facebook.com/v20.0/{E('WHATSAPP_PHONE_NUMBER_ID')}/messages", headers={"Authorization": f"Bearer {E('WHATSAPP_TOKEN')}"},
                         json={"messaging_product": "whatsapp", "to": f"91{phone}", "type": "text", "text": {"body": text}})
    if r.status_code >= 300:
        raise RuntimeError(f"WhatsApp error {r.status_code}")


async def store_file(data: bytes, name: str, content_type: str, folder: str) -> str:
    p = storage_provider()
    if not p:
        raise RuntimeError("Storage not configured")
    if p == "cloudinary":
        ts = str(int(time.time()))
        to_sign = f"folder=mauli/{folder}&timestamp={ts}{E('CLOUDINARY_API_SECRET')}"
        sig = hashlib.sha1(to_sign.encode()).hexdigest()
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(f"https://api.cloudinary.com/v1_1/{E('CLOUDINARY_CLOUD_NAME')}/auto/upload",
                             data={"api_key": E("CLOUDINARY_API_KEY"), "timestamp": ts, "folder": f"mauli/{folder}", "signature": sig}, files={"file": (name, data, content_type)})
        if r.status_code >= 300:
            raise RuntimeError(f"Cloudinary error: {r.text[:200]}")
        return r.json()["secure_url"]
    if p == "s3":
        import boto3
        key = f"mauli/{folder}/{name}"
        s3 = boto3.client("s3", region_name=E("S3_REGION") or None)
        await asyncio.to_thread(s3.upload_fileobj, io.BytesIO(data), E("S3_BUCKET"), key, ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000"})
        base = E("S3_PUBLIC_URL") or f"https://{E('S3_BUCKET')}.s3.{E('S3_REGION') or 'ap-south-1'}.amazonaws.com"
        return f"{base.rstrip('/')}/{key}"
    from core import UPLOAD_DIR
    d = UPLOAD_DIR / folder
    d.mkdir(parents=True, exist_ok=True)
    (d / name).write_bytes(data)
    return f"/api/uploads/{folder}/{name}"
