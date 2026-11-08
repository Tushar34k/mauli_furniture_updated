import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, FileText, XCircle, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api, { errMsg, img, inr, openFile } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { translate } from "@/lib/i18n";
import { PageSkeleton, Empty } from "@/components/shop";
import { payWithRazorpay } from "@/pages/Checkout";

const FLOW = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

export function Timeline({ o, en }) {
  const { t: tt } = useApp();
  const t = en ? (k) => translate("en", k) : tt;
  const at = Object.fromEntries((o.timeline || []).map((x) => [x.status, x.at]));
  if (o.status === "cancelled") return <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" data-testid="order-cancelled">{t("cancelled")}</p>;
  const cur = FLOW.indexOf(o.status);
  return (
    <ol className="relative ml-3 border-l-2 border-[#f0e2d3]" data-testid="order-timeline">
      {FLOW.map((s, i) => (
        <li key={s} className="mb-5 ml-5 last:mb-0">
          <span className={`absolute -left-[9px] grid h-4 w-4 place-items-center rounded-full ${i <= cur ? "bg-[#E8671B]" : "bg-gray-200"}`} />
          <p className={`text-sm font-semibold ${i <= cur ? "text-[#7A1F1F]" : "text-gray-400"}`}>{t(s)}</p>
          {at[s] && <p className="text-xs text-gray-500">{new Date(at[s]).toLocaleString("en-IN")}</p>}
        </li>))}
    </ol>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { t, L, settings } = useApp();
  const [o, setO] = useState(null);
  const [err, setErr] = useState(false);
  const [ret, setRet] = useState(null);
  const [reason, setReason] = useState("");
  const phone = sessionStorage.getItem("mfm_guest_phone") || "";
  const q = phone ? `?phone=${phone}` : "";
  const load = () => api.get(`/orders/${id}${q}`).then((r) => setO(r.data)).catch(() => setErr(true));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useTitle(o ? `Order ${o.order_no}` : "Order");
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); load(); } catch (e) { toast.error(errMsg(e)); } };
  if (err) return <Empty title="Order not found" action={<Link to="/account?tab=orders" className="btn-primary">{t("my_orders")}</Link>} />;
  if (!o) return <PageSkeleton />;
  return (
    <div className="container-x max-w-5xl py-6" data-testid="order-detail-page">
      {sp.get("new") && o.status !== "cancelled" && <div className="card mb-5 flex items-center gap-4 border-green-200 bg-green-50 p-5 fade-up" data-testid="order-success">
        <CheckCircle2 className="text-green-600" size={40} /><div><h1 className="text-xl !text-green-800">{t("order_placed")}</h1><p className="text-sm">#{o.order_no} · {inr(o.total)}</p></div></div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card space-y-4 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl" data-testid="order-number">#{o.order_no}</h2>
            <span className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString("en-IN")}</span></div>
          {o.items.map((it) => (
            <div key={it.product_id + it.variant} className="flex gap-3 border-b pb-3 last:border-0">
              <img src={img(it.image)} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="flex-1 text-sm"><p className="font-semibold">{L(it, "name")}</p><p className="text-gray-500">{it.variant} × {it.qty}</p></div>
              <p className="font-semibold">{inr(it.price * it.qty)}</p></div>))}
          <div className="space-y-1 text-sm"><div className="flex justify-between"><span>{t("subtotal")}</span><span>{inr(o.subtotal)}</span></div>
            {o.discount > 0 && <div className="flex justify-between text-green-700"><span>{t("discount")} {o.coupon}</span><span>− {inr(o.discount)}</span></div>}
            <div className="flex justify-between"><span>{t("delivery")}</span><span>{o.delivery ? inr(o.delivery) : t("free_delivery")}</span></div>
            <div className="flex justify-between text-gray-500"><span>{t("gst")}</span><span>{inr(o.gst_total)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>{t("total")}</span><span>{inr(o.total)}</span></div></div>
          <p className="text-sm"><b>{t("payment")}:</b> {o.payment_method.toUpperCase()} · <span data-testid="payment-status">{t(`pay_${o.payment_status}`)}</span></p>
          <p className="text-sm"><b>{t("address")}:</b> {o.address.name}, {o.address.line1} {o.address.line2}, {o.address.city} {o.address.pincode} · {o.address.phone}</p>
          {o.slot && <p className="text-sm"><b>Slot:</b> {o.slot} {o.delivery_date}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => openFile(`/orders/${o.id}/invoice${q}`)} className="btn-outline !py-2" data-testid="download-invoice-btn"><FileText size={16} />{t("invoice")}</button>
            {o.payment_method === "razorpay" && ["pending", "failed"].includes(o.payment_status) && settings.razorpay_enabled && o.status !== "cancelled" &&
              <button onClick={() => act(async () => { const { data } = await api.post(`/orders/${o.id}/pay/retry${q}`); await payWithRazorpay(data.payment, o.address, settings, async (r) => { await api.post(`/orders/${o.id}/pay/verify`, r); load(); }); }, "Opening payment")} className="btn-primary !py-2" data-testid="retry-payment-btn">Pay now</button>}
            {["placed", "confirmed", "packed"].includes(o.status) && <button onClick={() => window.confirm("Cancel this order?") && act(() => api.post(`/orders/${o.id}/cancel${q}`), "Order cancelled")} className="btn-ghost !py-2 text-red-600" data-testid="cancel-order-btn"><XCircle size={16} />{t("cancel")}</button>}
            {o.status === "delivered" && !o.return_request && !phone && <>
              <button onClick={() => setRet("return")} className="btn-ghost !py-2" data-testid="return-order-btn"><RotateCcw size={16} />{t("return")}</button>
              <button onClick={() => setRet("replace")} className="btn-ghost !py-2" data-testid="replace-order-btn"><RotateCcw size={16} />{t("replace")}</button></>}
          </div>
          {o.return_request && <p className="rounded-xl bg-[#fffbeb] p-3 text-sm" data-testid="return-status">{o.return_request.type} request: <b>{o.return_request.status}</b> — {o.return_request.reason}</p>}
        </div>
        <div className="card p-5"><h3 className="mb-4 text-lg">{t("track")}</h3><Timeline o={o} /></div>
      </div>
      <Dialog open={!!ret} onOpenChange={(v) => !v && setRet(null)}>
        <DialogContent><DialogHeader><DialogTitle>{ret === "return" ? t("return") : t("replace")}</DialogTitle></DialogHeader>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input min-h-[100px]" placeholder="Reason" data-testid="return-reason" />
          <button disabled={reason.length < 3} onClick={() => act(() => api.post(`/orders/${o.id}/return`, { type: ret, reason }), "Request submitted").then(() => setRet(null))} className="btn-primary" data-testid="return-submit-btn">{t("submit")}</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
