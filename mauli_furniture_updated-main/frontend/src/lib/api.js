import axios from "axios";

export const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

const api = axios.create({ baseURL: API });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("mfm_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
api.interceptors.response.use((r) => r, (e) => {
  const s = e?.response?.status;
  const d = e?.response?.data?.detail;
  if (s === 401 && localStorage.getItem("mfm_token") && !String(e.config?.url).includes("/auth/")) {
    localStorage.removeItem("mfm_token");
    window.location.assign(window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login");
  }
  if (s === 403 && d === "PASSWORD_CHANGE_REQUIRED" && window.location.pathname !== "/admin/password") window.location.assign("/admin/password");
  if (!e.response) e.message = "Network error. Please check your connection. / इंटरनेट कनेक्शन तपासा.";
  return Promise.reject(e);
});

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (x && typeof x.msg === "string" ? x.msg : JSON.stringify(x))).join(" ");
  return d.msg || String(d);
}

export const img = (u) => (u && u.startsWith("/api") ? BASE + u : u || "/logo.svg");
export const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
export const track = (event, params) => window.gtag?.("event", event, params);

export async function openFile(path, filename) {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  else a.target = "_blank";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default api;
