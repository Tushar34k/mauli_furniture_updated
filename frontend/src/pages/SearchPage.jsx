import { useNavigate } from "react-router-dom";
import { Clock, Mic } from "lucide-react";
import { SearchBox, useVoice } from "@/components/layout";
import { useApp } from "@/lib/store";

export default function SearchPage() {
  const { t } = useApp();
  const nav = useNavigate();
  const recent = JSON.parse(localStorage.getItem("mfm_recent_search") || "[]");
  const voice = useVoice((txt) => nav(`/products?q=${encodeURIComponent(txt)}`));
  const popular = ["Sofa", "King bed", "Dining set", "Wardrobe", "Mattress", "Office chair", "शिसम बेड", "सोफा"];
  return (
    <div className="container-x min-h-[60vh] py-5" data-testid="search-page">
      <SearchBox autoFocus />
      <button onClick={voice.start} className={`btn-outline mt-5 w-full ${voice.on ? "animate-pulse" : ""}`} data-testid="search-page-voice"><Mic size={18} />{voice.on ? t("listening") : t("voice")}</button>
      {recent.length > 0 && <div className="mt-6"><p className="label">{t("recent")}</p>
        {recent.map((r) => <button key={r} onClick={() => nav(`/products?q=${encodeURIComponent(r)}`)} className="flex w-full items-center gap-2 border-b py-3 text-sm"><Clock size={15} className="text-gray-400" />{r}</button>)}</div>}
      <div className="mt-6"><p className="label">{t("popular")}</p><div className="flex flex-wrap gap-2">
        {popular.map((p) => <button key={p} onClick={() => nav(`/products?q=${encodeURIComponent(p)}`)} className="chip bg-white hover:border-[#E8671B]">{p}</button>)}</div></div>
    </div>
  );
}
