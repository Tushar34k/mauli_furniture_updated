import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { AlertTriangle } from "lucide-react";
import api, { inr } from "@/lib/api";
import { PageHead, Stat } from "@/admin/AdminApp";

export function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then((r) => setD(r.data)); }, []);
  if (!d) return <div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24" />)}</div>;
  return (
    <div data-testid="admin-dashboard">
      <PageHead title="Dashboard"><Link to="/admin/pos" className="btn-primary">New POS sale</Link><Link to="/admin/products/new" className="btn-secondary">Add product</Link></PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Today's sales" value={inr(d.today_sales)} testid="stat-today-sales" />
        <Stat label="Today's orders" value={d.today_orders} testid="stat-today-orders" />
        <Stat label="Pending orders" value={d.pending_orders} accent="#7A1F1F" testid="stat-pending" />
        <Stat label="New customers (14d)" value={d.new_customers} accent="#7A1F1F" testid="stat-new-customers" />
        <Stat label="Low stock" value={d.low_stock.length} accent="#d97706" testid="stat-low-stock" />
        <Stat label="New enquiries" value={d.new_enquiries} sub={`${d.pending_reviews} reviews pending`} testid="stat-enquiries" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2" data-testid="revenue-chart"><h3 className="mb-3 text-base">Revenue (last 14 days)</h3>
          <ResponsiveContainer width="100%" height={260}><AreaChart data={d.revenue_graph}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E8671B" stopOpacity={0.4} /><stop offset="100%" stopColor="#E8671B" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => inr(v)} />
            <Area type="monotone" dataKey="revenue" stroke="#E8671B" strokeWidth={2.5} fill="url(#g)" /></AreaChart></ResponsiveContainer></div>
        <div className="card p-4" data-testid="low-stock-alerts"><h3 className="mb-3 flex items-center gap-2 text-base"><AlertTriangle size={17} className="text-amber-600" />Low-stock alerts</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">{d.low_stock.map((p) => (
            <Link key={p.id} to={`/admin/products/${p.id}`} className="flex justify-between rounded-lg bg-[#fbf3ea] px-3 py-2 text-sm"><span className="line-clamp-1">{p.name}</span><b className={p.stock <= 0 ? "text-red-600" : "text-amber-700"}>{p.stock}</b></Link>))}
            {!d.low_stock.length && <p className="text-sm text-gray-500">All stock healthy.</p>}</div></div>
        <div className="card p-4 lg:col-span-2" data-testid="category-sales-chart"><h3 className="mb-3 text-base">Category-wise sales (14 days)</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={d.category_sales}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="category" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => inr(v)} /><Bar dataKey="sales" fill="#7A1F1F" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="card p-4" data-testid="top-products"><h3 className="mb-3 text-base">Top products</h3>
          {d.top_products.map((p, i) => <div key={p.name} className="flex items-center gap-3 py-1.5 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#F5B800] text-xs font-bold">{i + 1}</span><span className="flex-1 line-clamp-1">{p.name}</span><b>{p.qty}</b></div>)}</div>
      </div>
      <div className="card mt-5 overflow-x-auto p-4" data-testid="recent-orders"><h3 className="mb-3 text-base">Recent orders</h3>
        <table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>{d.recent_orders.map((o) => <tr key={o.id}><td><Link to={`/admin/orders?open=${o.id}`} className="font-semibold text-[#E8671B]">{o.order_no}</Link></td><td>{o.address?.name}</td><td className="uppercase text-xs">{o.channel}</td><td className="capitalize">{o.status.replace(/_/g, " ")}</td><td>{inr(o.total)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
