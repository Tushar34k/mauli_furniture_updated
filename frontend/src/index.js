import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { API } from "@/lib/api";

const report = (message, stack) => {
  try {
    navigator.sendBeacon?.(`${API}/log/error`, new Blob([JSON.stringify({ message, stack, url: window.location.href })], { type: "application/json" }));
  } catch (e) { /* ignore */ }
};
window.addEventListener("error", (e) => report(e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => report(String(e.reason?.message || e.reason), e.reason?.stack));

if (process.env.REACT_APP_GA_ID) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.REACT_APP_GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", process.env.REACT_APP_GA_ID);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
const splash = document.getElementById("splash");
if (splash) { setTimeout(() => { splash.style.opacity = "0"; setTimeout(() => splash.remove(), 400); }, 500); }
