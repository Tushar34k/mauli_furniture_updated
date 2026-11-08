import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Upload, Download, Plus, Trash2, QrCode, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api, { errMsg, img, inr, openFile } from "@/lib/api";
import { useApp } from "@/lib/store";
import { PageHead, Pager } from "@/admin/AdminApp";

const CATS = ["sofa", "bed", "dining", "wardrobe", "office", "storage", "mattress", "study-table", "decor", "outdoor"];

function BulkUpload({ onDone }) {
  const [busy, setBusy] = useState(false);
  const up = async (file) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    try { const { data } = await api.post("/admin/products/bulk-upload", fd); toast.success(`Created ${data.created}, updated ${data.updated}`); data.errors.slice(0, 3).forEach((e) => toast.error(e)); onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (<>
    <button onClick={() => openFile("/admin/products-template", "products-template.csv")} className="btn-outline" data-testid="download-template-btn"><Download size={16} />CSV template</button>
    <label className="btn-outline cursor-pointer" data-testid="bulk-upload-label"><Upload size={16} />{busy ? "Uploading..." : "Bulk upload (CSV/Excel)"}<input type="file" accept=".csv,.xlsx" hidden onChange={(e) => e.target.files[0] && up(e.target.files[0])} data-testid="bulk-upload-input" /></label>
  </>);
}

export function Label({ p, onClose }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs"><DialogHeader><DialogTitle>Barcode / QR label</DialogTitle></DialogHeader>
        <div id="qr-label" className="space-y-2 text-center" data-testid="qr-label"><QRCodeSVG value={p.barcode || p.sku} size={160} className="mx-auto" />
          <p className="font-mono text-sm">{p.barcode}</p><p className="text-xs font-semibold">{p.name}</p><p className="text-xs">SKU {p.sku} · {inr(p.price)}</p></div>
        <button onClick={() => window.print()} className="btn-primary">Print</button>
      </DialogContent>
    </Dialog>
  );
}

export function Products() {
  const { user } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState({ items: [], pages: 1, total: 0 });
  const [sel, setSel] = useState([]);
  const [pct, setPct] = useState("");
  const [label, setLabel] = useState(null);
  const load = () => api.get("/admin/products", { params: { q, category: cat, stock, page } }).then((r) => setD(r.data));
  useEffect(() => { load(); }, [q, cat, stock, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const mgr = ["owner", "manager"].includes(user.role);
  const bulk = async (body) => { try { await api.post("/admin/products/bulk-edit", { ids: sel, ...body }); toast.success("Updated"); setSel([]); load(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (id) => { if (window.confirm("Delete product?")) { await api.delete(`/admin/products/${id}`); load(); } };
  return (
    <div data-testid="admin-products">
      <PageHead title={`Products (${d.total})`}>{mgr && <BulkUpload onDone={load} />}<Link to="/admin/products/new" className="btn-primary" data-testid="add-product-btn"><Plus size={16} />Add product</Link></PageHead>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name / SKU / barcode" className="input max-w-xs" data-testid="product-search" />
        <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }} className="input !w-auto" data-testid="product-cat-filter"><option value="">All categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} className="input !w-auto" data-testid="product-stock-filter"><option value="">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
      </div>
      {sel.length > 0 && mgr && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#fff1d6] p-3 text-sm" data-testid="bulk-edit-bar"><b>{sel.length} selected</b>
        <input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Price ±%" className="input !w-28 !py-1.5" data-testid="bulk-price-pct" /><button onClick={() => bulk({ price_change_pct: Number(pct) })} className="btn-secondary !py-1.5" data-testid="bulk-price-apply">Apply %</button>
        <button onClick={() => bulk({ set: { is_deal: true } })} className="btn-outline !py-1.5">Mark deal</button><button onClick={() => bulk({ set: { is_deal: false } })} className="btn-outline !py-1.5">Remove deal</button>
        <button onClick={() => bulk({ set: { active: false } })} className="btn-outline !py-1.5">Hide</button><button onClick={() => bulk({ set: { active: true } })} className="btn-outline !py-1.5">Show</button></div>}
      <div className="card overflow-x-auto"><table className="admin-table"><thead><tr><th><input type="checkbox" onChange={(e) => setSel(e.target.checked ? d.items.map((p) => p.id) : [])} /></th><th>Product</th><th>SKU</th><th>Category</th><th>Cost</th><th>Price</th><th>MRP</th><th>Stock</th><th>Location</th><th /></tr></thead>
        <tbody>{d.items.map((p) => (
          <tr key={p.id} data-testid={`admin-product-row-${p.sku}`} className={!p.active ? "opacity-50" : ""}>
            <td><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /></td>
            <td><div className="flex items-center gap-2"><img src={img(p.images[0])} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="max-w-[220px] font-medium">{p.name}{p.is_deal && <span className="badge-deal ml-1">Deal</span>}</span></div></td>
            <td className="font-mono text-xs">{p.sku}</td><td className="capitalize">{p.category}</td><td>{inr(p.purchase_price)}</td><td className="font-semibold">{inr(p.price)}</td><td className="text-gray-400">{inr(p.mrp)}</td>
            <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.stock <= 0 ? "bg-red-100 text-red-700" : p.stock <= p.reorder_level ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>{p.stock}</span></td>
            <td className="text-xs">{p.location}</td>
            <td className="whitespace-nowrap"><button onClick={() => setLabel(p)} className="p-1 text-gray-500" title="QR label" data-testid={`qr-btn-${p.sku}`}><QrCode size={16} /></button>
              <Link to={`/admin/products/${p.id}`} className="px-2 text-xs font-semibold text-[#E8671B]" data-testid={`edit-product-${p.sku}`}>Edit</Link>
              {mgr && <button onClick={() => del(p.id)} className="p-1 text-red-500" data-testid={`delete-product-${p.sku}`}><Trash2 size={15} /></button>}</td></tr>))}</tbody></table></div>
      <Pager page={page} pages={d.pages} set={setPage} />
      {label && <Label p={label} onClose={() => setLabel(null)} />}
    </div>
  );
}

const EMPTY = { name: "", name_mr: "", category: "sofa", brand: "", material: "", color: "", room: "", description: "", description_mr: "", images: [], video: "", variants: [], sku: "", barcode: "",
  purchase_price: 0, price: "", mrp: "", gst: 18, stock: 0, reorder_level: 5, supplier: "", location: "", dimensions: "", weight: "", specs: {}, warranty: "1 Year", assembly: "free_installation", delivery_days: 5, is_deal: false, active: true };

export function ProductForm() {
  const { settings } = useApp();
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState(id ? null : EMPTY);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) api.get(`/admin/products/${id}`).then((r) => setF(r.data)); }, [id]);
  if (!f) return <div className="skeleton h-96" />;
  const set = (k, v) => setF({ ...f, [k]: v });
  const upload = async (files) => {
    const fd = new FormData(); [...files].forEach((x) => fd.append("files", x));
    try { const { data } = await api.post("/admin/upload", fd); set("images", [...f.images, ...data.urls]); toast.success("Uploaded"); } catch (e) { toast.error(errMsg(e)); }
  };
  const save = async () => {
    setBusy(true);
    const body = { ...f, price: Number(f.price), mrp: Number(f.mrp), purchase_price: Number(f.purchase_price), gst: Number(f.gst), stock: Number(f.stock), reorder_level: Number(f.reorder_level), delivery_days: Number(f.delivery_days),
      variants: f.variants.filter((v) => v.value).map((v) => ({ ...v, price_delta: Number(v.price_delta) || 0 })) };
    try { if (id) await api.put(`/admin/products/${id}`, body); else await api.post("/admin/products", body); toast.success("Saved"); nav("/admin/products"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const inp = (k, label, type = "text") => <div><label className="label">{label}</label><input type={type} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="input" data-testid={`pf-${k}`} /></div>;
  const specs = Object.entries(f.specs || {});
  return (
    <div data-testid="product-form">
      <PageHead title={id ? "Edit product" : "Add product"}><button onClick={() => nav(-1)} className="btn-outline">Cancel</button><button disabled={busy} onClick={save} className="btn-primary" data-testid="pf-save-btn">Save product</button></PageHead>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card space-y-4 p-5 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">{inp("name", "Name (English)")}{inp("name_mr", "नाव (मराठी)")}
            <div><label className="label">Category</label><select value={f.category} onChange={(e) => set("category", e.target.value)} className="input" data-testid="pf-category">{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            {inp("brand", "Brand")}{inp("material", "Material")}{inp("color", "Colour")}{inp("dimensions", "Dimensions")}{inp("weight", "Weight")}{inp("warranty", "Warranty")}
            <div><label className="label">Assembly</label><select value={f.assembly} onChange={(e) => set("assembly", e.target.value)} className="input" data-testid="pf-assembly"><option value="free_installation">Free installation</option><option value="diy">DIY</option></select></div>
            {inp("video", "Video embed URL (YouTube embed)")}{inp("delivery_days", "Delivery days", "number")}</div>
          <div><label className="label">Description</label><textarea value={f.description} onChange={(e) => set("description", e.target.value)} className="input min-h-[90px]" data-testid="pf-description" /></div>
          <div><label className="label">वर्णन (मराठी)</label><textarea value={f.description_mr} onChange={(e) => set("description_mr", e.target.value)} className="input min-h-[70px]" /></div>
          <div><label className="label">Images</label><div className="flex flex-wrap gap-2">{f.images.map((u, i) => (
            <div key={u + i} className="relative"><img src={img(u)} alt="" className="h-20 w-20 rounded-xl object-cover" />{i === 0 && <span className="badge-deal absolute bottom-1 left-1 !text-[9px]">Main</span>}
              <button onClick={() => set("images", f.images.filter((_, k) => k !== i))} className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white" data-testid={`pf-remove-img-${i}`}><X size={12} /></button>
              {i > 0 && <button onClick={() => { const n = [...f.images]; [n[0], n[i]] = [n[i], n[0]]; set("images", n); }} className="absolute bottom-1 right-1 rounded bg-white/90 px-1 text-[9px]">Main</button>}</div>))}
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-gray-400" title={settings.upload_enabled ? "Upload" : "Storage not configured - paste image URL"}><Upload /><input type="file" accept="image/*" multiple hidden disabled={!settings.upload_enabled} onChange={(e) => upload(e.target.files)} data-testid="pf-image-upload" /></label></div>
            {!settings.upload_enabled && <p className="mt-1 text-xs text-amber-700">Image upload needs Cloudinary/S3 (Admin › Integrations). Paste image URLs below meanwhile.</p>}
            <div className="mt-2 flex gap-2"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="or paste image URL" className="input" /><button onClick={() => { if (url) { set("images", [...f.images, url]); setUrl(""); } }} className="btn-outline">Add</button></div></div>
          <div><label className="label">Variants (colour / material / size)</label>{f.variants.map((v, i) => (
            <div key={i} className="mb-2 flex gap-2"><select value={v.type} onChange={(e) => set("variants", f.variants.map((x, k) => (k === i ? { ...x, type: e.target.value } : x)))} className="input !w-32"><option>size</option><option>colour</option><option>material</option></select>
              <input value={v.value} placeholder="Value" onChange={(e) => set("variants", f.variants.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} className="input" />
              <input value={v.price_delta} type="number" placeholder="+₹" onChange={(e) => set("variants", f.variants.map((x, k) => (k === i ? { ...x, price_delta: e.target.value } : x)))} className="input !w-28" />
              <button onClick={() => set("variants", f.variants.filter((_, k) => k !== i))} className="text-red-500"><Trash2 size={16} /></button></div>))}
            <button onClick={() => set("variants", [...f.variants, { type: "size", value: "", price_delta: 0 }])} className="btn-ghost !px-2 text-xs" data-testid="pf-add-variant">+ Add variant</button></div>
          <div><label className="label">Specifications</label>{specs.map(([k, v], i) => (
            <div key={i} className="mb-2 flex gap-2"><input value={k} onChange={(e) => { const n = [...specs]; n[i] = [e.target.value, v]; set("specs", Object.fromEntries(n)); }} className="input" />
              <input value={v} onChange={(e) => { const n = [...specs]; n[i] = [k, e.target.value]; set("specs", Object.fromEntries(n)); }} className="input" />
              <button onClick={() => set("specs", Object.fromEntries(specs.filter((_, x) => x !== i)))} className="text-red-500"><Trash2 size={16} /></button></div>))}
            <button onClick={() => set("specs", { ...f.specs, [`Spec ${specs.length + 1}`]: "" })} className="btn-ghost !px-2 text-xs">+ Add spec</button></div>
        </div>
        <div className="space-y-5">
          <div className="card grid grid-cols-2 gap-3 p-5"><h3 className="col-span-2 text-base">Pricing & GST</h3>{inp("purchase_price", "Purchase price", "number")}{inp("price", "Selling price", "number")}{inp("mrp", "MRP", "number")}{inp("gst", "GST %", "number")}
            {f.price && f.purchase_price > 0 && <p className="col-span-2 text-xs text-green-700">Margin: {inr(f.price * 100 / (100 + Number(f.gst)) - f.purchase_price)} per unit (ex-GST)</p>}</div>
          <div className="card grid grid-cols-2 gap-3 p-5"><h3 className="col-span-2 text-base">Inventory</h3>{inp("sku", "SKU (auto if blank)")}{inp("barcode", "Barcode (auto if blank)")}{inp("stock", "Stock qty", "number")}{inp("reorder_level", "Reorder level", "number")}
            {inp("supplier", "Supplier")}{inp("location", "Warehouse / Showroom location")}</div>
          <div className="card space-y-2 p-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} data-testid="pf-active" />Visible in store</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_deal} onChange={(e) => set("is_deal", e.target.checked)} data-testid="pf-deal" />Show in Deals of the Day</label></div>
        </div>
      </div>
    </div>
  );
}
