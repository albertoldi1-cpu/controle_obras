import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
        Cadastre planejamento e lançamentos de produtividade para ver a curva planejado × produzido.
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="fpBarP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#64748b" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="fpBarR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.75} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="cum"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="day"
            orientation="right"
            tick={{ fill: "#cbd5e1", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
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
          <Bar
            yAxisId="day"
            dataKey="daily_planned_brl"
            name="Planejado (dia)"
            fill="url(#fpBarP)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            yAxisId="day"
            dataKey="daily_produced_brl"
            name="Produzido (dia)"
            fill="url(#fpBarR)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Line
            yAxisId="cum"
            type="monotone"
            dataKey="cumulative_planned_brl"
            name="Acum. planejado"
            stroke="#cbd5e1"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            yAxisId="cum"
            type="monotone"
            dataKey="cumulative_produced_brl"
            name="Acum. produzido"
            stroke="#34d399"
            strokeWidth={3}
            dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
