import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import type { FinancialPhysicalComparison } from "../types";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

export default function FinancialPhysicalComparisonPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [data, setData] = useState<FinancialPhysicalComparison | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const q = { date_from: dateFrom || undefined, date_to: dateTo || undefined };
    const d = await api.financial.physicalComparison(projectId, q);
    setData(d);
  }, [projectId, dateFrom, dateTo]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [load]);

  if (err && !data) return <p className="text-signal-bad">{err}</p>;
  if (!data) return <p className="animate-pulse text-slate-500">Carregando comparativo…</p>;

  const chartData = data.points.map((p) => ({ ...p, label: fmtDate(p.day) }));

  async function doExport() {
    setExporting(true);
    setErr(null);
    try {
      const q = { date_from: dateFrom || undefined, date_to: dateTo || undefined };
      const blob = await api.financial.exportPhysicalComparisonXlsx(projectId, q);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparativo-fisico-produtivo-${projectId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] to-transparent p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Comparativo Físico × Produtivo</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Correlação entre avanço físico executado (%), valor produzido (R$) e quantidade produtiva dos lançamentos.
        </p>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      <div className="glass flex flex-wrap items-end gap-4 rounded-2xl p-5">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Data inicial</label>
          <input
            type="date"
            className="rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Data final</label>
          <input
            type="date"
            className="rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => doExport()}
          disabled={exporting}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Gerando…" : "Excel"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Avanço físico executado</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{data.summary.physical_executed_pct.toFixed(2)}%</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total produzido</p>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-300">{brl(data.summary.total_produced_brl)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Quantidade produtiva</p>
          <p className="mt-2 font-display text-2xl font-bold text-indigo-300">
            {data.summary.total_productive_quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold text-white">Evolução diária</h2>
        <div className="mt-5 h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} />
              <YAxis yAxisId="left" unit="%" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
              />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="physical_executed_pct" name="Executado físico (%)" stroke="#60a5fa" strokeWidth={3} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="produced_value_brl" name="Produzido (R$ dia)" stroke="#34d399" strokeWidth={2.5} dot={false} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="optimistic_productive_forecast_brl"
                name="Previsão produtiva otimista (R$ dia)"
                stroke="#22c55e"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pessimistic_productive_forecast_brl"
                name="Previsão produtiva pessimista (R$ dia)"
                stroke="#f59e0b"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
              <Line yAxisId="right" type="monotone" dataKey="productive_quantity" name="Quantidade produtiva (dia)" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
