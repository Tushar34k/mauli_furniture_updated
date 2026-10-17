import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, Search, ShoppingCart, User, Heart, Mic, X, Clock, MapPin, Phone, Mail, Store } from "lucide-react";
import { useApp } from "@/lib/store";
import api, { img, inr } from "@/lib/api";
import { Logo } from "@/components/shop";

export const LangToggle = () => {
  const { lang, setLang } = useApp();
  return (
    <button onClick={() => setLang(lang === "mr" ? "en" : "mr")} data-testid="lang-toggle"
      className="rounded-full border border-[#7A1F1F]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#7A1F1F] transition-colors hover:bg-[#7A1F1F] hover:text-white">
      {lang === "mr" ? "EN" : "मराठी"}
    </button>
  );
};

const getRecent = () => JSON.parse(localStorage.getItem("mfm_recent_search") || "[]");

export function useVoice(onText) {
  const { lang } = useApp();
  const [on, setOn] = useState(false);
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const start = () => {
    if (!Rec) { alert("Voice search is not supported on this browser"); return; }
    const r = new Rec();
    r.lang = lang === "mr" ? "mr-IN" : "en-IN";
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setOn(false);
    setOn(true);
    r.start();
  };
  return { on, start };
}

export function SearchBox({ autoFocus = false, onDone }) {
  const { t, L } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState({ products: [], categories: [] });
  const [recent, setRecent] = useState(getRecent);
  const box = useRef(null);
  const go = (term) => {
    const v = (term ?? q).trim();
    if (!v) return;
    const r = [v, ...getRecent().filter((x) => x !== v)].slice(0, 6);
    localStorage.setItem("mfm_recent_search", JSON.stringify(r));
    setRecent(r);
    setOpen(false);
    nav(`/products?q=${encodeURIComponent(v)}`);
    onDone?.();
  };
  const voice = useVoice((txt) => { setQ(txt); go(txt); });
  useEffect(() => {
    if (q.trim().length < 2) { setSug({ products: [], categories: [] }); return; }
    const id = setTimeout(() => api.get("/products/suggest", { params: { q } }).then((r) => setSug(r.data)).catch(() => {}), 220);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex items-center rounded-full border border-[#e8d9ca] bg-white pl-4 pr-1.5 shadow-sm focus-within:border-[#E8671B]">
        <Search size={18} className="text-gray-400" />
        <input value={q} autoFocus={autoFocus} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={t("search_ph")} className="w-full bg-transparent px-3 py-2.5 text-sm outline-none" data-testid="search-input" />
        {q && <button type="button" onClick={() => setQ("")} className="p-1 text-gray-400"><X size={16} /></button>}
        <button type="button" onClick={voice.start} title={t("voice")} data-testid="voice-search-btn"
          className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${voice.on ? "bg-[#E8671B] text-white animate-pulse" : "text-[#7A1F1F] hover:bg-[#fbeee2]"}`}><Mic size={17} /></button>
      </form>
      {open && (sug.products.length > 0 || sug.categories.length > 0 || (!q && recent.length > 0)) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-white shadow-xl" data-testid="search-suggestions">
          {!q && <div className="p-3"><p className="label">{t("recent")}</p>{recent.map((r) => (
            <button key={r} onClick={() => go(r)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[#fbf3ea]"><Clock size={14} className="text-gray-400" />{r}</button>))}</div>}
          {sug.categories.map((c) => (
            <Link key={c.slug} to={`/products?category=${c.slug}`} onClick={() => { setOpen(false); onDone?.(); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#E8671B] hover:bg-[#fbf3ea]"><LayoutGrid size={14} />{L(c, "name")}</Link>))}
          {sug.products.map((p) => (
            <Link key={p.slug} to={`/product/${p.slug}`} onClick={() => { setOpen(false); onDone?.(); }} className="flex items-center gap-3 px-4 py-2 hover:bg-[#fbf3ea]" data-testid={`suggest-${p.slug}`}>
              <img src={img(p.image)} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="flex-1 text-sm">{L(p, "name")}</span><span className="text-sm font-semibold">{inr(p.price)}</span>
            </Link>))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t, cartCount, user, wishlist } = useApp();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-[#efe2d4] bg-[#FFFAF5]/90 backdrop-blur-xl">
      <div className="bg-[#7A1F1F] py-1.5 text-center text-[11px] sm:text-xs text-white/90">
        <span className="text-[#F5B800] font-semibold">WELCOME10</span> · {t("free_installation")} · {t("easy_returns")} · {t("secure_pay")}
      </div>
      <div className="container-x flex items-center gap-3 py-3 sm:gap-6">
        <Logo />
        <div className="hidden flex-1 md:block"><SearchBox /></div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LangToggle />
          <Link to="/showroom" className="btn-ghost hidden !px-3 lg:inline-flex" data-testid="nav-showroom"><Store size={18} />{t("showroom")}</Link>
          <Link to="/account?tab=wishlist" className="btn-ghost relative hidden !px-3 md:inline-flex" data-testid="nav-wishlist"><Heart size={19} />
            {wishlist.length > 0 && <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-[#E8671B]" />}</Link>
          <Link to={user ? "/account" : "/login"} className="btn-ghost hidden !px-3 md:inline-flex" data-testid="nav-account"><User size={19} />{user ? (user.name || t("account")).split(" ")[0] : t("login")}</Link>
          <Link to="/cart" className="btn-ghost relative hidden !px-3 md:inline-flex" data-testid="nav-cart"><ShoppingCart size={19} />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#E8671B] px-1 text-[10px] font-bold text-white" data-testid="cart-count">{cartCount}</span>}</Link>
        </div>
      </div>
      <nav className="container-x no-scrollbar hidden gap-6 overflow-x-auto pb-2.5 text-sm font-medium text-[#2B2B2B]/80 md:flex">
        {[["sofa", "Sofa", "सोफा"], ["bed", "Bed", "बेड"], ["dining", "Dining", "डायनिंग"], ["wardrobe", "Wardrobe", "वॉर्डरोब"], ["office", "Office", "ऑफिस"], ["storage", "Storage", "स्टोरेज"],
          ["mattress", "Mattress", "गादी"], ["study-table", "Study", "स्टडी टेबल"], ["decor", "Decor", "सजावट"], ["outdoor", "Outdoor", "आउटडोअर"]].map(([s, en, mr]) => (
          <NavCat key={s} slug={s} en={en} mr={mr} />))}
        <Link to="/enquiry" className="whitespace-nowrap font-semibold text-[#E8671B]">{t("enquiry")}</Link>
        <Link to="/blog" className="whitespace-nowrap hover:text-[#7A1F1F]">{t("blog")}</Link>
      </nav>
    </header>
  );
}

const NavCat = ({ slug, en, mr }) => {
  const { lang } = useApp();
  return <Link to={`/products?category=${slug}`} className="whitespace-nowrap transition-colors hover:text-[#E8671B]">{lang === "mr" ? mr : en}</Link>;
};

export function BottomNav() {
  const { t, cartCount } = useApp();
  const items = [["/", Home, "home"], ["/categories", LayoutGrid, "categories"], ["/search", Search, "search"], ["/cart", ShoppingCart, "cart"], ["/account", User, "account"]];
  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" data-testid="bottom-nav">
      {items.map(([to, Icon, k]) => (
        <NavLink key={to} to={to} end={to === "/"} data-testid={`bottom-nav-${k}`}
          className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-[#E8671B]" : "text-gray-500"}`}>
          <Icon size={21} />{t(k)}
          {k === "cart" && cartCount > 0 && <span className="absolute right-[26%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#E8671B] px-1 text-[9px] font-bold text-white">{cartCount}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function Footer() {
  const { t, settings: s } = useApp();
  const links = [["about", "/page/about"], ["contact", "/page/contact"], ["privacy", "/page/privacy"], ["terms", "/page/terms"], ["refund", "/page/refund"], ["shipping", "/page/shipping"]];
  return (
    <footer className="no-print relative mt-10 overflow-hidden bg-[#7A1F1F] text-white/85 grain" data-testid="footer">
      <div className="container-x relative grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div><Logo light /><p className="mt-4 text-sm leading-relaxed text-white/70">{t("trusted")} · {t("free_installation")} · {t("easy_returns")}</p></div>
        <div><h4 className="mb-3 !text-[#F5B800]">{t("categories")}</h4>
          {["sofa", "bed", "dining", "wardrobe", "mattress"].map((c) => <Link key={c} to={`/products?category=${c}`} className="block py-1 text-sm capitalize hover:text-[#F5B800]">{c}</Link>)}</div>
        <div><h4 className="mb-3 !text-[#F5B800]">Info</h4>
          {links.map(([k, to]) => <Link key={k} to={to} className="block py-1 text-sm hover:text-[#F5B800]" data-testid={`footer-link-${k}`}>{t(k)}</Link>)}
          <Link to="/blog" className="block py-1 text-sm hover:text-[#F5B800]">{t("blog")}</Link></div>
        <div className="space-y-2 text-sm"><h4 className="mb-3 !text-[#F5B800]">{t("visit_showroom")}</h4>
          <p className="flex gap-2"><MapPin size={16} className="shrink-0" />{s.address}</p>
          <p className="flex gap-2"><Phone size={16} />{s.phone}</p><p className="flex gap-2"><Mail size={16} />{s.email}</p>
          <p className="flex gap-2"><Clock size={16} />{s.timings}</p><p className="text-xs text-white/60">GSTIN: {s.gst_number}</p></div>
      </div>
      <div className="relative border-t border-white/10 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} {s.shop_name || "Mauli Furniture Mall"}. All rights reserved.</div>
    </footer>
  );
}
