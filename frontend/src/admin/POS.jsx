import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Banknote, Smartphone, CreditCard, FileText, CheckCircle2 } from "lucide-react";
import api, { errMsg, img, inr, openFile } from "@/lib/api";
import { useApp } from "@/lib/store";
import { ProductPicker } from "@/admin/Inventory";
import { PageHead } from "@/admin/AdminApp";

export function POS() {
  const { user } = useApp();
  const [lines, setLines] = useState([]);
  const [cust, setCust] = useState({ name: "", phone: "" });
  const [disc, setDisc] = useState(0);
  const [mode, setMode] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const canPrice = ["owner", "manager"].includes(user.role);
  const add = (p) => {
    if (p.stock <= 0) { toast.error("Out of stock"); return; }
    setLines((l) => { const i = l.findIndex((x) => x.id === p.id); if (i >= 0) { const n = [...l]; n[i] = { ...n[i], qty: Math.min(n[i].qty + 1, p.stock) }; return n; } return [...l, { ...p, qty: 1, unit: p.price }]; });
  };
  const upd = (id, k, v) => setLines((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const sub = lines.reduce((a, b) => a + Number(b.unit) * b.qty, 0);
  const total = Math.max(0, sub - Number(disc || 0));
  const sell = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/pos/sale", { items: lines.map((l) => ({ product_id: l.id, qty: l.qty, price: canPrice ? Number(l.unit) : null })), customer_name: cust.name || "Walk-in Customer", phone: cust.phone, payment_mode: mode, discount: Number(disc || 0) });
      setDone(data); setLines([]); setDisc(0); setCust({ name: "", phone: "" }); toast.success(`Sale ${data.order_no} completed`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div data-testid="admin-pos">
      <PageHead title="Showroom POS" />
      {done && <div className="card mb-4 flex flex-wrap items-center gap-3 border-green-200 bg-green-50 p-4" data-testid="pos-success"><CheckCircle2 className="text-green-600" /><b>Sale #{done.order_no} · {inr(done.total)}</b>
        <button onClick={() => openFile(`/admin/orders/${done.id}/invoice`)} className="btn-secondary ml-auto !py-2" data-testid="pos-print-invoice"><FileText size={15} />Print GST invoice</button><button onClick={() => setDone(null)} className="btn-ghost !py-2">New sale</button></div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          <ProductPicker onPick={add} placeholder="Search product, type SKU/barcode + Enter, or scan" />
          {lines.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">Scan or search products to add them to the bill.</p> :
            <table className="admin-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th><th /></tr></thead><tbody>{lines.map((l) => (
              <tr key={l.id} data-testid={`pos-line-${l.sku}`}><td><div className="flex items-center gap-2"><img src={img(l.images[0])} alt="" className="h-9 w-9 rounded-lg object-cover" /><span>{l.name}<br /><span className="text-xs text-gray-500">{l.sku} · stock {l.stock}</span></span></div></td>
                <td><input type="number" min="1" max={l.stock} value={l.qty} onChange={(e) => upd(l.id, "qty", Math.max(1, Math.min(l.stock, Number(e.target.value))))} className="input !w-16 !py-1" data-testid={`pos-qty-${l.sku}`} /></td>
                <td>{canPrice ? <input type="number" value={l.unit} onChange={(e) => upd(l.id, "unit", e.target.value)} className="input !w-24 !py-1" /> : inr(l.unit)}</td>
                <td className="font-semibold">{inr(l.unit * l.qty)}</td><td><button onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="text-red-500"><Trash2 size={15} /></button></td></tr>))}</tbody></table>}
        </div>
        <div className="card space-y-3 p-5">
          <div><label className="label">Customer name</label><input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} className="input" placeholder="Walk-in Customer" data-testid="pos-customer-name" /></div>
          <div><label className="label">Phone (optional)</label><input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="input" data-testid="pos-customer-phone" /></div>
          <div><label className="label">Discount (₹)</label><input type="number" value={disc} onChange={(e) => setDisc(e.target.value)} className="input" data-testid="pos-discount" /></div>
          <div className="grid grid-cols-3 gap-2">{[["cash", Banknote], ["upi", Smartphone], ["card", CreditCard]].map(([k, I]) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded-xl border p-3 text-xs font-semibold uppercase ${mode === k ? "border-[#E8671B] bg-[#fff6ee] text-[#7A1F1F]" : "bg-white"}`} data-testid={`pos-mode-${k}`}><I className="mx-auto mb-1" size={18} />{k}</button>))}</div>
          <div className="border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{inr(sub)}</span></div><div className="flex justify-between"><span>Discount</span><span>− {inr(disc)}</span></div>
            <div className="mt-1 flex justify-between text-xl font-extrabold"><span>Total</span><span data-testid="pos-total">{inr(total)}</span></div><p className="text-xs text-gray-500">Prices include GST</p></div>
          <button disabled={!lines.length || busy} onClick={sell} className="btn-primary w-full !py-3" data-testid="pos-complete-sale">Complete sale</button>
        </div>
      </div>
    </div>
  );
}
