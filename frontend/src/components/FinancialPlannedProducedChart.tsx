import type { ReactNode } from "react";
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
import type { FinancialPanelSeriesPoint } from "../types";

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const PCT_KEYS = new Set(["physical_executed_pct", "productive_advance_pct"]);

export default function FinancialPlannedProducedChart({
  data,
  obraTotalBrl,
}: {
  data: FinancialPanelSeriesPoint[];
  obraTotalBrl?: number | null;
}) {
  const chartData = data.map((p) => ({
    ...p,
    label: fmtDay(p.day),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-white/15 text-slate-500">
        Cadastre equipes, planejamento e lançamentos de produtividade para ver o avanço produtivo acumulado.
      </div>
    );
  }

  const last = chartData[chartData.length - 1];
  const gap = last.cumulative_planned_brl - last.cumulative_produced_brl;
  const gapPct =
    last.cumulative_planned_brl > 0
      ? ((last.cumulative_produced_brl - last.cumulative_planned_brl) / last.cumulative_planned_brl) * 100
      : null;

  let deviationLine: ReactNode = "—";
  if (gapPct !== null) {
    const cls = gapPct >= 0 ? "text-signal-ok" : "text-signal-warn";
    if (Math.abs(gap) < 0.01) {
      deviationLine = <span className={cls}>0% (alinhado à meta total acumulada)</span>;
    } else if (gap > 0) {
      deviationLine = (
        <span className={cls}>
          {gapPct.toFixed(1)}% (faltam {brl(gap)} para a meta total acumulada)
        </span>
      );
    } else {
      deviationLine = (
        <span className={cls}>
          +{gapPct.toFixed(1)}% ({brl(-gap)} acima da meta total acumulada)
        </span>
      );
    }
  }

  const hasObraTotal = obraTotalBrl != null && obraTotalBrl > 1e-9;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Comparativo acumulado no fim do período exibido: {deviationLine}.
      </p>
      {!hasObraTotal && (
        <p className="text-xs text-amber-200/90">
          Defina o <strong className="text-amber-100">valor total da obra</strong> no topo da página do projeto para
          calcular o avanço produtivo (%).
        </p>
      )}
      <div className="h-[440px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="brl"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
              }}
              formatter={(v: number | string | undefined, name: string, item) => {
                const n = typeof v === "number" ? v : Number(v);
                if (Number.isNaN(n)) return ["—", name];
                const key = item && "dataKey" in item ? String(item.dataKey) : "";
                if (PCT_KEYS.has(key)) return [`${n.toFixed(2)}%`, name];
                return [brl(n), name];
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
            <Line
              yAxisId="brl"
              type="monotone"
              dataKey="cumulative_planned_brl"
              name="Meta Total das Equipes (acum.)"
              stroke="#cbd5e1"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#cbd5e1", strokeWidth: 0 }}
            />
            <Line
              yAxisId="brl"
              type="monotone"
              dataKey="cumulative_produced_brl"
              name="Valor produzido (acum.)"
              stroke="#34d399"
              strokeWidth={3}
              dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="physical_executed_pct"
              name="Avanço físico (%)"
              stroke="#60a5fa"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="productive_advance_pct"
              name="Avanço produtivo (%)"
              stroke="#f472b6"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
