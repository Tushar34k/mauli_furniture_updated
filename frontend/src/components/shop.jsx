import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, Star, PackageOpen, GitCompare } from "lucide-react";
import { useApp } from "@/lib/store";
import { img, inr } from "@/lib/api";

export function Logo({ compact = false, light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0" data-testid="header-logo">
      <img src="/logo.svg" alt="Mauli Furniture Mall" className="h-10 w-10 sm:h-11 sm:w-11" width="44" height="44" />
      {!compact && (
        <span className="leading-none">
          <span className={`block font-deva text-lg sm:text-xl font-extrabold ${light ? "text-white" : "text-[#7A1F1F]"}`}>माऊली फर्निचर मॉल</span>
          <span className={`block text-[9px] sm:text-[10px] tracking-[0.28em] font-semibold ${light ? "text-[#F5B800]" : "text-[#E8671B]"}`}>MAULI FURNITURE MALL</span>
        </span>
      )}
    </Link>
  );
}

export const Stars = ({ value = 0, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} stars`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? "fill-[#F5B800] text-[#F5B800]" : "text-gray-300"} />)}
  </span>
);

export const RatingPill = ({ value }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-[#7A1F1F] px-1.5 py-0.5 text-[11px] font-semibold text-white">
    {value} <Star size={10} className="fill-[#F5B800] text-[#F5B800]" />
  </span>
);

export function ProductCard({ p, layout = "grid" }) {
  const { L, t, wishlist, toggleWish, addToCart, toggleCompare, compare } = useApp();
  const liked = wishlist.includes(p.id);
  const list = layout === "list";
  return (
    <div className={`group card overflow-hidden fade-up ${list ? "flex" : "flex flex-col"}`} data-testid={`product-card-${p.slug}`}>
      <Link to={`/product/${p.slug}`} className={`relative block overflow-hidden bg-[#f6eee6] ${list ? "w-40 sm:w-56 shrink-0" : "aspect-[4/3.4]"}`}>
        <img src={img(p.images?.[0])} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {p.discount > 0 && <span className="badge-deal absolute left-3 top-3">{p.discount}% {t("off")}</span>}
        {p.stock <= 0 && <span className="absolute bottom-3 left-3 rounded-full bg-[#2B2B2B]/80 px-2 py-0.5 text-[11px] text-white">{t("out_of_stock")}</span>}
      </Link>
      <div className="relative flex flex-1 flex-col p-3 sm:p-4">
        <div className="absolute -top-12 right-3 flex flex-col gap-2">
          <button onClick={() => toggleWish(p.id)} data-testid={`wish-btn-${p.slug}`} aria-label="wishlist"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow transition-transform hover:scale-110">
            <Heart size={17} className={liked ? "fill-[#E8671B] text-[#E8671B]" : "text-[#7A1F1F]"} />
          </button>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-[#E8671B] font-semibold">{p.brand}</p>
        <Link to={`/product/${p.slug}`} className="mt-0.5 line-clamp-2 text-sm sm:text-[15px] font-semibold text-[#2B2B2B] hover:text-[#7A1F1F]">{L(p, "name")}</Link>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500"><RatingPill value={p.rating} /> ({p.reviews_count})</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold text-[#2B2B2B]">{inr(p.price)}</span>
          {p.mrp > p.price && <span className="text-xs text-gray-400 line-through">{inr(p.mrp)}</span>}
        </div>
        {list && <p className="mt-1 text-xs text-gray-500">{p.material} · {p.color} · {t("delivers_in", { d: p.delivery_days })}</p>}
        <div className="mt-auto flex gap-2 pt-3">
          <button disabled={p.stock <= 0} onClick={() => addToCart(p)} className="btn-primary flex-1 !px-3 !py-2 text-xs" data-testid={`add-to-cart-${p.slug}`}>{t("add_to_cart")}</button>
          <button onClick={() => toggleCompare(p)} title={t("compare")} data-testid={`compare-btn-${p.slug}`}
            className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${compare.find((c) => c.id === p.id) ? "bg-[#F5B800] border-[#F5B800]" : "hover:bg-[#fbf3ea]"}`}>
            <GitCompare size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const CardSkeleton = () => (
  <div className="card overflow-hidden"><div className="skeleton aspect-[4/3.4] rounded-none" /><div className="space-y-2 p-4"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-5 w-1/2" /></div></div>
);

export const GridSkeleton = ({ n = 8 }) => (
  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: n }).map((_, i) => <CardSkeleton key={i} />)}</div>
);

export const PageSkeleton = () => (
  <div className="container-x py-8 space-y-6" data-testid="page-skeleton"><div className="skeleton h-48 w-full" /><GridSkeleton n={4} /></div>
);

export const Empty = ({ title, sub, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
    <div className="grid h-20 w-20 place-items-center rounded-full bg-[#fbeee2]"><PackageOpen size={36} className="text-[#E8671B]" /></div>
    <h3 className="mt-4 text-lg">{title}</h3>
    {sub && <p className="mt-1 max-w-sm text-sm text-gray-500">{sub}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export function Countdown({ to }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(to).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]);
  const s = Math.floor(left / 1000);
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, "0"));
  return (
    <span className="inline-flex gap-1" data-testid="deal-countdown">
      {parts.map((x, i) => <span key={i} className="min-w-[34px] rounded-lg bg-[#7A1F1F] px-1.5 py-1 text-center font-mono text-sm font-bold text-white">{x}</span>)}
    </span>
  );
}

export function Rail({ title, items, link, extra, testid }) {
  const { t } = useApp();
  if (!items?.length) return null;
  return (
    <section className="container-x py-6 sm:py-8" data-testid={testid}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3"><h2 className="section-title">{title}</h2>{extra}</div>
        {link && <Link to={link} className="text-sm font-semibold text-[#E8671B] hover:text-[#7A1F1F] whitespace-nowrap">{t("view_all")} →</Link>}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:gap-5">
        {items.map((p) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]"><ProductCard p={p} /></div>)}
      </div>
    </section>
  );
}

export function WhatsAppFab() {
  const { settings } = useApp();
  const { pathname } = useLocation();
  if (["/cart", "/checkout", "/login"].includes(pathname) || pathname.startsWith("/product/")) return null;
  const n = (settings.whatsapp || "919876543210").replace(/\D/g, "");
  return (
    <a href={`https://wa.me/${n}?text=${encodeURIComponent("नमस्कार, मला फर्निचरबद्दल माहिती हवी आहे.")}`} target="_blank" rel="noreferrer"
      className="no-print fixed bottom-24 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110 md:bottom-6 md:h-14 md:w-14"
      data-testid="whatsapp-fab" aria-label="WhatsApp">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4.9 2.9.8 3.4.7.5-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /></svg>
    </a>
  );
}
