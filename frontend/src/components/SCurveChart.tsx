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
import type { SeriesPoint } from "../types";

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export default function SCurveChart({ data }: { data: SeriesPoint[] }) {
  const chartData = data.map((p) => ({
    ...p,
    label: fmtDay(p.day),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-white/15 text-slate-500">
        Cadastre lançamentos diários para visualizar a curva S.
      </div>
    );
  }

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            unit="%"
          />
          <Tooltip
            formatter={(v: number | string | undefined) => {
              if (v === undefined || v === null || (typeof v === "number" && Number.isNaN(v))) return ["—", ""];
              return [`${Number(v).toFixed(2)}%`, ""];
            }}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.day as string) ?? ""}
          />
          <Legend wrapperStyle={{ paddingTop: 16 }} />
          <Line
            type="monotone"
            dataKey="optimistic"
            name="Planejamento otimista"
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="pessimistic"
            name="Planejamento pessimista"
            stroke="#3d8bfd"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="executed"
            name="Executado (real)"
            stroke="#94a3b8"
            strokeWidth={3}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
