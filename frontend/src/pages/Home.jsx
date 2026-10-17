import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sofa, BedDouble, UtensilsCrossed, DoorClosed, Briefcase, Archive, BedSingle, BookOpen, Lamp, TreePine, ChevronLeft, ChevronRight, Truck, ShieldCheck, Wrench, RotateCcw, Quote } from "lucide-react";
import api, { img, inr } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { Rail, Countdown, Stars, PageSkeleton } from "@/components/shop";

export const ICONS = { Sofa, BedDouble, UtensilsCrossed, DoorClosed, Briefcase, Archive, BedSingle, BookOpen, Lamp, TreePine };

function Banners({ items }) {
  const { L } = useApp();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % items.length), 5000);
    return () => clearInterval(id);
  }, [items.length]);
  if (!items.length) return null;
  const b = items[i];
  return (
    <section className="container-x pt-4 sm:pt-6" data-testid="banner-carousel">
      <div className="relative h-[230px] overflow-hidden rounded-3xl sm:h-[380px] lg:h-[440px]">
        {items.map((x, k) => (
          <img key={x.id} src={img(x.image)} alt={x.title} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`} loading={k ? "lazy" : "eager"} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2B0E0E]/85 via-[#2B0E0E]/40 to-transparent" />
        <div key={b.id} className="fade-up absolute inset-y-0 left-0 flex max-w-xl flex-col justify-center p-6 sm:p-12">
          <span className="badge-deal w-fit">{b.subtitle && "OFFER"}</span>
          <h1 className="mt-3 text-3xl font-extrabold !text-white sm:text-5xl lg:text-6xl">{L(b, "title")}</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-lg">{L(b, "subtitle")}</p>
          <Link to={b.link || "/products"} className="btn-primary mt-5 w-fit" data-testid="banner-cta">Shop now →</Link>
        </div>
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button onClick={() => setI((i - 1 + items.length) % items.length)} className="grid h-9 w-9 place-items-center rounded-full bg-white/85 hover:bg-white" data-testid="banner-prev"><ChevronLeft size={18} /></button>
          <button onClick={() => setI((i + 1) % items.length)} className="grid h-9 w-9 place-items-center rounded-full bg-white/85 hover:bg-white" data-testid="banner-next"><ChevronRight size={18} /></button>
        </div>
        <div className="absolute bottom-6 left-6 flex gap-1.5 sm:left-12">{items.map((x, k) => <span key={x.id} className={`h-1.5 rounded-full transition-[width] ${k === i ? "w-8 bg-[#F5B800]" : "w-3 bg-white/60"}`} />)}</div>
      </div>
    </section>
  );
}

function CategoryIcons({ cats }) {
  const { t, L } = useApp();
  return (
    <section className="container-x py-6 sm:py-8" data-testid="category-icons">
      <h2 className="section-title mb-4">{t("shop_by_cat")}</h2>
      <div className="grid grid-cols-5 gap-3 sm:gap-5 lg:grid-cols-10">
        {cats.map((c) => {
          const Icon = ICONS[c.icon] || Sofa;
          return (
            <Link key={c.slug} to={`/products?category=${c.slug}`} className="group flex flex-col items-center gap-2 text-center" data-testid={`cat-icon-${c.slug}`}>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-[0_6px_20px_-10px_rgba(122,31,31,.35)] ring-1 ring-[#f0e2d3] transition-[transform,background-color] duration-300 group-hover:-translate-y-1 group-hover:bg-[#E8671B] sm:h-[72px] sm:w-[72px]">
                <Icon className="text-[#E8671B] transition-colors group-hover:text-white" size={28} />
              </span>
              <span className="text-[11px] font-semibold sm:text-sm">{L(c, "name")}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const ROOMS = [["living", "sofa3"], ["bedroom", "bed1"], ["dining_room", "din1"], ["office_room", "off4"], ["kids", "study1"], ["outdoor_room", "out3"]];
const ROOM_Q = { living: "living", bedroom: "bedroom", dining_room: "dining", office_room: "office", kids: "kids", outdoor_room: "outdoor" };

function Rooms() {
  const { t } = useApp();
  return (
    <section className="container-x py-6 sm:py-8" data-testid="shop-by-room">
      <h2 className="section-title mb-4">{t("shop_by_room")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {ROOMS.map(([k, im], idx) => (
          <Link key={k} to={`/products?room=${ROOM_Q[k]}`} className={`group relative overflow-hidden rounded-3xl ${idx === 0 ? "row-span-2 lg:col-span-2" : ""}`} data-testid={`room-${k}`}>
            <img src={img(`/api/uploads/seed/${im}.jpg`)} alt={t(k)} loading="lazy" className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${idx === 0 ? "h-full min-h-[260px]" : "h-36 sm:h-48"}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2B0E0E]/80 to-transparent" />
            <span className="absolute bottom-3 left-4 text-base font-bold text-white sm:text-xl">{t(k)} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Prices() {
  const { t } = useApp();
  const tiers = [[5000, "#FDE9D9"], [15000, "#FCE7B0"], [30000, "#F8D6C4"], [50000, "#F1D3D3"]];
  return (
    <section className="container-x py-6 sm:py-8" data-testid="shop-by-price">
      <h2 className="section-title mb-4">{t("shop_by_price")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
        {tiers.map(([p, bg]) => (
          <Link key={p} to={`/products?max_price=${p}`} style={{ background: bg }} className="group rounded-3xl p-5 transition-transform hover:-translate-y-1 sm:p-7" data-testid={`price-tier-${p}`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7A1F1F]/70">{t("under")}</p>
            <p className="mt-1 text-2xl font-extrabold text-[#7A1F1F] sm:text-4xl">{inr(p)}</p>
            <p className="mt-3 text-sm font-semibold text-[#E8671B]">{t("view_all")} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Reviews({ items }) {
  const { t } = useApp();
  if (!items?.length) return null;
  return (
    <section className="bg-[#fbf1e6] py-10" data-testid="home-reviews">
      <div className="container-x">
        <h2 className="section-title mb-5">{t("reviews")}</h2>
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
          {items.map((r) => (
            <div key={r.id} className="card w-72 shrink-0 p-5">
              <Quote className="text-[#F5B800]" size={22} /><p className="mt-2 line-clamp-4 text-sm">{r.text}</p>
              <div className="mt-4 flex items-center justify-between"><span className="text-sm font-semibold text-[#7A1F1F]">{r.name}</span><Stars value={r.rating} size={12} /></div>
              <p className="mt-1 text-[11px] text-gray-400 line-clamp-1">{r.product_name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const Trust = () => {
  const { t } = useApp();
  return (
    <section className="container-x grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">
      {[[Truck, "free_delivery"], [Wrench, "free_installation"], [RotateCcw, "easy_returns"], [ShieldCheck, "secure_pay"]].map(([I, k]) => (
        <div key={k} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#f0e2d3]"><I className="text-[#E8671B]" size={22} /><span className="text-xs font-semibold sm:text-sm">{t(k)}</span></div>))}
    </section>
  );
};

export default function Home() {
  const { t, L } = useApp();
  const [d, setD] = useState(null);
  const [cats, setCats] = useState([]);
  useTitle(null, "Mauli Furniture Mall, Pune - sofas, beds, dining sets and more.");
  useEffect(() => {
    api.get("/home").then((r) => setD(r.data));
    api.get("/categories").then((r) => setCats(r.data));
  }, []);
  if (!d) return <PageSkeleton />;
  const enabled = (k) => (d.sections || []).find((s) => s.key === k)?.enabled !== false;
  const order = (d.sections?.length ? d.sections.map((s) => s.key) : ["banners", "categories", "deals", "new_arrivals", "best_sellers", "rooms", "price", "reviews", "blog"]).filter(enabled);
  const blocks = {
    banners: <><Banners items={d.banners} /><Trust /></>,
    categories: <CategoryIcons cats={cats} />,
    deals: <Rail testid="deals-section" title={t("deals")} items={d.deals} link="/products?deal=1" extra={<span className="flex items-center gap-2 text-sm text-gray-500">{t("ends_in")} <Countdown to={d.deal_ends_at} /></span>} />,
    new_arrivals: <Rail testid="new-arrivals" title={t("new_arrivals")} items={d.new_arrivals} link="/products?sort=newest" />,
    best_sellers: <Rail testid="best-sellers" title={t("best_sellers")} items={d.best_sellers} link="/products?sort=popularity" />,
    rooms: <Rooms />, price: <Prices />, reviews: <Reviews items={d.reviews} />,
    blog: d.blogs?.length ? (
      <section className="container-x py-8" data-testid="home-blog"><div className="mb-4 flex justify-between"><h2 className="section-title">{t("blog")}</h2><Link to="/blog" className="text-sm font-semibold text-[#E8671B]">{t("view_all")} →</Link></div>
        <div className="grid gap-4 sm:grid-cols-3">{d.blogs.map((b) => (
          <Link key={b.id} to={`/blog/${b.slug}`} className="card group overflow-hidden"><img src={img(b.image)} alt="" loading="lazy" className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" /><p className="p-4 font-semibold">{L(b, "title")}</p></Link>))}</div></section>) : null,
  };
  return (
    <div data-testid="home-page">
      {order.map((k) => <div key={k}>{blocks[k]}</div>)}
      <section className="container-x py-6"><div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-[#E8671B] p-6 text-white sm:flex-row sm:items-center sm:p-10">
        <div><h2 className="text-2xl !text-white sm:text-3xl">{t("enquiry_title")}</h2><p className="mt-1 text-white/85">{t("enquiry")} · {t("size")} · {t("budget")}</p></div>
        <Link to="/enquiry" className="btn bg-white text-[#7A1F1F] hover:bg-[#F5B800]" data-testid="home-enquiry-cta">{t("enquiry")} →</Link></div></section>
    </div>
  );
}
