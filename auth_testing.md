# Auth testing notes
- Staff JWT: POST /api/auth/staff/login {email,password} → {token,user}; header `Authorization: Bearer <token>`. 5 failures per ip+email → 15 min lock (collection login_attempts).
- New/reset staff and the env-created Owner have must_change_password=true → all admin APIs return 403 PASSWORD_CHANGE_REQUIRED until POST /api/auth/change-password.
- POST /api/auth/refresh returns a fresh token for a valid one.
- Customer OTP: real SMS only (MSG91/Twilio). With no SMS keys /api/auth/otp/send returns 503. OTP: random 6 digits, bcrypt-hashed, 10 min expiry, 5 tries, 60 s resend cooldown, 5/hour/phone.
- Google (Emergent Auth): frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/account; POST /api/auth/google {session_id} → JWT.
- For automated customer tests mint a token: `cd /app/backend && python -c "from core import make_token;print(make_token({'id':'<user id>','role':'customer'}))"` after inserting a TEST_ customer user doc.
