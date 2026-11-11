import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api, { errMsg, track } from "@/lib/api";
import { translate, L as Lx } from "@/lib/i18n";

const Ctx = createContext(null);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const usePersist = (key, init) => {
  const [v, setV] = useState(() => load(key, init));
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)); }, [key, v]);
  return [v, setV];
};

export function AppProvider({ children }) {
  const [lang, setLang] = usePersist("mfm_lang", "mr");
  const [user, setUser] = useState(undefined);
  const [settings, setSettings] = useState({});
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = usePersist("mfm_cart", []);
  const [saved, setSaved] = usePersist("mfm_saved", []);
  const [compare, setCompare] = usePersist("mfm_compare", []);
  const [recent, setRecent] = usePersist("mfm_recent", []);
  const [localWish, setLocalWish] = usePersist("mfm_wish", []);
  const [wish, setWish] = useState([]);

  const t = useCallback((k, v) => translate(lang, k, v), [lang]);
  const L = useCallback((o, f) => Lx(lang, o, f), [lang]);

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem("mfm_token")) { setUser(null); return; }
    try {
      const { data } = await api.post("/auth/refresh");
      localStorage.setItem("mfm_token", data.token); setUser(data.user); setWish(data.user.wishlist || []);
    } catch { localStorage.removeItem("mfm_token"); setUser(null); }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const { data } = await api.get("/categories/options");
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      try {
        const { data } = await api.get("/categories");
        setCategories(Array.isArray(data) ? data : []);
      } catch { /* retain the last successful list */ }
    }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    api.get("/settings/public").then((r) => setSettings(r.data)).catch(() => {});
    refreshCategories();
    if (window.location.hash.includes("session_id=")) { setUser(null); return; }
    refreshMe();
  }, [refreshMe, refreshCategories]);

  const login = (token, u) => { localStorage.setItem("mfm_token", token); setUser(u); setWish(u.wishlist || []); };
  const logout = () => { localStorage.removeItem("mfm_token"); setUser(null); setWish([]); };

  const addToCart = (p, qty = 1, variant = "") => {
    setCart((c) => {
      const i = c.findIndex((x) => x.product_id === p.id && x.variant === variant);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: Math.min(n[i].qty + qty, 50) }; return n; }
      return [...c, { product_id: p.id, qty, variant, name: p.name, name_mr: p.name_mr, image: p.images?.[0], price: p.price, slug: p.slug }];
    });
    track("add_to_cart", { item_id: p.id, value: p.price });
    toast.success(translate(lang, "added"), { description: Lx(lang, p, "name") });
  };
  const setQty = (pid, variant, qty) => setCart((c) => c.map((x) => (x.product_id === pid && x.variant === variant ? { ...x, qty } : x)));
  const removeItem = (pid, variant) => setCart((c) => c.filter((x) => !(x.product_id === pid && x.variant === variant)));
  const saveForLater = (item) => { removeItem(item.product_id, item.variant); setSaved((s) => [...s.filter((x) => x.product_id !== item.product_id), item]); };
  const moveToCart = (item) => { setSaved((s) => s.filter((x) => x.product_id !== item.product_id)); setCart((c) => [...c, item]); };

  const wishlist = user ? wish : localWish;
  const toggleWish = async (pid) => {
    if (!user) { setLocalWish((w) => (w.includes(pid) ? w.filter((x) => x !== pid) : [...w, pid])); return; }
    try { const { data } = await api.post(`/account/wishlist/${pid}`); setWish(data.ids); toast.success(data.added ? translate(lang, "wishlist") + " +" : translate(lang, "remove")); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const toggleCompare = (p) => setCompare((c) => {
    if (c.find((x) => x.id === p.id)) return c.filter((x) => x.id !== p.id);
    if (c.length >= 3) { toast.error("Max 3 products"); return c; }
    toast.success(translate(lang, "compare") + " ✓");
    return [...c, { id: p.id, slug: p.slug }];
  });
  const addRecent = useCallback((p) => setRecent((r) => [p.id, ...r.filter((x) => x !== p.id)].slice(0, 12)), [setRecent]);

  const value = useMemo(() => ({
    lang, setLang, t, L, user, setUser, login, logout, refreshMe, settings, setSettings, categories, refreshCategories,
    cart, setCart, addToCart, setQty, removeItem, saved, saveForLater, moveToCart,
    wishlist, toggleWish, compare, setCompare, toggleCompare, recent, addRecent,
    cartCount: cart.reduce((a, b) => a + b.qty, 0),
  }), [lang, t, L, user, settings, categories, refreshCategories, cart, saved, wishlist, compare, recent]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

export function useTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | माऊली फर्निचर मॉल` : "माऊली फर्निचर मॉल | Mauli Furniture Mall";
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description.slice(0, 160));
  }, [title, description]);
}
