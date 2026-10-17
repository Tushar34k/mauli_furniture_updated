# Auth testing notes
- Staff JWT: POST /api/auth/staff/login {email,password} → {token,user}; send `Authorization: Bearer <token>`.
- Customer OTP: POST /api/auth/otp/send {phone} then /api/auth/otp/verify {phone, otp:"123456"} (OTP_MODE=test).
- Brute force: 5 failed staff logins per ip+email → 429 for 15 min (collection login_attempts). Use a fresh email if testing lockout; clear with `db.login_attempts.deleteMany({})`.
- Google (Emergent Auth): frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/account; returns #session_id=...; frontend POSTs /api/auth/google {session_id} → our JWT. Cannot be fully automated; test that button redirects.
- Frontend stores token in localStorage `mfm_token`. Browser test: set localStorage then reload.
