import { lazy, Suspense, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Boxes, ShoppingBag, Calculator, Users, Tags, Star, MessageSquare, Bell, BarChart3, Settings, Menu, LogOut, KeyRound, ExternalLink } from "lucide-react";
import { useApp } from "@/lib/store";

const FILES = {
  Dashboard: () => import("@/admin/Dashboard"), Products: () => import("@/admin/Products"), Inventory: () => import("@/admin/Inventory"),
  Orders: () => import("@/admin/Orders"), POS: () => import("@/admin/POS"), Manage: () => import("@/admin/Manage"),
  Reports: () => import("@/admin/Reports"), Settings: () => import("@/admin/Settings"),
};
const A = (name, file) => lazy(() => FILES[file]().then((m) => ({ default: m[name] })));
const Dashboard = A("Dashboard", "Dashboard");
const Products = A("Products", "Products");
const ProductForm = A("ProductForm", "Products");
const Inventory = A("Inventory", "Inventory");
const Orders = A("Orders", "Orders");
const POS = A("POS", "POS");
const Customers = A("Customers", "Orders");
const Manage = A("Manage", "Manage");
const Moderation = A("Moderation", "Manage");
const Enquiries = A("Enquiries", "Manage");
const Notifications = A("Notifications", "Manage");
const Reports = A("Reports", "Reports");
const SettingsPage = A("SettingsPage", "Settings");
const ChangePassword = A("ChangePassword", "Settings");

const S = ["owner", "manager", "staff"], M = ["owner", "manager"];
export const NAV = [
  ["", "Dashboard", LayoutDashboard, S], ["products", "Products", Package, S], ["inventory", "Inventory", Boxes, S], ["orders", "Orders", ShoppingBag, [...S, "delivery"]],
  ["pos", "POS / Walk-in", Calculator, S], ["customers", "Customers", Users, S], ["manage", "Catalog & Store", Tags, M], ["reviews", "Reviews & Q&A", Star, S],
  ["enquiries", "Enquiries", MessageSquare, S], ["notifications", "Notifications", Bell, M], ["reports", "Reports", BarChart3, M], ["settings", "Settings & Staff", Settings, M],
  ["password", "Change Password", KeyRound, [...S, "delivery"]],
];

export default function AdminApp() {
  const { user, logout } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (user === undefined) return <div className="p-10"><div className="skeleton h-40" /></div>;
  if (!user || user.role === "customer") return <Navigate to="/admin/login" replace />;
  const items = NAV.filter((n) => n[3].includes(user.role));
  const side = (
    <aside className="flex h-full w-64 flex-col bg-[#2a0f0f] text-white/80">
      <div className="flex items-center gap-2 border-b border-white/10 p-4"><img src="/logo.svg" alt="" className="h-9 w-9" /><div><p className="font-deva font-bold text-white">माऊली फर्निचर</p><p className="text-[10px] tracking-widest text-[#F5B800]">ADMIN PANEL</p></div></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">{items.map(([to, label, I]) => (
        <NavLink key={to} to={`/admin/${to}`} end={to === ""} onClick={() => setOpen(false)} data-testid={`admin-nav-${to || "dashboard"}`}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-[#E8671B] text-white" : "hover:bg-white/10"}`}><I size={17} />{label}</NavLink>))}</nav>
      <div className="border-t border-white/10 p-3 text-xs"><p className="font-semibold text-white">{user.name}</p><p className="capitalize text-[#F5B800]" data-testid="admin-role">{user.role}</p>
        <div className="mt-2 flex gap-2"><a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white"><ExternalLink size={13} />Store</a>
          <button onClick={() => { logout(); nav("/admin/login"); }} className="ml-auto flex items-center gap-1 hover:text-white" data-testid="admin-logout-btn"><LogOut size={13} />Logout</button></div></div>
    </aside>);
  const home = user.role === "delivery" ? <Navigate to="/admin/orders" replace /> : <Dashboard />;
  return (
    <div className="flex min-h-screen bg-[#f7f2ec]" data-testid="admin-app">
      <div className="no-print sticky top-0 hidden h-screen lg:block">{side}</div>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><div className="h-full">{side}</div><div className="flex-1 bg-black/40" onClick={() => setOpen(false)} /></div>}
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} data-testid="admin-menu-btn"><Menu /></button><span className="font-deva font-bold text-[#7A1F1F]">माऊली Admin</span></header>
        <main className="p-4 sm:p-6"><Suspense fallback={<div className="skeleton h-60" />}>
          <Routes>
            <Route index element={home} />
            <Route path="products" element={<Products />} /><Route path="products/new" element={<ProductForm />} /><Route path="products/:id" element={<ProductForm />} />
            <Route path="inventory" element={<Inventory />} /><Route path="orders" element={<Orders />} /><Route path="pos" element={<POS />} />
            <Route path="customers" element={<Customers />} /><Route path="manage" element={<Manage />} /><Route path="reviews" element={<Moderation />} />
            <Route path="enquiries" element={<Enquiries />} /><Route path="notifications" element={<Notifications />} /><Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SettingsPage />} /><Route path="password" element={<ChangePassword />} />
          </Routes></Suspense></main>
      </div>
    </div>
  );
}

export const PageHead = ({ title, children }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl sm:text-3xl">{title}</h1><div className="flex flex-wrap gap-2">{children}</div></div>
);

export const Stat = ({ label, value, sub, accent = "#E8671B", testid }) => (
  <div className="card p-4" data-testid={testid}><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-1 text-2xl font-extrabold" style={{ color: accent }}>{value}</p>{sub && <p className="text-xs text-gray-500">{sub}</p>}</div>
);

export const Pager = ({ page, pages, set }) => pages > 1 ? (
  <div className="mt-4 flex items-center justify-end gap-2 text-sm"><button disabled={page <= 1} onClick={() => set(page - 1)} className="btn-outline !py-1.5" data-testid="pager-prev">Prev</button>
    <span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => set(page + 1)} className="btn-outline !py-1.5" data-testid="pager-next">Next</button></div>) : null;
