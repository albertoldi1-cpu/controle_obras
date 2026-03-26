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

export type ObraFinPoint = {
  day: string;
  produced_accumulated_brl?: number | null;
  forecast_optimistic_brl?: number | null;
  forecast_pessimistic_brl?: number | null;
};

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const NAME_PROD = "Valor produzido (acum.)";
const NAME_OPT = "Previsão financeira (otimista)";
const NAME_PES = "Previsão financeira (pessimista)";

export default function ObraFinancialAdvanceChart({ data }: { data: ObraFinPoint[] }) {
  const chartData = data.map((p) => ({
    ...p,
    label: fmtDay(p.day),
    forecast_optimistic_brl: p.forecast_optimistic_brl ?? undefined,
    forecast_pessimistic_brl: p.forecast_pessimistic_brl ?? undefined,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-white/15 text-slate-500">
        Cadastre o avanço físico (menu Avanço físico / Lançamentos) e as previsões de faturamento abaixo para ver a
        curva.
      </div>
    );
  }

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            domain={[0, "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => (typeof v === "number" ? `${(v / 1000).toFixed(0)}k` : String(v))}
            label={{ value: "R$ (valores)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => {
              if (value === undefined || value === null || (typeof value === "number" && Number.isNaN(value))) {
                return ["—", name ?? ""];
              }
              return [fmtBrl(Number(value)), name ?? ""];
            }}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.day as string) ?? ""}
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Legend wrapperStyle={{ paddingTop: 16 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="produced_accumulated_brl"
            name={NAME_PROD}
            stroke="#94a3b8"
            strokeWidth={3}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="forecast_optimistic_brl"
            name={NAME_OPT}
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="forecast_pessimistic_brl"
            name={NAME_PES}
            stroke="#3d8bfd"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
