import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanLine, X } from "lucide-react";
import api, { errMsg, img, inr } from "@/lib/api";
import { PageHead, Pager } from "@/admin/AdminApp";

export function Scanner({ onCode, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    let sc;
    let stopped = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      sc = new Html5Qrcode("qr-reader");
      ref.current = sc;
      sc.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, (code) => { onCode(code); }, () => {})
        .catch(() => toast.error("Camera not available. Type the barcode instead."));
    });
    return () => { stopped = true; ref.current?.stop().catch(() => {}); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" data-testid="barcode-scanner">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4"><div className="mb-2 flex justify-between"><b>Scan barcode / QR</b><button onClick={onClose} data-testid="scanner-close"><X /></button></div>
        <div id="qr-reader" className="overflow-hidden rounded-xl" /></div>
    </div>
  );
}

export function ProductPicker({ onPick, placeholder = "Search product / scan barcode" }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [scan, setScan] = useState(false);
  useEffect(() => {
    if (q.length < 2) { setRes([]); return; }
    const id = setTimeout(() => api.get("/admin/products", { params: { q, limit: 8 } }).then((r) => setRes(r.data.items)), 200);
    return () => clearTimeout(id);
  }, [q]);
  const byCode = async (code) => {
    setScan(false);
    try { const { data } = await api.get(`/admin/products/code/${encodeURIComponent(code)}`); onPick(data); setQ(""); toast.success(data.name); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="relative">
      <div className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q && byCode(q)} placeholder={placeholder} className="input" data-testid="product-picker-input" />
        <button onClick={() => setScan(true)} className="btn-secondary" data-testid="scan-barcode-btn"><ScanLine size={16} />Scan</button></div>
      {res.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">{res.map((p) => (
        <button key={p.id} onClick={() => { onPick(p); setQ(""); setRes([]); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#fbf3ea]" data-testid={`picker-option-${p.sku}`}>
          <img src={img(p.images[0])} alt="" className="h-9 w-9 rounded-lg object-cover" /><span className="flex-1">{p.name}<br /><span className="text-xs text-gray-500">{p.sku} · stock {p.stock}</span></span><b>{inr(p.price)}</b></button>))}</div>}
      {scan && <Scanner onCode={byCode} onClose={() => setScan(false)} />}
    </div>
  );
}

function StockForm({ onDone }) {
  const [p, setP] = useState(null);
  const [f, setF] = useState({ qty: 1, type: "in", note: "" });
  const submit = async () => {
    try { const { data } = await api.post("/admin/stock/adjust", { product_id: p.id, qty: Number(f.qty), type: f.type, note: f.note }); toast.success(`New stock: ${data.stock}`); setP({ ...p, stock: data.stock }); onDone(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="card space-y-3 p-5" data-testid="stock-adjust-form"><h3 className="text-base">Stock in / out</h3>
      <ProductPicker onPick={setP} />
      {p && <div className="flex items-center gap-3 rounded-xl bg-[#fbf3ea] p-3 text-sm"><img src={img(p.images[0])} alt="" className="h-12 w-12 rounded-lg object-cover" /><div className="flex-1"><b>{p.name}</b><br />{p.sku} · Current stock <b data-testid="current-stock">{p.stock}</b></div></div>}
      <div className="grid grid-cols-3 gap-2">
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="input" data-testid="stock-type"><option value="in">Stock IN (purchase)</option><option value="out">Stock OUT</option><option value="damage">Damaged</option><option value="return">Customer return</option></select>
        <input type="number" min="1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} className="input" data-testid="stock-qty" />
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note / bill no." className="input" data-testid="stock-note" /></div>
      <button disabled={!p} onClick={submit} className="btn-primary" data-testid="stock-submit-btn">Update stock</button>
    </div>
  );
}

function Movements({ tick }) {
  const [page, setPage] = useState(1);
  const [d, setD] = useState({ items: [], pages: 1 });
  useEffect(() => { api.get("/admin/stock/movements", { params: { page } }).then((r) => setD(r.data)); }, [page, tick]);
  return (
    <div className="card overflow-x-auto p-4" data-testid="stock-movements"><h3 className="mb-3 text-base">Stock history</h3>
      <table className="admin-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Balance</th><th>Note / Ref</th><th>By</th></tr></thead>
        <tbody>{d.items.map((m) => <tr key={m.id}><td className="text-xs">{new Date(m.created_at).toLocaleString("en-IN")}</td><td>{m.name}<br /><span className="text-xs text-gray-500">{m.sku}</span></td>
          <td className="capitalize">{m.type}</td><td className={m.qty < 0 ? "font-bold text-red-600" : "font-bold text-green-700"}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td><td>{m.balance}</td><td className="text-xs">{m.note} {m.ref}</td><td className="text-xs">{m.by}</td></tr>)}</tbody></table>
      <Pager page={page} pages={d.pages} set={setPage} /></div>
  );
}

function Valuation() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/inventory/valuation").then((r) => setD(r.data)).catch(() => setD(false)); }, []);
  if (d === false) return null;
  if (!d) return <div className="skeleton h-40" />;
  return (
    <div className="card overflow-x-auto p-4" data-testid="inventory-valuation"><h3 className="mb-3 text-base">Inventory valuation</h3>
      <table className="admin-table"><thead><tr><th>Category</th><th>Items</th><th>Units</th><th>At cost</th><th>At selling price</th><th>At MRP</th></tr></thead>
        <tbody>{d.rows.map((r) => <tr key={r.category}><td className="capitalize">{r.category}</td><td>{r.items}</td><td>{r.units}</td><td>{inr(r.cost_value)}</td><td>{inr(r.sale_value)}</td><td>{inr(r.mrp_value)}</td></tr>)}
          <tr className="font-bold"><td>Total</td><td>{d.total.items}</td><td>{d.total.units}</td><td data-testid="valuation-total-cost">{inr(d.total.cost_value)}</td><td>{inr(d.total.sale_value)}</td><td>{inr(d.total.mrp_value)}</td></tr></tbody></table></div>
  );
}

export function Inventory() {
  const [tick, setTick] = useState(0);
  return (
    <div className="space-y-5" data-testid="admin-inventory">
      <PageHead title="Inventory" />
      <div className="grid gap-5 lg:grid-cols-2"><StockForm onDone={() => setTick(tick + 1)} /><Valuation /></div>
      <Movements tick={tick} />
    </div>
  );
}
