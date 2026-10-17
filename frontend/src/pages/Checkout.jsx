import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Banknote, Store, ShieldCheck, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api, { errMsg, inr, track } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { usePricing, PriceBox } from "@/pages/Cart";
import { Empty } from "@/components/shop";

const BLANK = { name: "", phone: "", line1: "", line2: "", city: "Pune", state: "Maharashtra", pincode: "" };

export function AddressForm({ value, onChange }) {
  const { t } = useApp();
  const f = (k, label, extra = {}) => (
    <div className={extra.full ? "sm:col-span-2" : ""}><label className="label">{label}</label>
      <input value={value[k] || ""} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className="input" data-testid={`address-${k}`} {...(extra.props || {})} /></div>);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {f("name", t("name"))}{f("phone", t("phone"), { props: { inputMode: "numeric", maxLength: 10 } })}
      {f("line1", `${t("address")} 1`, { full: true })}{f("line2", `${t("address")} 2`, { full: true })}
      {f("city", "City")}{f("pincode", t("pincode"), { props: { inputMode: "numeric", maxLength: 6 } })}{f("state", "State")}
    </div>
  );
}

const loadRzp = () => new Promise((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => res(true);
  s.onerror = () => res(false);
  document.body.appendChild(s);
});

function DemoPay({ open, amount, onPay, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="demo-payment-dialog">
        <DialogHeader><DialogTitle className="text-[#7A1F1F]">Demo Payment (Test Mode)</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">Razorpay keys are not configured yet, so this simulated gateway marks the order as paid. Add keys in Admin › Settings or .env to go live.</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">{[[Smartphone, "UPI"], [CreditCard, "Card / EMI"], [ShieldCheck, "Net banking"]].map(([I, l]) => (
          <div key={l} className="rounded-xl border bg-[#fbf3ea] p-3"><I className="mx-auto mb-1 text-[#E8671B]" size={20} />{l}</div>))}</div>
        <p className="text-center text-2xl font-extrabold">{inr(amount / 100)}</p>
        <button disabled={busy} onClick={async () => { setBusy(true); await onPay(); setBusy(false); }} className="btn-primary w-full !py-3" data-testid="demo-pay-btn">Pay {inr(amount / 100)} (Demo)</button>
      </DialogContent>
    </Dialog>
  );
}

export default function Checkout() {
  const { t, user, cart, setCart, settings } = useApp();
  const nav = useNavigate();
  const [guest, setGuest] = useState(false);
  const [addrId, setAddrId] = useState("");
  const [addr, setAddr] = useState(BLANK);
  const [email, setEmail] = useState("");
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("razorpay");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);
  const coupon = localStorage.getItem("mfm_coupon") || "";
  const saved = user?.addresses || [];
  const chosen = addrId ? saved.find((a) => a.id === addrId) : addr;
  const pr = usePricing(coupon, chosen?.pincode || "", method);
  useTitle(t("checkout"));
  useEffect(() => { api.get("/slots").then((r) => { setSlots(r.data); setSlot(r.data[0]?.label || ""); }); }, []);
  useEffect(() => { const d = saved.find((a) => a.default) || saved[0]; if (d) setAddrId(d.id); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (order) => {
    setCart([]); localStorage.removeItem("mfm_coupon");
    if (!user) sessionStorage.setItem("mfm_guest_phone", order.address.phone);
    track("purchase", { transaction_id: order.order_no, value: order.total, currency: "INR" });
    nav(`/order/${order.id}?new=1`);
  };
  const place = async () => {
    if (!chosen?.name || !/^[6-9]\d{9}$/.test(chosen?.phone || "") || !/^\d{6}$/.test(chosen?.pincode || "") || !chosen?.line1) { toast.error("Please fill a valid name, 10-digit phone, address and 6-digit pincode"); return; }
    setBusy(true);
    try {
      const { id, default: _d, ...a } = chosen;
      const { data } = await api.post("/orders", { items: cart.map(({ product_id, qty, variant }) => ({ product_id, qty, variant })), coupon, pincode: a.pincode,
        address: a, email: email || user?.email || "", slot, delivery_date: date, payment_method: method });
      const { order, payment } = data;
      if (!payment) return finish(order);
      if (payment.mode === "demo") { setDemo({ order, amount: payment.amount }); return; }
      if (!(await loadRzp())) throw new Error("Could not load Razorpay");
      new window.Razorpay({
        key: payment.key_id, amount: payment.amount, currency: "INR", order_id: payment.rzp_order_id, name: settings.shop_name, image: `${window.location.origin}/icons/icon-192.png`,
        prefill: { name: a.name, contact: a.phone, email }, theme: { color: "#E8671B" },
        handler: async (r) => { await api.post(`/orders/${order.id}/pay/verify`, r); finish(order); },
        modal: { ondismiss: () => toast.message("Payment pending. You can retry from My Orders.") },
      }).open();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  if (!cart.length) return <Empty title={t("empty_cart")} action={<Link to="/products" className="btn-primary">{t("continue_shopping")}</Link>} />;
  if (user === undefined) return null;
  if (!user && !guest) return (
    <div className="container-x max-w-lg py-10" data-testid="checkout-auth-choice">
      <div className="card space-y-4 p-6 text-center"><h1 className="text-2xl">{t("checkout")}</h1>
        <Link to="/login?next=/checkout" className="btn-primary w-full !py-3" data-testid="checkout-login-btn">{t("login")} (OTP / Google)</Link>
        <button onClick={() => setGuest(true)} className="btn-outline w-full !py-3" data-testid="checkout-guest-btn">{t("guest")}</button></div>
    </div>);
  const minDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const methods = [["razorpay", CreditCard, t("pay_online")], ["cod", Banknote, t("cod")], ["store", Store, t("store")]];
  return (
    <div className="container-x grid gap-6 py-6 lg:grid-cols-3" data-testid="checkout-page">
      <div className="space-y-5 lg:col-span-2">
        <section className="card p-5"><h2 className="mb-3 text-lg">1. {t("address")}</h2>
          {saved.length > 0 && <div className="mb-3 grid gap-2 sm:grid-cols-2">{saved.map((a) => (
            <label key={a.id} className={`cursor-pointer rounded-xl border p-3 text-sm ${addrId === a.id ? "border-[#E8671B] bg-[#fff6ee]" : "bg-white"}`} data-testid={`saved-address-${a.id}`}>
              <input type="radio" checked={addrId === a.id} onChange={() => setAddrId(a.id)} className="mr-2 accent-[#E8671B]" /><b>{a.name}</b> · {a.phone}<br />{a.line1}, {a.city} {a.pincode}</label>))}
            <button onClick={() => setAddrId("")} className={`rounded-xl border border-dashed p-3 text-sm font-semibold text-[#E8671B] ${!addrId ? "border-[#E8671B]" : ""}`} data-testid="new-address-btn">+ {t("add_address")}</button></div>}
          {!addrId && <AddressForm value={addr} onChange={setAddr} />}
          {!user && <div className="mt-3"><label className="label">Email (optional)</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="input" data-testid="guest-email" /></div>}
        </section>
        <section className="card p-5"><h2 className="mb-3 text-lg">2. {t("slot")}</h2>
          <div className="flex flex-wrap gap-2">{slots.map((s) => <button key={s.id} onClick={() => setSlot(s.label)} className={`chip !px-4 !py-2 ${slot === s.label ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white"}`} data-testid={`slot-${s.sort}`}>{s.label}</button>)}</div>
          <input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="input mt-3 sm:!w-60" data-testid="delivery-date" /></section>
        <section className="card p-5"><h2 className="mb-3 text-lg">3. {t("payment")}</h2>
          <div className="space-y-2">{methods.map(([k, I, label]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm ${method === k ? "border-[#E8671B] bg-[#fff6ee]" : "bg-white"}`} data-testid={`payment-${k}`}>
              <input type="radio" checked={method === k} onChange={() => setMethod(k)} className="accent-[#E8671B]" /><I size={20} className="text-[#E8671B]" />{label}</label>))}</div>
          {method === "store" && <p className="mt-2 text-xs text-gray-600">{settings.address} · {settings.timings}</p>}
        </section>
      </div>
      <div><PriceBox pr={pr}>{pr && !pr.serviceable && method !== "store" && <p className="mt-2 text-xs text-red-600">{t("not_serviceable")}</p>}
        <button disabled={busy || !pr} onClick={place} className="btn-primary mt-4 w-full !py-3" data-testid="place-order-btn">{busy ? "..." : `${t("place_order")} · ${pr ? inr(pr.total) : ""}`}</button></PriceBox></div>
      {demo && <DemoPay open amount={demo.amount} onClose={() => { toast.message("Payment pending. Retry from the order page."); finish(demo.order); }}
        onPay={async () => { try { await api.post(`/orders/${demo.order.id}/pay/demo`); toast.success("Payment successful"); finish(demo.order); } catch (e) { toast.error(errMsg(e)); } }} />}
    </div>
  );
}
