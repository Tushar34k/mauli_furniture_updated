import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Package, MapPin, Heart, Bell, User, Settings2, Share2, Trash2, LogOut, TrendingDown } from "lucide-react";
import api, { errMsg, img, inr } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { ProductCard, Empty, PageSkeleton } from "@/components/shop";
import { AddressForm } from "@/pages/Checkout";

function Orders() {
  const { t } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/orders").then((r) => setList(r.data)); }, []);
  if (!list) return <div className="skeleton h-40" />;
  if (!list.length) return <Empty title="No orders yet" action={<Link to="/products" className="btn-primary">{t("continue_shopping")}</Link>} />;
  return <div className="space-y-3" data-testid="orders-list">{list.map((o) => (
    <Link key={o.id} to={`/order/${o.id}`} className="flex items-center gap-4 rounded-2xl border bg-white p-4 hover:border-[#E8671B]" data-testid={`order-row-${o.order_no}`}>
      <img src={img(o.items[0]?.image)} alt="" className="h-14 w-14 rounded-xl object-cover" />
      <div className="flex-1 text-sm"><p className="font-semibold">#{o.order_no}</p><p className="text-gray-500">{o.items.length} item(s) · {new Date(o.created_at).toLocaleDateString("en-IN")}</p></div>
      <div className="text-right text-sm"><p className="font-bold">{inr(o.total)}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.status === "delivered" ? "bg-green-100 text-green-700" : o.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-[#fff1d6] text-[#7A1F1F]"}`}>{t(o.status)}</span></div>
    </Link>))}</div>;
}

function Addresses() {
  const { t, user, setUser } = useApp();
  const [edit, setEdit] = useState(null);
  const save = async () => {
    try {
      const { id, ...body } = edit;
      const { data } = id ? await api.put(`/account/addresses/${id}`, body) : await api.post("/account/addresses", body);
      setUser({ ...user, addresses: data }); setEdit(null); toast.success("Saved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (id) => { const { data } = await api.delete(`/account/addresses/${id}`); setUser({ ...user, addresses: data }); };
  return (
    <div className="space-y-3" data-testid="addresses-tab">
      {(user.addresses || []).map((a) => (
        <div key={a.id} className="flex items-start justify-between rounded-2xl border bg-white p-4 text-sm"><div><b>{a.name}</b> {a.default && <span className="badge-deal ml-1">Default</span>}<br />{a.line1}, {a.line2}<br />{a.city}, {a.state} {a.pincode} · {a.phone}</div>
          <div className="flex gap-2"><button onClick={() => setEdit(a)} className="text-xs font-semibold text-[#E8671B]">Edit</button><button onClick={() => del(a.id)} className="text-xs text-red-600" data-testid={`delete-address-${a.id}`}>{t("remove")}</button></div></div>))}
      {edit ? <div className="card space-y-3 p-4"><AddressForm value={edit} onChange={setEdit} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.default} onChange={(e) => setEdit({ ...edit, default: e.target.checked })} />Default</label>
        <div className="flex gap-2"><button onClick={save} className="btn-primary" data-testid="save-address-btn">{t("save")}</button><button onClick={() => setEdit(null)} className="btn-ghost">{t("cancel")}</button></div></div>
        : <button onClick={() => setEdit({ name: user.name || "", phone: user.phone || "", line1: "", line2: "", city: "Pune", state: "Maharashtra", pincode: "" })} className="btn-outline" data-testid="add-address-btn">+ {t("add_address")}</button>}
    </div>
  );
}

function Wishlist() {
  const { t } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/account/wishlist").then((r) => setD(r.data.items)); }, []);
  if (!d) return <div className="skeleton h-40" />;
  if (!d.length) return <Empty title={`${t("wishlist")} —`} />;
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="wishlist-grid">{d.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}

function Notifications() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/account/notifications").then((r) => setD(r.data)); api.post("/account/notifications/read"); }, []);
  if (!d) return <div className="skeleton h-40" />;
  if (!d.length) return <Empty title="No notifications" />;
  return <div className="space-y-2" data-testid="notifications-list">{d.map((n) => (
    <div key={n.id} className={`rounded-2xl border p-4 text-sm ${n.read ? "bg-white" : "border-[#F5B800] bg-[#fffbeb]"}`}><p className="font-semibold">{n.title}</p><p className="text-gray-600">{n.message}</p><p className="mt-1 text-[11px] text-gray-400">{new Date(n.created_at).toLocaleString("en-IN")}</p></div>))}</div>;
}

function Alerts() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/account/price-alerts").then((r) => setD(r.data)); }, []);
  if (!d) return <div className="skeleton h-40" />;
  if (!d.length) return <Empty title="No price alerts" sub="Tap the bell on any product page to get notified when its price drops." />;
  return <div className="space-y-2" data-testid="alerts-list">{d.map((a) => <div key={a.id} className="flex justify-between rounded-2xl border bg-white p-4 text-sm"><span>{a.name}</span><span>Alert set at {inr(a.price_at)}</span></div>)}</div>;
}

function Profile() {
  const { t, user, setUser, logout, settings } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({ name: user.name || "", email: user.email || "" });
  const save = async () => { try { const { data } = await api.put("/auth/me", { name: f.name, email: f.email || null }); setUser(data); toast.success("Saved"); } catch (e) { toast.error(errMsg(e)); } };
  const share = () => {
    const url = window.location.origin;
    const text = `${settings.shop_name} - फर्निचर खरेदीसाठी ॲप`;
    if (navigator.share) navigator.share({ title: settings.shop_name, text, url }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
  };
  const del = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
    try { await api.delete("/auth/me"); logout(); toast.success("Account deleted"); nav("/"); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-5" data-testid="profile-tab">
      <div className="card grid gap-3 p-5 sm:grid-cols-2">
        <div><label className="label">{t("name")}</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" data-testid="profile-name" /></div>
        <div><label className="label">Email</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="input" data-testid="profile-email" /></div>
        <div><label className="label">{t("phone")}</label><input value={user.phone || "—"} disabled className="input bg-gray-50" /></div>
        <div className="flex items-end"><button onClick={save} className="btn-primary" data-testid="profile-save-btn">{t("save")}</button></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={share} className="btn-outline" data-testid="share-app-btn"><Share2 size={16} />{t("share_app")}</button>
        <button onClick={() => { logout(); nav("/"); }} className="btn-outline" data-testid="logout-btn"><LogOut size={16} />{t("logout")}</button>
        <button onClick={del} className="btn-ghost text-red-600" data-testid="delete-account-btn"><Trash2 size={16} />{t("delete_account")}</button>
      </div>
    </div>
  );
}

const TABS = [["profile", User], ["orders", Package, "my_orders"], ["addresses", MapPin], ["wishlist", Heart], ["notifications", Bell], ["alerts", TrendingDown]];

export default function Account() {
  const { t, user } = useApp();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "orders";
  useTitle(t("account"));
  if (user === undefined) return <PageSkeleton />;
  if (!user) return <Navigate to={`/login?next=/account${tab ? `?tab=${tab}` : ""}`} replace />;
  if (user.role !== "customer") return <div className="container-x py-10"><Empty title="Staff account" action={<Link to="/admin" className="btn-primary">Open Admin Panel</Link>} /></div>;
  const C = { profile: Profile, orders: Orders, addresses: Addresses, wishlist: Wishlist, notifications: Notifications, alerts: Alerts }[tab] || Orders;
  return (
    <div className="container-x py-6" data-testid="account-page">
      <div className="mb-5 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#E8671B] text-lg font-bold text-white">{(user.name || "U")[0]}</div>
        <div><h1 className="text-xl">{user.name || t("account")}</h1><p className="text-sm text-gray-500">{user.phone || user.email}</p></div></div>
      <div className="grid gap-6 md:grid-cols-4">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto md:flex-col">{TABS.map(([k, I, label]) => (
          <button key={k} onClick={() => setSp({ tab: k })} data-testid={`account-tab-${k}`}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${tab === k ? "bg-[#E8671B] text-white" : "bg-white hover:bg-[#fbf3ea]"}`}><I size={16} />{t(label || k)}</button>))}
          <Link to="/compare" className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold"><Settings2 size={16} />{t("compare")}</Link></nav>
        <div className="md:col-span-3"><C /></div>
      </div>
    </div>
  );
}
