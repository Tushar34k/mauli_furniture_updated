import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Heart, Share2, GitCompare, Bell, Truck, ShieldCheck, Wrench, CreditCard, MapPin, Camera, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import api, { errMsg, img, inr, track } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { Rail, RatingPill, PageSkeleton, Empty } from "@/components/shop";

function Gallery({ p }) {
  const [i, setI] = useState(0);
  const [z, setZ] = useState(null);
  const [video, setVideo] = useState(false);
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row" data-testid="product-gallery">
      <div className="no-scrollbar flex gap-2 overflow-x-auto sm:flex-col">
        {p.images.map((u, k) => (
          <button key={u} onClick={() => { setI(k); setVideo(false); }} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${k === i && !video ? "border-[#E8671B]" : "border-transparent"}`} data-testid={`gallery-thumb-${k}`}>
            <img src={img(u)} alt="" className="h-full w-full object-cover" /></button>))}
        {p.video && <button onClick={() => setVideo(true)} className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#7A1F1F] text-white" data-testid="gallery-video-btn"><PlayCircle /></button>}
      </div>
      <div className="relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-3xl bg-[#f6eee6]"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZ(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); }}
        onMouseLeave={() => setZ(null)}>
        {video ? <iframe title="video" src={p.video} className="h-full w-full" allowFullScreen /> :
          <img src={img(p.images[i])} alt={p.name} className="h-full w-full object-cover transition-transform duration-200" style={z ? { transform: "scale(2)", transformOrigin: z } : undefined} data-testid="gallery-main-image" />}
        {p.discount > 0 && <span className="badge-deal absolute left-4 top-4 !text-sm">{p.discount}% OFF</span>}
      </div>
    </div>
  );
}

function PincodeCheck({ p }) {
  const { t } = useApp();
  const [pin, setPin] = useState(localStorage.getItem("mfm_pin") || "");
  const [res, setRes] = useState(null);
  const check = async () => {
    try { const { data } = await api.get(`/pincode/${pin}`); setRes(data); localStorage.setItem("mfm_pin", pin); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="rounded-2xl border bg-white p-4" data-testid="pincode-checker">
      <p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-[#E8671B]" />{t("delivery_check")}</p>
      <div className="mt-2 flex gap-2"><input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t("pincode")} className="input" data-testid="pincode-input" />
        <button onClick={check} disabled={pin.length !== 6} className="btn-secondary" data-testid="pincode-check-btn">{t("check")}</button></div>
      {res && <p className={`mt-2 text-sm ${res.serviceable ? "text-green-700" : "text-red-600"}`} data-testid="pincode-result">
        {res.serviceable ? `${res.city}: ${t("delivers_in", { d: Math.max(res.days, p.delivery_days) })} · ${res.charge ? inr(res.charge) : t("free_delivery")}${res.cod ? " · COD ✓" : ""}` : t("not_serviceable")}</p>}
    </div>
  );
}

function ReviewForm({ pid, onDone }) {
  const { t, settings } = useApp();
  const [rating, setRating] = useState(5);  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const upload = async (f) => {
    const fd = new FormData(); fd.append("file", f);
    try { const { data } = await api.post("/upload", fd); setPhotos((p) => [...p, data.url]); } catch (e) { toast.error(errMsg(e)); }
  };
  const submit = async () => {
    try { await api.post(`/products/${pid}/reviews`, { rating, text, photos }); toast.success(t("review_sent")); onDone(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="card mt-3 space-y-3 p-4" data-testid="review-form">
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button key={i} onClick={() => setRating(i)} className={`text-2xl ${i <= rating ? "text-[#F5B800]" : "text-gray-300"}`} data-testid={`review-star-${i}`}>★</button>)}</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="input min-h-[90px]" placeholder={t("write_review")} data-testid="review-text" />
      <div className="flex flex-wrap items-center gap-2">{photos.map((u) => <img key={u} src={img(u)} alt="" className="h-14 w-14 rounded-lg object-cover" />)}
        {settings.upload_enabled && <label className="btn-outline cursor-pointer !py-2"><Camera size={16} />{t("photo")}<input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0])} data-testid="review-photo-input" /></label>}</div>
      <button onClick={submit} disabled={text.length < 3} className="btn-primary" data-testid="review-submit-btn">{t("submit")}</button>
    </div>
  );
}

function ReviewsQA({ d, reload }) {
  const { t, user } = useApp();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [q, setQ] = useState("");
  const ask = async () => {
    try { await api.post(`/products/${d.product.id}/questions`, { question: q, name: user?.name || "Customer" }); toast.success(t("question_sent")); setQ(""); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div data-testid="reviews-section">
        <div className="flex items-center justify-between"><h2 className="section-title">{t("reviews")} ({d.reviews.length})</h2>
          <button onClick={() => (user ? setShow(!show) : nav("/login"))} className="btn-outline !py-2" data-testid="write-review-btn">{t("write_review")}</button></div>
        {show && <ReviewForm pid={d.product.id} onDone={() => { setShow(false); reload(); }} />}
        <div className="mt-4 space-y-3">{d.reviews.length === 0 ? <p className="text-sm text-gray-500">—</p> : d.reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2"><RatingPill value={r.rating} /><span className="text-sm font-semibold">{r.name}</span></div>
            <p className="mt-2 text-sm">{r.text}</p>{r.photos?.length > 0 && <div className="mt-2 flex gap-2">{r.photos.map((u) => <img key={u} src={img(u)} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}</div>))}</div>
      </div>
      <div data-testid="qa-section">
        <h2 className="section-title">{t("qa")}</h2>
        <div className="mt-3 flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder={t("ask")} data-testid="question-input" />
          <button onClick={ask} disabled={q.length < 5} className="btn-secondary" data-testid="question-submit-btn">{t("submit")}</button></div>
        <div className="mt-4 space-y-3">{d.questions.map((x) => (
          <div key={x.id} className="rounded-2xl border bg-white p-4 text-sm"><p className="font-semibold">Q: {x.question}</p><p className="mt-1 text-gray-600">A: {x.answer}</p></div>))}</div>
      </div>
    </div>
  );
}

function Info({ p }) {
  const { t, L, settings, addToCart, wishlist, toggleWish, toggleCompare, user } = useApp();
  const nav = useNavigate();
  const [variant, setVariant] = useState(p.variants?.[0]?.value || "");
  const [qty, setQty] = useState(1);
  const delta = p.variants?.find((v) => v.value === variant)?.price_delta || 0;
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: p.name, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
  };
  const alert = async () => {
    if (!user) return nav("/login");
    try { await api.post(`/account/price-alerts/${p.id}`); toast.success(t("price_alert") + " ✓"); } catch (e) { toast.error(errMsg(e)); }
  };
  const add = (buy) => { addToCart({ ...p, price: p.price + delta }, qty, variant); if (buy) nav("/cart"); };
  return (
    <div className="space-y-4" data-testid="product-info">
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#E8671B]">{p.brand}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl" data-testid="product-title">{L(p, "name")}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500"><RatingPill value={p.rating} />{p.reviews_count} reviews · SKU {p.sku}</div></div>
      <div><div className="flex flex-wrap items-baseline gap-3"><span className="text-3xl font-extrabold" data-testid="product-price">{inr(p.price + delta)}</span>
        <span className="text-gray-400 line-through">{t("mrp")} {inr(p.mrp + delta)}</span><span className="badge-deal">{p.discount}% {t("off")}</span></div>
        <p className="text-xs text-gray-500">{t("incl_gst", { g: p.gst })}</p></div>
      <p className={`text-sm font-semibold ${p.stock > 0 ? (p.stock <= 5 ? "text-[#E8671B]" : "text-green-700") : "text-red-600"}`} data-testid="stock-status">
        {p.stock <= 0 ? t("out_of_stock") : p.stock <= 5 ? t("only_left", { n: p.stock }) : t("in_stock")}</p>
      {p.variants?.length > 0 && <div><p className="label">{p.variants[0].type}</p><div className="flex flex-wrap gap-2">{p.variants.map((v) => (
        <button key={v.value} onClick={() => setVariant(v.value)} data-testid={`variant-${v.value}`} className={`chip !px-4 !py-2 ${variant === v.value ? "border-[#E8671B] bg-[#fbeee2] text-[#7A1F1F]" : "bg-white"}`}>{v.value}{v.price_delta ? ` (+${inr(v.price_delta)})` : ""}</button>))}</div></div>}
      <div className="flex items-center gap-3"><span className="label !mb-0">{t("qty")}</span>
        <div className="flex items-center rounded-full border bg-white"><button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-1.5" data-testid="qty-minus">−</button><span className="w-8 text-center" data-testid="qty-value">{qty}</span><button onClick={() => setQty(Math.min(p.stock || 1, qty + 1))} className="px-3 py-1.5" data-testid="qty-plus">+</button></div></div>
      <div className="flex gap-3"><button disabled={p.stock <= 0} onClick={() => add(false)} className="btn-outline flex-1 !py-3" data-testid="pdp-add-to-cart">{t("add_to_cart")}</button>
        <button disabled={p.stock <= 0} onClick={() => add(true)} className="btn-primary flex-1 !py-3" data-testid="pdp-buy-now">{t("buy_now")}</button></div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={() => toggleWish(p.id)} className="btn-ghost !px-3" data-testid="pdp-wishlist"><Heart size={17} className={wishlist.includes(p.id) ? "fill-[#E8671B] text-[#E8671B]" : ""} />{t("wishlist")}</button>
        <button onClick={() => toggleCompare(p)} className="btn-ghost !px-3" data-testid="pdp-compare"><GitCompare size={17} />{t("compare")}</button>
        <button onClick={share} className="btn-ghost !px-3" data-testid="pdp-share"><Share2 size={17} />{t("share")}</button>
        <button onClick={alert} className="btn-ghost !px-3" data-testid="pdp-price-alert"><Bell size={17} />{t("price_alert")}</button></div>
      <PincodeCheck p={p} />
      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
        {[[Wrench, p.assembly === "diy" ? t("diy") : t("free_installation")], [ShieldCheck, `${t("warranty")}: ${p.warranty}`], [Truck, t("delivers_in", { d: p.delivery_days })], [CreditCard, t("emi")]].map(([I, s], k) => (
          <div key={k} className="flex items-center gap-2 rounded-xl bg-[#fbf3ea] p-3"><I size={17} className="shrink-0 text-[#E8671B]" />{s}</div>))}</div>
      {settings.emi_text && <p className="rounded-xl border border-dashed border-[#F5B800] bg-[#fffbeb] p-3 text-xs" data-testid="emi-info">{settings.emi_text}</p>}
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const { t, L, addRecent, recent, addToCart } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const load = () => api.get(`/products/${slug}`).then((r) => { setD(r.data); addRecent(r.data.product); track("view_item", { item_id: r.data.product.id }); }).catch(() => setErr(true));
  useEffect(() => { setD(null); load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ids = recent.filter((x) => x !== d?.product?.id).slice(0, 8);
    if (ids.length) api.get("/products", { params: { ids: ids.join(","), limit: 8 } }).then((r) => setRecentItems(r.data.items));
  }, [d?.product?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useTitle(d ? L(d.product, "name") : null, d?.product?.description);
  if (err) return <Empty title="Product not found" action={<Link to="/products" className="btn-primary">{t("all_products")}</Link>} />;
  if (!d) return <PageSkeleton />;
  const p = d.product;
  const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, image: p.images.map(img), sku: p.sku, brand: { "@type": "Brand", name: p.brand }, description: p.description,
    aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviews_count },
    offers: { "@type": "Offer", priceCurrency: "INR", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } };
  const fbtTotal = p.price + d.fbt.reduce((a, b) => a + b.price, 0);
  return (
    <div data-testid="product-page">
      <script type="application/ld+json">{JSON.stringify(ld)}</script>
      <div className="container-x py-4 text-xs text-gray-500"><Link to="/">{t("home")}</Link> / <Link to={`/products?category=${p.category}`} className="capitalize">{p.category}</Link> / {L(p, "name")}</div>
      <div className="container-x grid gap-8 lg:grid-cols-2"><Gallery p={p} /><Info p={p} /></div>
      <section className="container-x mt-10 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2"><h2 className="section-title">{t("description")}</h2><p className="mt-2 text-sm leading-relaxed text-gray-700">{L(p, "description")}</p></div>
        <div className="card p-5"><h2 className="section-title">{t("specifications")}</h2>
          <table className="mt-2 w-full text-sm" data-testid="specs-table"><tbody>
            {Object.entries({ [t("dimensions")]: p.dimensions, Weight: p.weight, ...p.specs, [t("warranty")]: p.warranty, [t("assembly")]: p.assembly === "diy" ? t("diy") : t("free_installation") }).map(([k, v]) => (
              <tr key={k} className="border-b last:border-0"><td className="py-2 pr-3 text-gray-500">{k}</td><td className="py-2 font-medium">{v}</td></tr>))}</tbody></table></div>
      </section>
      {d.fbt.length > 0 && <section className="container-x mt-10" data-testid="fbt-section"><h2 className="section-title mb-4">{t("fbt")}</h2>
        <div className="card flex flex-col items-center gap-4 p-5 sm:flex-row">{[p, ...d.fbt].map((x, k) => (
          <div key={x.id} className="flex items-center gap-3">{k > 0 && <span className="text-2xl text-[#E8671B]">+</span>}<img src={img(x.images[0])} alt="" className="h-20 w-20 rounded-xl object-cover" /><div className="max-w-[140px] text-xs"><p className="line-clamp-2 font-semibold">{L(x, "name")}</p><p>{inr(x.price)}</p></div></div>))}
          <div className="sm:ml-auto text-center"><p className="text-lg font-bold">{inr(fbtTotal)}</p><button onClick={() => [p, ...d.fbt].forEach((x) => addToCart(x, 1, x.variants?.[0]?.value || ""))} className="btn-primary mt-2" data-testid="fbt-add-all">{t("add_to_cart")} ({1 + d.fbt.length})</button></div></div></section>}
      <section className="container-x mt-10"><ReviewsQA d={d} reload={load} /></section>
      <Rail testid="similar-products" title={t("similar")} items={d.similar} link={`/products?category=${p.category}`} />
      <Rail testid="recently-viewed" title={t("recently_viewed")} items={recentItems} />
      <div className="h-6" />
    </div>
  );
}
