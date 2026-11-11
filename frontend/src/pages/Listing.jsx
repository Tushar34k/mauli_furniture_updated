import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import api from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { ProductCard, GridSkeleton, Empty, CardSkeleton } from "@/components/shop";


function Filters({ params, set, facets }) {
  const { t, categories } = useApp();
  const multi = (key, val) => {
    const cur = (params.get(key) || "").split(",").filter(Boolean);
    set(key, (cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]).join(","));
  };
  const Group = ({ title, children }) => <div className="border-b py-4"><p className="label">{title}</p><div className="mt-2 flex flex-wrap gap-2">{children}</div></div>;
  const Chip = ({ on, onClick, children, id }) => (
    <button onClick={onClick} data-testid={id} className={`chip ${on ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white hover:border-[#E8671B]"}`}>{children}</button>);
  const has = (k, v) => (params.get(k) || "").split(",").includes(String(v));
  return (
    <div data-testid="filters-panel">
      <Group title={t("categories")}>{categories.map((c) => <Chip key={c.slug} id={`filter-cat-${c.slug}`} on={has("category", c.slug)} onClick={() => multi("category", c.slug)}>{c.name}</Chip>)}</Group>
      <div className="border-b py-4"><p className="label">{t("price")}</p>
        <div className="mt-2 flex gap-2"><input className="input" type="number" placeholder="Min" defaultValue={params.get("min_price") || ""} onBlur={(e) => set("min_price", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} data-testid="filter-min-price" />
          <input className="input" type="number" placeholder="Max" defaultValue={params.get("max_price") || ""} onBlur={(e) => set("max_price", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} data-testid="filter-max-price" /></div></div>
      {[["material", t("material")], ["color", t("color")], ["brand", t("brand")]].map(([k, label]) => (
        <Group key={k} title={label}>{(facets[k] || []).map((v) => <Chip key={v} id={`filter-${k}-${v}`} on={has(k, v)} onClick={() => multi(k, v)}>{v}</Chip>)}</Group>))}
      <Group title={t("rating")}>{[4, 3].map((r) => <Chip key={r} id={`filter-rating-${r}`} on={params.get("rating") === String(r)} onClick={() => set("rating", params.get("rating") === String(r) ? "" : String(r))}>{r}â˜… +</Chip>)}</Group>
      <Group title={t("discount")}>{[10, 25, 40].map((r) => <Chip key={r} id={`filter-discount-${r}`} on={params.get("discount") === String(r)} onClick={() => set("discount", params.get("discount") === String(r) ? "" : String(r))}>{r}%+</Chip>)}</Group>
      <Group title={t("availability")}><Chip id="filter-in-stock" on={params.get("in_stock") === "1"} onClick={() => set("in_stock", params.get("in_stock") === "1" ? "" : "1")}>{t("in_stock")}</Chip></Group>
      <Group title={t("delivery_time")}>{[2, 3, 5].map((d) => <Chip key={d} id={`filter-delivery-${d}`} on={params.get("delivery_days") === String(d)} onClick={() => set("delivery_days", params.get("delivery_days") === String(d) ? "" : String(d))}>â‰¤ {d} days</Chip>)}</Group>
    </div>
  );
}

export default function Listing() {
  const { t, categories } = useApp();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1, facets: {} });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState("grid");
  const [open, setOpen] = useState(false);
  const sentinel = useRef(null);
  const key = params.toString();
  useTitle(params.get("q") ? `"${params.get("q")}"` : params.get("category") || t("all_products"));

  const fetchPage = useCallback(async (pg) => {
    setLoading(true);
    const q = Object.fromEntries(params.entries());
    const { data } = await api.get("/products", { params: { ...q, page: pg, limit: 12 } });
    setItems((prev) => (pg === 1 ? data.items : [...prev, ...data.items]));
    setMeta(data);
    setLoading(false);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); fetchPage(1); }, [fetchPage]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading && page < meta.pages) { setPage(page + 1); fetchPage(page + 1); }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, page, meta.pages, fetchPage]);

  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n); };
  const cat1 = (params.get("category") || "").split(",").filter(Boolean);
  const title = params.get("q") ? `"${params.get("q")}"` : cat1.length ? cat1.map((c) => t(`cat_${c}`)).join(", ") : t("all_products");
  return (
    <div className="container-x py-6" data-testid="listing-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl capitalize sm:text-3xl">{title}</h1><p className="text-sm text-gray-500" data-testid="results-count">{meta.total} {t("results")}</p></div>
        <div className="flex items-center gap-2">
          <button className="btn-outline !py-2 lg:hidden" onClick={() => setOpen(true)} data-testid="open-filters-btn"><SlidersHorizontal size={16} />{t("filters")}</button>
          <select value={params.get("sort") || "popularity"} onChange={(e) => set("sort", e.target.value)} className="input !w-auto !rounded-full !py-2" data-testid="sort-select">
            <option value="popularity">{t("popularity")}</option><option value="newest">{t("newest")}</option><option value="price_asc">{t("price_low")}</option>
            <option value="price_desc">{t("price_high")}</option><option value="discount">{t("discount")}</option><option value="rating">{t("rating")}</option>
          </select>
          <div className="hidden rounded-full border bg-white p-1 sm:flex">
            <button onClick={() => setLayout("grid")} className={`rounded-full p-1.5 ${layout === "grid" ? "bg-[#E8671B] text-white" : ""}`} data-testid="layout-grid-btn"><LayoutGrid size={16} /></button>
            <button onClick={() => setLayout("list")} className={`rounded-full p-1.5 ${layout === "list" ? "bg-[#E8671B] text-white" : ""}`} data-testid="layout-list-btn"><List size={16} /></button>
          </div>
        </div>
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block"><div className="sticky top-36">
          <div className="flex items-center justify-between"><h3 className="text-lg">{t("filters")}</h3><button onClick={() => setParams(params.get("q") ? { q: params.get("q") } : {})} className="text-xs font-semibold text-[#E8671B]" data-testid="clear-filters-btn">{t("clear")}</button></div>
          <Filters params={params} set={set} facets={meta.facets || {}} /></div></aside>
        <div className="flex-1">
          {loading && page === 1 ? <GridSkeleton /> : items.length === 0 ? <Empty title={t("no_results")} sub={params.get("q") ? `"${params.get("q")}"` : ""} /> : (
            <div className={layout === "grid" ? "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3" : "flex flex-col gap-4"} data-testid="product-grid">
              {items.map((p) => <ProductCard key={p.id} p={p} layout={layout} />)}
              {loading && [1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>)}
          <div ref={sentinel} className="h-8" />
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[88%] overflow-y-auto bg-[#FFFAF5]">
          <SheetHeader><SheetTitle className="text-[#7A1F1F]">{t("filters")}</SheetTitle></SheetHeader>
          <Filters params={params} set={set} facets={meta.facets || {}} />
          <button onClick={() => setOpen(false)} className="btn-primary mt-4 w-full" data-testid="apply-filters-btn">{t("apply")}</button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
