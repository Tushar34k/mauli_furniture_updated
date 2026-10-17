import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api, { errMsg, img } from "@/lib/api";
import { PageHead } from "@/admin/AdminApp";

const B = "bool", N = "number", T = "textarea", I = "image";
const CFG = {
  categories: [["slug"], ["name"], ["name_mr", "Name (मराठी)"], ["icon", "Lucide icon"], ["image", "Image", I], ["room"], ["sort", "Sort", N], ["active", "Active", B]],
  banners: [["title"], ["title_mr", "Title (मराठी)"], ["subtitle"], ["subtitle_mr", "Subtitle (मराठी)"], ["image", "Image", I], ["link"], ["sort", "Sort", N], ["active", "Active", B]],
  coupons: [["code"], ["type", "Type (percent/flat/shipping)"], ["value", "Value", N], ["max_discount", "Max discount", N], ["min_order", "Min order", N], ["description"], ["active", "Active", B], ["public", "Show in cart", B]],
  pincodes: [["pincode"], ["city"], ["charge", "Delivery charge ₹", N], ["days", "Days", N], ["cod", "COD", B], ["active", "Active", B]],
  slots: [["label"], ["label_mr", "Label (मराठी)"], ["sort", "Sort", N], ["active", "Active", B]],
  brands: [["name"], ["active", "Active", B]],
  blogs: [["slug"], ["title"], ["title_mr", "Title (मराठी)"], ["image", "Image", I], ["content", "Content", T], ["active", "Active", B]],
  pages: [["slug"], ["title"], ["title_mr", "Title (मराठी)"], ["content", "Content", T], ["active", "Active", B]],
};

function Editor({ col, item, onClose, onSaved }) {
  const [f, setF] = useState(item);
  const save = async () => {
    try { if (f.id) await api.put(`/admin/c/${col}/${f.id}`, f); else await api.post(`/admin/c/${col}`, f); toast.success("Saved"); onSaved(); } catch (e) { toast.error(errMsg(e)); }
  };
  const up = async (k, file) => { const fd = new FormData(); fd.append("files", file); const { data } = await api.post("/admin/upload", fd); setF({ ...f, [k]: data.urls[0] }); };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="crud-editor"><DialogHeader><DialogTitle className="capitalize">{f.id ? "Edit" : "Add"} {col}</DialogTitle></DialogHeader>
        <div className="space-y-3">{CFG[col].map(([k, label = k, type]) => (
          <div key={k}>{type === B ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} data-testid={`crud-${k}`} />{label}</label> : <>
            <label className="label">{label}</label>
            {type === T ? <textarea value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input min-h-[160px]" data-testid={`crud-${k}`} /> :
              <div className="flex gap-2"><input type={type === N ? "number" : "text"} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input" data-testid={`crud-${k}`} />
                {type === I && <label className="btn-outline cursor-pointer !px-3"><Upload size={15} /><input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && up(k, e.target.files[0])} /></label>}</div>}
            {type === I && f[k] && <img src={img(f[k])} alt="" className="mt-2 h-20 rounded-lg object-cover" />}</>}</div>))}
          <button onClick={save} className="btn-primary w-full" data-testid="crud-save-btn">Save</button></div>
      </DialogContent>
    </Dialog>
  );
}

export function Manage() {
  const [col, setCol] = useState("categories");
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get(`/admin/c/${col}`).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [col]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = CFG[col].filter(([, , t]) => t !== T).slice(0, 6);
  const del = async (id) => { if (window.confirm("Delete?")) { await api.delete(`/admin/c/${col}/${id}`); load(); } };
  return (
    <div data-testid="admin-manage">
      <PageHead title="Catalog & Store"><button onClick={() => setEdit(Object.fromEntries(CFG[col].map(([k, , t]) => [k, t === B ? true : ""])))} className="btn-primary" data-testid="crud-add-btn"><Plus size={16} />Add</button></PageHead>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">{Object.keys(CFG).map((c) => (
        <button key={c} onClick={() => setCol(c)} className={`chip shrink-0 capitalize ${col === c ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white"}`} data-testid={`manage-tab-${c}`}>{c === "pincodes" ? "Delivery charges (pincode)" : c === "slots" ? "Delivery slots" : c === "pages" ? "Legal / info pages" : c}</button>))}</div>
      <div className="card overflow-x-auto"><table className="admin-table"><thead><tr>{cols.map(([k, l = k]) => <th key={k}>{l}</th>)}<th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} data-testid={`crud-row-${r.id}`}>{cols.map(([k, , t]) => <td key={k}>{t === I ? <img src={img(r[k])} alt="" className="h-10 w-14 rounded object-cover" /> : t === B ? (r[k] ? "✓" : "—") : String(r[k] ?? "")}</td>)}
          <td className="whitespace-nowrap"><button onClick={() => setEdit(r)} className="px-2 text-xs font-semibold text-[#E8671B]" data-testid={`crud-edit-${r.id}`}>Edit</button><button onClick={() => del(r.id)} className="text-red-500"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
      {edit && <Editor col={col} item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

export function Moderation() {
  const [tab, setTab] = useState("reviews");
  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState({});
  const load = () => api.get(`/admin/${tab}`).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSt = async (id, status) => { await api.put(`/admin/reviews/${id}`, { status }); toast.success(status); load(); };
  return (
    <div data-testid="admin-moderation">
      <PageHead title="Reviews & Q&A" />
      <div className="mb-4 flex gap-2">{["reviews", "questions"].map((t) => <button key={t} onClick={() => setTab(t)} className={`chip capitalize ${tab === t ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white"}`} data-testid={`mod-tab-${t}`}>{t}</button>)}</div>
      <div className="space-y-2">{rows.map((r) => tab === "reviews" ? (
        <div key={r.id} className="card flex flex-wrap items-start gap-3 p-4 text-sm" data-testid={`review-row-${r.id}`}><div className="flex-1"><b>{r.name}</b> · {"★".repeat(r.rating)} · <span className="text-gray-500">{r.product_name}</span><p className="mt-1">{r.text}</p>
          {r.photos?.length > 0 && <div className="mt-1 flex gap-1">{r.photos.map((u) => <img key={u} src={img(u)} alt="" className="h-12 w-12 rounded object-cover" />)}</div>}</div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "approved" ? "bg-green-100 text-green-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{r.status}</span>
          <button onClick={() => setSt(r.id, "approved")} className="btn-outline !py-1 text-xs" data-testid={`approve-review-${r.id}`}>Approve</button><button onClick={() => setSt(r.id, "rejected")} className="btn-ghost !py-1 text-xs text-red-600" data-testid={`reject-review-${r.id}`}>Reject</button></div>
      ) : (
        <div key={r.id} className="card space-y-2 p-4 text-sm" data-testid={`question-row-${r.id}`}><p><b>{r.name}:</b> {r.question} <span className="text-xs text-gray-500">({r.status})</span></p>
          <div className="flex gap-2"><input defaultValue={r.answer} onChange={(e) => setAns({ ...ans, [r.id]: e.target.value })} placeholder="Answer" className="input" data-testid={`answer-input-${r.id}`} />
            <button onClick={async () => { await api.put(`/admin/questions/${r.id}`, { answer: ans[r.id] ?? r.answer }); toast.success("Answered"); load(); }} className="btn-secondary" data-testid={`answer-save-${r.id}`}>Save</button></div></div>))}
        {!rows.length && <p className="text-sm text-gray-500">Nothing here yet.</p>}</div>
    </div>
  );
}

export function Enquiries() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/admin/enquiries").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const upd = async (id, body) => { await api.put(`/admin/enquiries/${id}`, body); toast.success("Updated"); load(); };
  return (
    <div data-testid="admin-enquiries">
      <PageHead title="Custom furniture enquiries" />
      <div className="grid gap-3 md:grid-cols-2">{rows.map((e) => (
        <div key={e.id} className="card space-y-2 p-4 text-sm" data-testid={`enquiry-row-${e.id}`}>
          <div className="flex justify-between"><b>{e.name}</b><a href={`https://wa.me/91${e.phone}`} target="_blank" rel="noreferrer" className="text-[#25D366]">{e.phone}</a></div>
          <p>{e.furniture_type} · {e.size} · Budget {e.budget}</p><p className="text-gray-600">{e.description}</p>
          {e.photo && <a href={img(e.photo)} target="_blank" rel="noreferrer"><img src={img(e.photo)} alt="" className="h-28 rounded-lg object-cover" /></a>}
          <div className="flex gap-2"><select value={e.status} onChange={(x) => upd(e.id, { status: x.target.value })} className="input !w-auto" data-testid={`enquiry-status-${e.id}`}>{["new", "contacted", "quoted", "won", "lost"].map((s) => <option key={s}>{s}</option>)}</select>
            <input defaultValue={e.notes} onBlur={(x) => x.target.value !== e.notes && upd(e.id, { notes: x.target.value })} placeholder="Notes" className="input" /></div>
          <p className="text-[11px] text-gray-400">{new Date(e.created_at).toLocaleString("en-IN")}</p></div>))}
        {!rows.length && <p className="text-sm text-gray-500">No enquiries yet.</p>}</div>
    </div>
  );
}

export function Notifications() {
  const [f, setF] = useState({ title: "", message: "", channels: ["inapp", "push"] });
  const [logs, setLogs] = useState([]);
  const load = () => api.get("/admin/notification-logs").then((r) => setLogs(r.data));
  useEffect(() => { load(); }, []);
  const send = async () => { try { const { data } = await api.post("/admin/broadcast", f); toast.success(`Sent to ${data.sent_to} customers`); load(); } catch (e) { toast.error(errMsg(e)); } };
  const tog = (c) => setF({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] });
  return (
    <div className="space-y-5" data-testid="admin-notifications">
      <PageHead title="Notifications" />
      <div className="card space-y-3 p-5"><h3 className="text-base">Broadcast to all customers</h3>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title (e.g. Diwali Sale is live!)" className="input" data-testid="broadcast-title" />
        <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Message" className="input" data-testid="broadcast-message" />
        <div className="flex flex-wrap gap-2">{["inapp", "push", "sms", "whatsapp", "email"].map((c) => <button key={c} onClick={() => tog(c)} className={`chip uppercase ${f.channels.includes(c) ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white"}`} data-testid={`broadcast-ch-${c}`}>{c}</button>)}</div>
        <button onClick={send} className="btn-primary" data-testid="broadcast-send-btn">Send broadcast</button></div>
      <div className="card overflow-x-auto p-4" data-testid="notification-log"><h3 className="mb-1 text-base">Notification log</h3>
        <p className="mb-3 text-xs text-amber-700">MOCK MODE: SMS / WhatsApp / Email / Push are logged here (and in the server log) until real provider keys are added in .env.</p>
        <table className="admin-table"><thead><tr><th>Time</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td className="text-xs">{new Date(l.created_at).toLocaleString("en-IN")}</td><td className="uppercase text-xs">{l.channel}</td><td className="text-xs">{l.to}</td><td className="text-xs">{l.message}</td><td className="text-xs">{l.status}</td></tr>)}</tbody></table></div>
    </div>
  );
}
