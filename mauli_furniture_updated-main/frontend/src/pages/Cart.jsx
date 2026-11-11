import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Tag, MapPin } from "lucide-react";
import api, { img, inr } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { Empty } from "@/components/shop";

export function usePricing(coupon, pincode, method = "") {
  const { cart } = useApp();
  const [pr, setPr] = useState(null);
  const key = JSON.stringify(cart.map((c) => [c.product_id, c.qty, c.variant])) + coupon + pincode + method;
  useEffect(() => {
    if (!cart.length) { setPr(null); return; }
    api.post("/cart/price", { items: cart.map(({ product_id, qty, variant }) => ({ product_id, qty, variant })), coupon, pincode: pincode.length === 6 ? pincode : "", payment_method: method })
      .then((r) => setPr(r.data));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return pr;
}

export function PriceBox({ pr, children }) {
  const { t } = useApp();
  if (!pr) return <div className="skeleton h-64" />;
  const Row = ({ k, v, cls = "", id }) => <div className={`flex justify-between py-1.5 text-sm ${cls}`}><span>{k}</span><span data-testid={id}>{v}</span></div>;
  return (
    <div className="card sticky top-36 p-5" data-testid="price-breakdown">
      <h3 className="mb-2 text-lg">{t("order_summary")}</h3>
      <Row k={`${t("mrp")} total`} v={inr(pr.mrp_total)} cls="text-gray-500" />
      <Row k={t("subtotal")} v={inr(pr.subtotal)} id="summary-subtotal" />
      {pr.discount > 0 && <Row k={`${t("discount")} (${pr.coupon})`} v={`− ${inr(pr.discount)}`} cls="text-green-700" id="summary-discount" />}
      <Row k={t("delivery")} v={!pr.serviceable ? t("not_available") : pr.delivery ? inr(pr.delivery) : t("free_delivery")} id="summary-delivery" />
      <Row k={t("gst")} v={inr(pr.gst_total)} cls="text-gray-500" id="summary-gst" />
      <div className="mt-2 flex justify-between border-t pt-3 text-lg font-bold"><span>{t("total")}</span><span data-testid="summary-total">{inr(pr.total)}</span></div>
      <p className="mt-1 text-xs text-green-700">You save {inr(pr.mrp_total - pr.subtotal + pr.discount)}</p>
      {pr.eta_days && <p className="mt-2 text-xs text-gray-600" data-testid="summary-eta">{t("delivers_in", { d: pr.eta_days })}</p>}
      {pr.warnings?.map((w) => <p key={w} className="mt-1 text-xs text-red-600">{w}</p>)}
      {children}
    </div>
  );
}

function Line({ c, saved }) {
  const { t, L, setQty, removeItem, saveForLater, moveToCart } = useApp();
  return (
    <div className="flex gap-4 border-b py-4 last:border-0" data-testid={`cart-item-${c.slug}`}>
      <Link to={`/product/${c.slug}`}><img src={img(c.image)} alt="" className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28" /></Link>
      <div className="flex flex-1 flex-col">
        <Link to={`/product/${c.slug}`} className="font-semibold hover:text-[#7A1F1F]">{L(c, "name")}</Link>
        {c.variant && <span className="text-xs text-gray-500">{c.variant}</span>}
        <span className="mt-1 font-bold">{inr(c.price)}</span>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          {!saved && <div className="flex items-center rounded-full border bg-white text-sm">
            <button onClick={() => (c.qty > 1 ? setQty(c.product_id, c.variant, c.qty - 1) : removeItem(c.product_id, c.variant))} className="px-3 py-1" data-testid={`cart-minus-${c.slug}`}>−</button>
            <span className="w-6 text-center" data-testid={`cart-qty-${c.slug}`}>{c.qty}</span>
            <button onClick={() => setQty(c.product_id, c.variant, Math.min(50, c.qty + 1))} className="px-3 py-1" data-testid={`cart-plus-${c.slug}`}>+</button></div>}
          {saved ? <button onClick={() => moveToCart(c)} className="text-xs font-semibold text-[#E8671B]" data-testid={`move-to-cart-${c.slug}`}>{t("move_to_cart")}</button>
            : <button onClick={() => saveForLater(c)} className="text-xs font-semibold text-[#7A1F1F]" data-testid={`save-later-${c.slug}`}>{t("save_later")}</button>}
          {!saved && <button onClick={() => removeItem(c.product_id, c.variant)} className="text-gray-400 hover:text-red-600" data-testid={`remove-${c.slug}`}><Trash2 size={16} /></button>}
        </div>
      </div>
    </div>
  );
}

export default function Cart() {
  const { t, cart, saved } = useApp();
  const nav = useNavigate();
  const [coupon, setCoupon] = useState(localStorage.getItem("mfm_coupon") || "");
  const [applied, setApplied] = useState(localStorage.getItem("mfm_coupon") || "");
  const [pin, setPin] = useState(localStorage.getItem("mfm_pin") || "");
  const [coupons, setCoupons] = useState([]);
  const pr = usePricing(applied, pin);
  useTitle(t("cart"));
  useEffect(() => { api.get("/coupons").then((r) => setCoupons(r.data)); }, []);
  const apply = (c) => { setApplied(c); setCoupon(c); localStorage.setItem("mfm_coupon", c); };
  if (!cart.length && !saved.length) return <Empty title={t("empty_cart")} action={<Link to="/products" className="btn-primary" data-testid="continue-shopping-btn">{t("continue_shopping")}</Link>} />;
  return (
    <div className="container-x grid gap-6 py-6 lg:grid-cols-3" data-testid="cart-page">
      <div className="space-y-6 lg:col-span-2">
        <div className="card p-5"><h1 className="text-2xl">{t("cart")} ({cart.length})</h1>
          {cart.length ? cart.map((c) => <Line key={c.product_id + c.variant} c={c} />) : <p className="py-6 text-sm text-gray-500">{t("empty_cart")}</p>}</div>
        {saved.length > 0 && <div className="card p-5" data-testid="saved-for-later"><h2 className="text-lg">{t("saved_later")} ({saved.length})</h2>{saved.map((c) => <Line key={c.product_id} c={c} saved />)}</div>}
      </div>
      {cart.length > 0 && <div className="space-y-4">
        <div className="card space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><Tag size={16} className="text-[#E8671B]" />{t("coupon")}</p>
          <div className="flex gap-2"><input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} className="input" placeholder={t("coupon")} data-testid="coupon-input" />
            <button onClick={() => apply(coupon)} className="btn-secondary" data-testid="apply-coupon-btn">{t("apply")}</button></div>
          {pr?.coupon_msg && <p className={`text-xs ${pr.coupon ? "text-green-700" : "text-red-600"}`} data-testid="coupon-msg">{pr.coupon_msg}</p>}
          <div className="flex flex-wrap gap-2">{coupons.map((c) => <button key={c.code} onClick={() => apply(c.code)} title={c.description} className="chip border-dashed border-[#E8671B] bg-[#fff6ee] text-[#7A1F1F]" data-testid={`coupon-chip-${c.code}`}>{c.code}</button>)}</div>
          <p className="flex items-center gap-2 pt-2 text-sm font-semibold"><MapPin size={16} className="text-[#E8671B]" />{t("pincode")}</p>
          <input value={pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPin(v); localStorage.setItem("mfm_pin", v); }} className="input" placeholder="411001" data-testid="cart-pincode-input" />
          {pr && pin.length === 6 && !pr.serviceable && <p className="text-xs text-red-600">{t("not_serviceable")}</p>}
        </div>
        <PriceBox pr={pr}><button onClick={() => nav("/checkout")} className="btn-primary mt-4 w-full !py-3" data-testid="checkout-btn">{t("checkout")} →</button></PriceBox>
      </div>}
    </div>
  );
}
