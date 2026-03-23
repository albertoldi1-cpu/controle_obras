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
import type { FinancialSeriesPoint } from "../types";

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function FinancialCurveChart({ data }: { data: FinancialSeriesPoint[] }) {
  const chartData = data.map((p) => ({
    ...p,
    label: fmtDay(p.day),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] text-slate-500">
        Lançamentos financeiros aparecem aqui em curva acumulada (modelo avanço produtivo da planilha).
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="finBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#d97706" stopOpacity={0.35} />
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
            tick={{ fill: "#6ee7b7", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(52,211,153,0.2)" }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="day"
            orientation="right"
            tick={{ fill: "#fcd34d", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(251,191,36,0.2)" }}
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
            labelFormatter={(_, p) => (p?.[0]?.payload?.day as string) ?? ""}
          />
          <Legend wrapperStyle={{ paddingTop: 16 }} />
          <Bar
            yAxisId="day"
            dataKey="daily_value"
            name="Valor no dia"
            fill="url(#finBar)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
          <Line
            yAxisId="cum"
            type="monotone"
            dataKey="cumulative_value"
            name="Acumulado"
            stroke="#34d399"
            strokeWidth={3}
            dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
