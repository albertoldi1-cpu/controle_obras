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

export default function FinancialPlannedProducedChart({ data }: { data: FinancialPanelSeriesPoint[] }) {
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
      deviationLine = <span className={cls}>0% (alinhado ao planejado acumulado)</span>;
    } else if (gap > 0) {
      deviationLine = (
        <span className={cls}>
          {gapPct.toFixed(1)}% (faltam {brl(gap)} para o planejado acumulado)
        </span>
      );
    } else {
      deviationLine = (
        <span className={cls}>
          +{gapPct.toFixed(1)}% ({brl(-gap)} acima do planejado acumulado)
        </span>
      );
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Comparativo acumulado no fim do período exibido: {deviationLine}.
      </p>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
              }}
              formatter={(v: number | string | undefined, name: string) => {
                const n = typeof v === "number" ? v : Number(v);
                if (Number.isNaN(n)) return ["—", name];
                return [brl(n), name];
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
            <Line
              type="monotone"
              dataKey="cumulative_planned_brl"
              name="Valor planejado (acum.)"
              stroke="#cbd5e1"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#cbd5e1", strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="cumulative_produced_brl"
              name="Valor produzido (acum.)"
              stroke="#34d399"
              strokeWidth={3}
              dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
