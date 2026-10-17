import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown } from "lucide-react";
import api, { errMsg } from "@/lib/api";
import { useApp } from "@/lib/store";
import { PageHead } from "@/admin/AdminApp";

const FIELDS = [["shop_name", "Shop name"], ["shop_name_mr", "Shop name (मराठी)"], ["address", "Address"], ["phone", "Phone"], ["whatsapp", "WhatsApp number (with 91)"], ["email", "Email"],
  ["gst_number", "GST number"], ["timings", "Showroom timings"], ["map_embed", "Google Maps embed URL"], ["logo", "Logo URL"], ["invoice_prefix", "Invoice / order prefix"], ["invoice_terms", "Invoice terms"],
  ["free_delivery_above", "Free delivery above ₹"], ["default_delivery_charge", "Default delivery charge ₹ (unlisted Maharashtra pincodes)"], ["cod_limit", "COD limit ₹"], ["deal_hours", "Deal countdown hours"], ["emi_text", "EMI / offer text"]];

function Staff() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "staff", password: "", active: true });
  const load = () => api.get("/admin/staff").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const add = async () => { try { await api.post("/admin/staff", f); toast.success("Staff added"); setF({ ...f, name: "", email: "", password: "" }); load(); } catch (e) { toast.error(errMsg(e)); } };
  const edit = async (s, patch) => { try { await api.put(`/admin/staff/${s.id}`, { name: s.name, email: s.email, phone: s.phone || "", role: s.role, active: s.active, ...patch }); toast.success("Updated"); load(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="card space-y-3 p-5" data-testid="staff-manager"><h3 className="text-base">Staff & roles</h3>
      <table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead><tbody>{rows.map((s) => (
        <tr key={s.id} data-testid={`staff-row-${s.email}`}><td>{s.name}</td><td>{s.email}</td>
          <td><select value={s.role} onChange={(e) => edit(s, { role: e.target.value })} className="input !py-1">{["owner", "manager", "staff", "delivery"].map((r) => <option key={r}>{r}</option>)}</select></td>
          <td><input type="checkbox" checked={s.active !== false} onChange={(e) => edit(s, { active: e.target.checked })} /></td>
          <td><button onClick={() => { const p = window.prompt("New password (min 8 chars)"); if (p) edit(s, { password: p }); }} className="text-xs font-semibold text-[#E8671B]" data-testid={`reset-pw-${s.email}`}>Reset password</button></td></tr>))}</tbody></table>
      <div className="grid gap-2 sm:grid-cols-5">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className="input" data-testid="new-staff-name" />
        <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email" className="input" data-testid="new-staff-email" />
        <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Password" type="password" className="input" data-testid="new-staff-password" />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="input" data-testid="new-staff-role">{["manager", "staff", "delivery", "owner"].map((r) => <option key={r}>{r}</option>)}</select>
        <button onClick={add} className="btn-primary" data-testid="add-staff-btn">Add staff</button></div>
    </div>
  );
}

function Sections({ s, set }) {
  const list = s.home_sections || [];
  const move = (i, d) => { const n = [...list]; [n[i], n[i + d]] = [n[i + d], n[i]]; set("home_sections", n); };
  return (
    <div className="card p-5" data-testid="home-sections-manager"><h3 className="mb-2 text-base">Homepage sections (order & visibility)</h3>
      {list.map((x, i) => <div key={x.key} className="flex items-center gap-3 border-b py-2 text-sm last:border-0"><input type="checkbox" checked={x.enabled} onChange={(e) => set("home_sections", list.map((y) => (y.key === x.key ? { ...y, enabled: e.target.checked } : y)))} data-testid={`section-toggle-${x.key}`} />
        <span className="flex-1 capitalize">{x.key.replace(/_/g, " ")}</span><button disabled={!i} onClick={() => move(i, -1)} className="disabled:opacity-30"><ArrowUp size={15} /></button><button disabled={i === list.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><ArrowDown size={15} /></button></div>)}
    </div>
  );
}

export function SettingsPage() {
  const { user, setSettings } = useApp();
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <div className="skeleton h-96" />;
  const owner = user.role === "owner";
  const set = (k, v) => setS({ ...s, [k]: v });
  const save = async () => {
    try { const num = ["free_delivery_above", "default_delivery_charge", "cod_limit", "deal_hours"]; const body = { ...s }; num.forEach((k) => { body[k] = Number(body[k]); });
      const { data } = await api.put("/admin/settings", body); setS(data); api.get("/settings/public").then((r) => setSettings(r.data)); toast.success("Settings saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-5" data-testid="admin-settings">
      <PageHead title="Settings">{owner && <button onClick={save} className="btn-primary" data-testid="settings-save-btn">Save settings</button>}</PageHead>
      {!owner && <p className="rounded-xl bg-amber-50 p-3 text-sm">Only the Owner can change settings.</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card grid gap-3 p-5 sm:grid-cols-2"><h3 className="text-base sm:col-span-2">Shop details & invoice</h3>{FIELDS.map(([k, l]) => (
          <div key={k} className={["address", "invoice_terms", "map_embed", "emi_text"].includes(k) ? "sm:col-span-2" : ""}><label className="label">{l}</label><input value={s[k] ?? ""} disabled={!owner} onChange={(e) => set(k, e.target.value)} className="input" data-testid={`setting-${k}`} /></div>))}</div>
        <div className="space-y-5">
          <div className="card grid gap-3 p-5"><h3 className="text-base">Payment keys (Razorpay)</h3>
            <p className="text-xs text-gray-500">Leave blank to use .env values. While no valid key exists, checkout uses the DEMO payment screen.</p>
            <div><label className="label">Key ID</label><input value={s.razorpay_key_id || ""} disabled={!owner} onChange={(e) => set("razorpay_key_id", e.target.value)} className="input" placeholder="rzp_test_..." data-testid="setting-razorpay_key_id" /></div>
            <div><label className="label">Key secret</label><input type="password" value={s.razorpay_key_secret || ""} disabled={!owner} onChange={(e) => set("razorpay_key_secret", e.target.value)} className="input" data-testid="setting-razorpay_key_secret" /></div></div>
          <div className="card grid gap-3 p-5"><h3 className="text-base">Social links</h3>{["facebook", "instagram", "youtube"].map((k) => (
            <div key={k}><label className="label">{k}</label><input value={s.social?.[k] || ""} disabled={!owner} onChange={(e) => set("social", { ...s.social, [k]: e.target.value })} className="input" /></div>))}</div>
          <Sections s={s} set={set} />
        </div>
      </div>
      {owner && <Staff />}
    </div>
  );
}

export function ChangePassword() {
  const [f, setF] = useState({ old_password: "", new_password: "", confirm: "" });
  const submit = async () => {
    if (f.new_password !== f.confirm) return toast.error("Passwords do not match");
    try { await api.post("/auth/change-password", { old_password: f.old_password, new_password: f.new_password }); toast.success("Password changed"); setF({ old_password: "", new_password: "", confirm: "" }); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="max-w-md" data-testid="change-password-page"><PageHead title="Change password" />
      <div className="card space-y-3 p-5">{[["old_password", "Current password"], ["new_password", "New password (min 8)"], ["confirm", "Confirm new password"]].map(([k, l]) => (
        <div key={k}><label className="label">{l}</label><input type="password" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input" data-testid={`cp-${k}`} /></div>))}
        <button onClick={submit} className="btn-primary" data-testid="cp-submit-btn">Update password</button></div></div>
  );
}
