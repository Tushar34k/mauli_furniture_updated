import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Package } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import api, { errMsg, img, inr, openFile } from "@/lib/api";
import { useApp } from "@/lib/store";
import { Timeline } from "@/pages/OrderDetail";
import { PageHead, Pager } from "@/admin/AdminApp";

const FLOW = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
const pill = (s) => `rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${s === "delivered" ? "bg-green-100 text-green-700" : s === "cancelled" ? "bg-red-100 text-red-700" : "bg-[#fff1d6] text-[#7A1F1F]"}`;

function OrderSheet({ id, onClose, onChange }) {
  const { user } = useApp();
  const [o, setO] = useState(null);
  const [staff, setStaff] = useState([]);
  const [note, setNote] = useState("");
  const load = () => api.get(`/admin/orders/${id}`).then((r) => { setO(r.data); setNote(r.data.notes || ""); });
  useEffect(() => { load(); if (user.role !== "delivery") api.get("/admin/staff").then((r) => setStaff(r.data.filter((s) => s.role === "delivery"))); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn, msg) => { try { await fn(); toast.success(msg); load(); onChange(); } catch (e) { toast.error(errMsg(e)); } };
  const isDel = user.role === "delivery";
  const mgr = ["owner", "manager"].includes(user.role);
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="admin-order-sheet">
        <SheetHeader><SheetTitle className="text-[#7A1F1F]">{o ? `#${o.order_no}` : "..."}</SheetTitle></SheetHeader>
        {o && <div className="mt-4 space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><span className={pill(o.status)} data-testid="admin-order-status">{o.status.replace(/_/g, " ")}</span><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] uppercase">{o.channel}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">{o.payment_method} · {o.payment_status}</span></div>
          <div className="rounded-xl bg-[#fbf3ea] p-3"><b>{o.address.name}</b> · <a href={`tel:${o.address.phone}`} className="text-[#E8671B]">{o.address.phone}</a><br />{o.address.line1} {o.address.line2}, {o.address.city} {o.address.pincode}<br />Slot: {o.slot} {o.delivery_date}</div>
          {o.items.map((it) => <div key={it.product_id + it.variant} className="flex items-center gap-3"><img src={img(it.image)} alt="" className="h-12 w-12 rounded-lg object-cover" /><span className="flex-1">{it.name} {it.variant} <span className="text-gray-500">× {it.qty}</span><br /><span className="text-xs text-gray-500">{it.sku}</span></span><b>{inr(it.price * it.qty)}</b></div>)}
          <p className="text-right">Discount {inr(o.discount)} · Delivery {inr(o.delivery)} · GST {inr(o.gst_total)} · <b className="text-base">Total {inr(o.total)}</b></p>
          <div><p className="label">Update status</p><div className="flex flex-wrap gap-1.5">{FLOW.filter((s) => !isDel || ["out_for_delivery", "delivered"].includes(s)).map((s) => (
            <button key={s} disabled={FLOW.indexOf(s) <= FLOW.indexOf(o.status) || o.status === "cancelled"} onClick={() => run(() => api.put(`/admin/orders/${o.id}/status`, { status: s }), "Status updated")} className="chip bg-white capitalize hover:border-[#E8671B] disabled:opacity-40" data-testid={`set-status-${s}`}>{s.replace(/_/g, " ")}</button>))}
            {!isDel && o.status !== "cancelled" && o.status !== "delivered" && <button onClick={() => window.confirm("Cancel order and restock?") && run(() => api.put(`/admin/orders/${o.id}/status`, { status: "cancelled" }), "Cancelled")} className="chip border-red-300 bg-white text-red-600" data-testid="set-status-cancelled">cancel</button>}</div></div>
          {!isDel && <div className="grid grid-cols-2 gap-2">
            <div><p className="label">Assign delivery</p><select value={o.assigned_to || ""} onChange={(e) => run(() => api.put(`/admin/orders/${o.id}`, { assigned_to: e.target.value }), "Assigned")} className="input" data-testid="assign-delivery-select"><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><p className="label">Payment status</p><select value={o.payment_status} onChange={(e) => run(() => api.put(`/admin/orders/${o.id}`, { payment_status: e.target.value }), "Updated")} className="input" data-testid="payment-status-select">{["pending", "paid", "refund_pending", "refunded"].map((s) => <option key={s}>{s}</option>)}</select></div></div>}
          {!isDel && <div><p className="label">Internal notes</p><textarea value={note} onChange={(e) => setNote(e.target.value)} className="input min-h-[70px]" data-testid="order-notes" />
            <button onClick={() => run(() => api.put(`/admin/orders/${o.id}`, { notes: note }), "Notes saved")} className="btn-outline mt-2 !py-1.5" data-testid="save-notes-btn">Save notes</button></div>}
          {o.return_request && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3" data-testid="return-request-box"><b className="capitalize">{o.return_request.type} request</b> — {o.return_request.status}<br />{o.return_request.reason}
            {mgr && <div className="mt-2 flex flex-wrap gap-1.5">{({ requested: ["approved", "rejected"], approved: [o.return_request.type === "return" ? "refunded" : "replaced"] }[o.return_request.status] || []).map((a) => <button key={a} onClick={() => run(() => api.post(`/admin/orders/${o.id}/return/${a}`), a)} className="chip bg-white capitalize" data-testid={`return-${a}`}>{a}</button>)}</div>}</div>}
          <div className="flex gap-2"><button onClick={() => openFile(`/admin/orders/${o.id}/invoice`)} className="btn-secondary !py-2" data-testid="print-invoice-btn"><FileText size={15} />Invoice</button>
            <button onClick={() => openFile(`/admin/orders/${o.id}/packing-slip`)} className="btn-outline !py-2" data-testid="print-packing-slip-btn"><Package size={15} />Packing slip</button></div>
          <div><p className="label">Timeline</p><Timeline o={o} en /></div>
        </div>}
      </SheetContent>
    </Sheet>
  );
}

export function Orders() {
  const [sp, setSp] = useSearchParams();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState({ items: [], pages: 1, total: 0 });
  const load = () => api.get("/admin/orders", { params: { status, channel, q, page } }).then((r) => setD(r.data));
  useEffect(() => { load(); }, [status, channel, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = sp.get("open");
  return (
    <div data-testid="admin-orders">
      <PageHead title={`Orders (${d.total})`} />
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">{["", ...FLOW, "cancelled", "returns"].map((s) => (
        <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`chip shrink-0 capitalize ${status === s ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white"}`} data-testid={`order-filter-${s || "all"}`}>{(s || "all").replace(/_/g, " ")}</button>))}</div>
      <div className="mb-3 flex flex-wrap gap-2"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Order no / name / phone" className="input max-w-xs" data-testid="order-search" />
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input !w-auto" data-testid="order-channel-filter"><option value="">All channels</option><option value="online">Online</option><option value="pos">Showroom POS</option></select></div>
      <div className="card overflow-x-auto"><table className="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead>
        <tbody>{d.items.map((o) => (
          <tr key={o.id} onClick={() => setSp({ open: o.id })} className="cursor-pointer hover:bg-[#fffaf5]" data-testid={`admin-order-row-${o.order_no}`}>
            <td className="font-semibold text-[#E8671B]">{o.order_no}{o.return_request && <span className="badge-deal ml-1">RET</span>}</td><td className="text-xs">{new Date(o.created_at).toLocaleString("en-IN")}</td>
            <td>{o.address.name}<br /><span className="text-xs text-gray-500">{o.address.phone}</span></td><td>{o.items.reduce((a, b) => a + b.qty, 0)}</td>
            <td className="text-xs uppercase">{o.payment_method}<br /><span className="normal-case text-gray-500">{o.payment_status}</span></td><td><span className={pill(o.status)}>{o.status.replace(/_/g, " ")}</span></td><td className="font-semibold">{inr(o.total)}</td></tr>))}</tbody></table></div>
      <Pager page={page} pages={d.pages} set={setPage} />
      {open && <OrderSheet id={open} onClose={() => setSp({})} onChange={load} />}
    </div>
  );
}

export function Customers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState({ items: [], pages: 1, total: 0 });
  const [sel, setSel] = useState(null);
  const [notes, setNotes] = useState("");
  useEffect(() => { api.get("/admin/customers", { params: { q, page } }).then((r) => setD(r.data)); }, [q, page]);
  const open = async (id) => { const { data } = await api.get(`/admin/customers/${id}`); setSel(data); setNotes(data.admin_notes || ""); };
  return (
    <div data-testid="admin-customers">
      <PageHead title={`Customers (${d.total})`} />
      <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name / phone / email" className="input mb-3 max-w-xs" data-testid="customer-search" />
      <div className="card overflow-x-auto"><table className="admin-table"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th>Orders</th><th>Spent</th></tr></thead>
        <tbody>{d.items.map((c) => <tr key={c.id} onClick={() => open(c.id)} className="cursor-pointer hover:bg-[#fffaf5]" data-testid={`customer-row-${c.id}`}><td className="font-semibold">{c.name || "—"}</td><td>{c.phone}</td><td>{c.email}</td><td className="text-xs">{c.created_at?.slice(0, 10)}</td><td>{c.orders}</td><td>{inr(c.spent)}</td></tr>)}</tbody></table></div>
      <Pager page={page} pages={d.pages} set={setPage} />
      {sel && <Sheet open onOpenChange={(v) => !v && setSel(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-lg" data-testid="customer-sheet">
        <SheetHeader><SheetTitle className="text-[#7A1F1F]">{sel.name || sel.phone}</SheetTitle></SheetHeader>
        <div className="mt-3 space-y-3 text-sm"><p>{sel.phone} · {sel.email}</p>{(sel.addresses || []).map((a) => <p key={a.id} className="rounded-lg bg-[#fbf3ea] p-2 text-xs">{a.line1}, {a.city} {a.pincode}</p>)}
          <div><p className="label">Notes</p><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" data-testid="customer-notes" />
            <button onClick={async () => { await api.put(`/admin/customers/${sel.id}/notes`, { notes }); toast.success("Saved"); }} className="btn-outline mt-2 !py-1.5" data-testid="customer-notes-save">Save</button></div>
          <p className="label">Order history</p>{sel.order_list.map((o) => <div key={o.id} className="flex justify-between border-b py-2"><span>{o.order_no} · {o.created_at.slice(0, 10)}</span><span className={pill(o.status)}>{o.status}</span><b>{inr(o.total)}</b></div>)}</div>
      </SheetContent></Sheet>}
    </div>
  );
}
