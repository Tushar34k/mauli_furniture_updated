import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Phone, Clock, MessageCircle, Upload } from "lucide-react";
import api, { errMsg, img, inr } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { Empty, PageSkeleton, RatingPill } from "@/components/shop";

export function Compare() {
  const { t, L, compare, toggleCompare, addToCart } = useApp();
  const [items, setItems] = useState([]);
  useTitle(t("compare"));
  useEffect(() => {
    if (!compare.length) { setItems([]); return; }
    Promise.all(compare.map((c) => api.get(`/products/${c.slug}`).then((r) => r.data.product))).then(setItems);
  }, [compare]);
  if (!compare.length) return <Empty title={`${t("compare")} (0/3)`} sub="Add up to 3 products using the compare button." action={<Link to="/products" className="btn-primary">{t("all_products")}</Link>} />;
  const rows = [["price", (p) => inr(p.price)], ["mrp", (p) => inr(p.mrp)], ["rating", (p) => <RatingPill value={p.rating} />], ["brand", (p) => p.brand], ["material", (p) => p.material], ["color", (p) => p.color],
    ["dimensions", (p) => p.dimensions], ["warranty", (p) => p.warranty], ["assembly", (p) => (p.assembly === "diy" ? t("diy") : t("free_installation"))], ["delivery_time", (p) => `${p.delivery_days} days`]];
  return (
    <div className="container-x overflow-x-auto py-6" data-testid="compare-page">
      <h1 className="mb-4 text-2xl">{t("compare")}</h1>
      <table className="w-full min-w-[600px] border-separate border-spacing-2 text-sm"><tbody>
        <tr><td />{items.map((p) => <td key={p.id} className="card p-3 align-top"><img src={img(p.images[0])} alt="" className="h-36 w-full rounded-xl object-cover" /><p className="mt-2 font-semibold">{L(p, "name")}</p>
          <div className="mt-2 flex gap-2"><button onClick={() => addToCart(p)} className="btn-primary !px-3 !py-1.5 text-xs">{t("add_to_cart")}</button><button onClick={() => toggleCompare(p)} className="text-xs text-red-600" data-testid={`compare-remove-${p.slug}`}>{t("remove")}</button></div></td>)}</tr>
        {rows.map(([k, f]) => <tr key={k}><td className="font-semibold text-[#7A1F1F]">{t(k)}</td>{items.map((p) => <td key={p.id} className="rounded-xl bg-white p-3">{f(p)}</td>)}</tr>)}
      </tbody></table>
    </div>
  );
}

export function Showroom() {
  const { t, settings: s } = useApp();
  useTitle(t("showroom"));
  const wa = (s.whatsapp || "").replace(/\D/g, "");
  return (
    <div className="container-x py-6" data-testid="showroom-page">
      <h1 className="text-3xl sm:text-4xl">{t("visit_showroom")}</h1>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6">
          <p className="flex gap-3"><MapPin className="shrink-0 text-[#E8671B]" />{s.shop_name}, {s.address}</p>
          <p className="flex gap-3"><Clock className="text-[#E8671B]" />{t("timings")}: {s.timings}</p>
          <p className="flex gap-3"><Phone className="text-[#E8671B]" />{s.phone}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={`tel:${(s.phone || "").replace(/\s/g, "")}`} className="btn-primary" data-testid="showroom-call-btn"><Phone size={16} />{t("call")}</a>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white hover:bg-[#1da851]" data-testid="showroom-whatsapp-btn"><MessageCircle size={16} />{t("whatsapp")}</a>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || "")}`} target="_blank" rel="noreferrer" className="btn-outline" data-testid="showroom-directions-btn"><MapPin size={16} />Directions</a></div>
        </div>
        <iframe title="map" src={s.map_embed} className="h-80 w-full rounded-3xl border-0 lg:h-full" loading="lazy" data-testid="showroom-map" />
      </div>
    </div>
  );
}

export function Enquiry() {
  const { t, user } = useApp();
  const [f, setF] = useState({ name: user?.name || "", phone: user?.phone || "", furniture_type: "", size: "", budget: "", description: "" });
  const [photo, setPhoto] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useTitle(t("enquiry"));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (photo) fd.append("photo", photo);
    try { await api.post("/enquiries", fd); setDone(true); } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  };
  if (done) return <Empty title={t("thanks")} action={<Link to="/" className="btn-primary">{t("home")}</Link>} />;
  const inp = (k, label, props = {}) => <div><label className="label">{label}</label><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input" data-testid={`enquiry-${k}`} {...props} /></div>;
  return (
    <div className="container-x max-w-2xl py-6" data-testid="enquiry-page">
      <h1 className="text-3xl">{t("enquiry_title")}</h1>
      <form onSubmit={submit} className="card mt-5 grid gap-4 p-6 sm:grid-cols-2">
        {inp("name", t("name"), { required: true })}{inp("phone", t("phone"), { required: true, maxLength: 10, inputMode: "numeric" })}
        {inp("furniture_type", "Furniture type (Sofa, Bed...)")}{inp("size", t("size"), { placeholder: "e.g. 6ft x 3ft" })}{inp("budget", t("budget"), { placeholder: "₹" })}
        <div><label className="label">{t("photo")}</label><label className="btn-outline w-full cursor-pointer"><Upload size={16} />{photo ? photo.name.slice(0, 18) : t("photo")}<input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files[0])} data-testid="enquiry-photo" /></label></div>
        <div className="sm:col-span-2"><label className="label">{t("description")}</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="input min-h-[110px]" data-testid="enquiry-description" /></div>
        <button disabled={busy} className="btn-primary sm:col-span-2 !py-3" data-testid="enquiry-submit-btn">{t("submit")}</button>
      </form>
    </div>
  );
}

export function Blog() {
  const { slug } = useParams();
  const { t, L } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api.get(slug ? `/blogs/${slug}` : "/blogs").then((r) => setD(r.data)).catch(() => setD(false)); }, [slug]);
  useTitle(d && slug ? L(d, "title") : t("blog"));
  if (d === null) return <PageSkeleton />;
  if (d === false) return <Empty title="Not found" />;
  if (slug) return (
    <article className="container-x max-w-3xl py-6" data-testid="blog-post"><img src={img(d.image)} alt="" className="h-64 w-full rounded-3xl object-cover sm:h-96" />
      <h1 className="mt-6 text-3xl">{L(d, "title")}</h1><div className="mt-4 whitespace-pre-line leading-relaxed text-gray-700">{d.content}</div>
      <Link to="/blog" className="btn-outline mt-6">← {t("blog")}</Link></article>);
  return (
    <div className="container-x py-6" data-testid="blog-page"><h1 className="mb-5 text-3xl">{t("blog")}</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.map((b) => (
        <Link key={b.id} to={`/blog/${b.slug}`} className="card group overflow-hidden" data-testid={`blog-card-${b.slug}`}><img src={img(b.image)} alt="" loading="lazy" className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="p-4"><p className="font-bold text-[#7A1F1F]">{L(b, "title")}</p><p className="mt-1 line-clamp-2 text-sm text-gray-600">{b.content}</p></div></Link>))}</div></div>);
}

export function InfoPage({ notFound }) {
  const { slug } = useParams();
  const { t, L } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { if (!notFound) api.get(`/pages/${slug}`).then((r) => setD(r.data)).catch(() => setD(false)); }, [slug, notFound]);
  useTitle(d ? L(d, "title") : notFound ? "404" : "");
  if (notFound || d === false) return <Empty title="404 - Page not found" action={<Link to="/" className="btn-primary">{t("home")}</Link>} />;
  if (!d) return <PageSkeleton />;
  return (
    <div className="container-x max-w-3xl py-8" data-testid={`info-page-${slug}`}>
      <h1 className="text-3xl">{L(d, "title")}</h1>
      <div className="card mt-5 whitespace-pre-line p-6 text-sm leading-relaxed text-gray-700">{d.content}</div>
    </div>
  );
}
