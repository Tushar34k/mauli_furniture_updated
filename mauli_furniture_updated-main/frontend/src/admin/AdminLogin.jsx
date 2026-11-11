import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Toaster } from "sonner";
import api, { errMsg } from "@/lib/api";
import { useApp } from "@/lib/store";

export default function AdminLogin() {
  const { login, user } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  if (user && user.role !== "customer") return <Navigate to="/admin" replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post("/auth/staff/login", f); login(data.token, data.user); nav("/admin"); }
    catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2" data-testid="admin-login-page">
      <div className="relative hidden flex-col justify-between bg-[#7A1F1F] p-12 text-white lg:flex grain">
        <div className="relative flex items-center gap-3"><img src="/logo.svg" alt="" className="h-14 w-14" /><div><p className="font-deva text-2xl font-extrabold">माऊली फर्निचर मॉल</p><p className="text-xs tracking-[0.3em] text-[#F5B800]">INVENTORY & ADMIN</p></div></div>
        <div className="relative"><h1 className="text-5xl font-extrabold leading-tight !text-white">Run your showroom<br /><span className="text-[#F5B800]">from one place.</span></h1>
          <p className="mt-4 max-w-md text-white/75">Inventory, online orders, walk-in POS, GST reports and delivery — all synced to the same stock.</p></div>
        <p className="relative text-xs text-white/50">Roles: Owner · Manager · Staff · Delivery</p>
      </div>
      <div className="grid place-items-center bg-[#FFFAF5] p-6">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
          <img src="/logo.svg" alt="Mauli Furniture Mall" className="h-12 w-12 lg:hidden" />
          <h2 className="text-2xl">Staff Login</h2>
          <div><label className="label">Email</label><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="input" data-testid="admin-email-input" /></div>
          <div><label className="label">Password</label><input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="input" data-testid="admin-password-input" /></div>
          <button disabled={busy} className="btn-primary w-full !py-3" data-testid="admin-login-btn">{busy ? "..." : "Login"}</button>
          <a href="/" className="block text-center text-xs text-gray-500 hover:text-[#E8671B]">← Back to store</a>
        </form>
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
