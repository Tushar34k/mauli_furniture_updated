import { lazy, Suspense, useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { AppProvider, useApp } from "@/lib/store";
import api, { errMsg } from "@/lib/api";
import { Header, BottomNav, Footer } from "@/components/layout";
import { WhatsAppFab, PageSkeleton } from "@/components/shop";

const P = (f) => lazy(f);
const Home = P(() => import("@/pages/Home"));
const Categories = P(() => import("@/pages/Categories"));
const Listing = P(() => import("@/pages/Listing"));
const SearchPage = P(() => import("@/pages/SearchPage"));
const Product = P(() => import("@/pages/Product"));
const Cart = P(() => import("@/pages/Cart"));
const Checkout = P(() => import("@/pages/Checkout"));
const OrderDetail = P(() => import("@/pages/OrderDetail"));
const Login = P(() => import("@/pages/Login"));
const Account = P(() => import("@/pages/Account"));
const X = (name) => lazy(() => import("@/pages/Extras").then((m) => ({ default: m[name] })));
const Compare = X("Compare");
const Showroom = X("Showroom");
const Blog = X("Blog");
const Enquiry = X("Enquiry");
const InfoPage = X("InfoPage");
const AdminLogin = P(() => import("@/admin/AdminLogin"));
const AdminApp = P(() => import("@/admin/AdminApp"));

function AuthCallback() {
  const { login } = useApp();
  const nav = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(window.location.hash.slice(1)).get("session_id");
    api.post("/auth/google", { session_id: sid })
      .then(({ data }) => { login(data.token, data.user); window.history.replaceState(null, "", "/account"); nav("/account", { replace: true }); })
      .catch((e) => { toast.error(errMsg(e)); nav("/login", { replace: true }); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <PageSkeleton />;
}

function StoreLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      <Header />
      <main className="flex-1"><Suspense fallback={<PageSkeleton />}><Outlet /></Suspense></main>
      <Footer />
      <WhatsAppFab />
      <BottomNav />
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/products" element={<Listing />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/showroom" element={<Showroom />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Blog />} />
          <Route path="/enquiry" element={<Enquiry />} />
          <Route path="/page/:slug" element={<InfoPage />} />
          <Route path="*" element={<InfoPage notFound />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    </AppProvider>
  );
}
