import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import api, { errMsg, inr, openFile } from "@/lib/api";
import { toast } from "sonner";
import { PageHead } from "@/admin/AdminApp";

const KINDS = [["sales", "Sales"], ["gst", "GST summary"], ["stock", "Stock"], ["profit", "Profit"], ["customers", "Customers"]];
const MONEY = /total|value|revenue|cost|profit|gst|cgst|sgst|tax|discount|spent|purchase|selling/i;

export function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState("sales");
  const [start, setStart] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [end, setEnd] = useState(today);
  const [rep, setRep] = useState(null);
  useEffect(() => { setRep(null); api.get(`/admin/reports/${kind}`, { params: { start, end } }).then((r) => setRep(r.data)).catch((e) => toast.error(errMsg(e))); }, [kind, start, end]);
  const exp = (fmt) => openFile(`/admin/reports/${kind}?start=${start}&end=${end}&fmt=${fmt}`, `${kind}-report.${fmt}`).catch((e) => toast.error(errMsg(e)));
  const sumIdx = rep ? rep.columns.map((c, i) => (MONEY.test(c) && !/%|rate|lvl/i.test(c) ? i : -1)).filter((i) => i >= 0) : [];
  return (
    <div data-testid="admin-reports">
      <PageHead title="Reports"><button onClick={() => exp("xlsx")} className="btn-outline" data-testid="export-excel-btn"><FileSpreadsheet size={16} />Excel</button><button onClick={() => exp("pdf")} className="btn-secondary" data-testid="export-pdf-btn"><FileText size={16} />PDF</button></PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-2">{KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "border-[#E8671B] bg-[#E8671B] text-white" : "bg-white"}`} data-testid={`report-tab-${k}`}>{l}</button>)}
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input !w-auto" data-testid="report-start" /><span>to</span><input type="date" value={end} max={today} onChange={(e) => setEnd(e.target.value)} className="input !w-auto" data-testid="report-end" /></div>
      {!rep ? <div className="skeleton h-60" /> : (
        <div className="card overflow-x-auto" data-testid="report-table"><table className="admin-table"><thead><tr>{rep.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rep.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{sumIdx.includes(j) && typeof v === "number" ? inr(v) : String(v)}</td>)}</tr>)}
            {sumIdx.length > 0 && <tr className="bg-[#fbf3ea] font-bold">{rep.columns.map((c, j) => <td key={c}>{j === 0 ? "Total" : sumIdx.includes(j) ? inr(rep.rows.reduce((a, r) => a + (Number(r[j]) || 0), 0)) : ""}</td>)}</tr>}</tbody></table>
          {!rep.rows.length && <p className="p-6 text-center text-sm text-gray-500">No data for this period.</p>}</div>)}
    </div>
  );
}
