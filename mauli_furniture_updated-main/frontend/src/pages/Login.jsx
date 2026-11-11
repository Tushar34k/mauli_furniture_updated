import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { errMsg } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";

export default function Login() {
  const { t, login, user, settings, lang } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get("next") || "/account";
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState(1);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (wait <= 0) return undefined; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useTitle(t("login"));
  if (user) return <Navigate to={next} replace />;
  const send = async () => {
    setBusy(true);
    try { const { data } = await api.post("/auth/otp/send", { phone }); setWait(data.resend_after || 60); setStep(2); toast.success("OTP sent"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { const { data } = await api.post("/auth/otp/verify", { phone, otp, name }); login(data.token, data.user); toast.success("स्वागत आहे!"); nav(next, { replace: true }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/account";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-10" data-testid="login-page">
      <div className="card w-full max-w-md overflow-hidden">
        <div className="relative bg-[#7A1F1F] p-6 text-center grain">
          <img src={settings.logo || "/logo.svg"} alt={settings.shop_name || "logo"} className="relative mx-auto h-16 w-16 rounded-xl object-contain" />
          <h1 className="relative mt-3 font-deva text-2xl !text-white">{(lang === "mr" && settings.shop_name_mr) || settings.shop_name}</h1>
          <p className="relative text-sm text-[#F5B800]">{settings.sms_enabled ? t("login_sub") : t("login")}</p>
        </div>
        <div className="space-y-4 p-6">
          {settings.sms_enabled === false ? <p className="rounded-xl bg-[#fffbeb] p-3 text-sm text-[#7A1F1F]" data-testid="otp-not-configured">{lang === "mr" ? "OTP लॉगिन सध्या उपलब्ध नाही. कृपया Google ने लॉगिन करा." : "Phone OTP login is not available right now. Please continue with Google."}</p> : step === 1 ? <>
            <label className="label">{t("phone")}</label>
            <div className="flex items-center gap-2"><span className="rounded-xl border bg-[#fbf3ea] px-3 py-2.5 text-sm">+91</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" className="input" placeholder="98XXXXXXXX" data-testid="login-phone-input" /></div>
            <button disabled={phone.length !== 10 || busy} onClick={send} className="btn-primary w-full !py-3" data-testid="send-otp-btn">{t("send_otp")}</button>
          </> : <>
            <p className="text-sm">OTP sent to +91 {phone} <button onClick={() => setStep(1)} className="ml-1 font-semibold text-[#E8671B]" data-testid="change-phone-btn">Change</button>
              <button disabled={wait > 0 || busy} onClick={send} className="ml-2 font-semibold text-[#7A1F1F] disabled:text-gray-400" data-testid="resend-otp-btn">{wait > 0 ? `Resend (${wait}s)` : "Resend"}</button></p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className="input text-center text-2xl tracking-[0.5em]" placeholder="••••••" data-testid="otp-input" />
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={`${t("name")} (optional)`} data-testid="login-name-input" />
            <button disabled={otp.length !== 6 || busy} onClick={verify} className="btn-primary w-full !py-3" data-testid="verify-otp-btn">{t("verify")}</button>
          </>}
          <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />OR<span className="h-px flex-1 bg-gray-200" /></div>
          <button onClick={google} className="btn-outline w-full !py-3" data-testid="google-login-btn">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
            {t("google")}</button>
          <p className="text-center text-[11px] text-gray-500">By continuing you agree to our <a href="/page/terms" className="underline">Terms</a> & <a href="/page/privacy" className="underline">Privacy Policy</a>.</p>
        </div>
      </div>
    </div>
  );
}
