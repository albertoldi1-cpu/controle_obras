import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Activity, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { api } from "../api";
import type { Dashboard } from "../types";
import SCurveChart from "../components/SCurveChart";
import FarolDot from "../components/FarolDot";

type Ctx = { projectId: number };

function fmtRelPct(v: number | null) {
  if (v === null || Number.isNaN(v)) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

function TrendIcon({ v }: { v: number | null }) {
  if (v === null) return <Minus className="h-5 w-5 text-slate-500" />;
  if (v > 1) return <TrendingUp className="h-5 w-5 text-signal-ok" />;
  if (v < -1) return <TrendingDown className="h-5 w-5 text-signal-bad" />;
  return <Minus className="h-5 w-5 text-signal-warn" />;
}

export default function DashboardPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    api.dashboard(projectId).then(
      (d) => on && setData(d),
      (e) => on && setErr(e instanceof Error ? e.message : "Erro")
    );
    return () => {
      on = false;
    };
  }, [projectId]);

  if (err) {
    return <p className="text-signal-bad">{err}</p>;
  }
  if (!data) {
    return <p className="animate-pulse text-slate-500">Carregando painel…</p>;
  }

  const { obra, series, stages, reference_date, last_execution_date } = data;
  const devO = obra.deviation_vs_optimistic_pct;
  const devP = obra.deviation_vs_pessimistic_pct;
  const refFmt = reference_date
    ? new Date(reference_date + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";
  const lastExFmt = last_execution_date
    ? new Date(last_execution_date + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-transparent to-slate-900/40 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Painel Avanço Físico</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Acompanhamento de etapas, curva S e farol físico (otimista, pessimista e executado).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Executado (obra)</p>
          <p className="mt-2 font-display text-3xl font-bold text-white">{obra.pct_executed.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500">Ref. KPIs: {refFmt}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">vs Otimista</p>
          <p
            className={`mt-2 font-display text-3xl font-bold ${
              devO !== null && devO >= 0 ? "text-signal-ok" : "text-signal-warn"
            }`}
          >
            {fmtRelPct(devO)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Desvio % sobre o previsto otimista</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">vs Pessimista</p>
          <p
            className={`mt-2 font-display text-3xl font-bold ${
              devP !== null && devP >= 0 ? "text-signal-ok" : "text-signal-bad"
            }`}
          >
            {fmtRelPct(devP)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Desvio % sobre o previsto pessimista</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tendência</p>
              <p className="mt-2 font-medium leading-snug text-accent-glow">{obra.trend_label}</p>
            </div>
            <TrendIcon v={devO} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{obra.trend_detail}</p>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">
        Curva executada plotada até o último dia com produção: <strong className="text-slate-400">{lastExFmt}</strong>
      </p>

      <section className="glass rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Curva S — avanço físico</h2>
            <p className="mt-1 text-sm text-slate-500">
              Peso da etapa é o mesmo para otimista e pessimista; apenas as quantidades diárias planejadas mudam.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-4 w-4 text-accent" />
            Otimista · Pessimista · Real
          </div>
        </div>
        <SCurveChart data={series} />
      </section>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-white">Farol por etapa</h2>
          <p className="mt-1 text-sm text-slate-500">
            Verde: realizado ≥ otimista · Amarelo: entre pessimista e otimista · Vermelho: abaixo do pessimista
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Farol</th>
                <th className="px-6 py-3">Etapa</th>
                <th className="px-6 py-3">Peso</th>
                <th className="px-6 py-3">Otimista</th>
                <th className="px-6 py-3">Pessimista</th>
                <th className="px-6 py-3">Executado</th>
                <th className="px-6 py-3">Desvio × otimista (%)</th>
                <th className="px-6 py-3">Desvio × pessimista (%)</th>
              </tr>
            </thead>
            <tbody>
              {stages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                    Cadastre etapas e lançamentos diários para ver o farol.
                  </td>
                </tr>
              ) : (
                stages.map((s) => (
                  <tr key={s.stage_id} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                    <td className="px-6 py-3">
                      <FarolDot farol={s.farol} />
                    </td>
                    <td className="px-6 py-3 font-medium text-white">
                      {s.name}
                      {s.unit ? <span className="ml-2 text-xs font-normal text-slate-500">({s.unit})</span> : null}
                    </td>
                    <td className="px-6 py-3 text-slate-400">{(s.weight * 100).toFixed(1)}%</td>
                    <td className="px-6 py-3 text-slate-300">{s.pct_optimistic.toFixed(1)}%</td>
                    <td className="px-6 py-3 text-slate-300">{s.pct_pessimistic.toFixed(1)}%</td>
                    <td className="px-6 py-3 text-accent-glow">{s.pct_executed.toFixed(1)}%</td>
                    <td
                      className={`px-6 py-3 font-medium ${
                        s.deviation_vs_optimistic_pct !== null && s.deviation_vs_optimistic_pct >= 0
                          ? "text-signal-ok"
                          : "text-signal-warn"
                      }`}
                    >
                      {fmtRelPct(s.deviation_vs_optimistic_pct)}
                    </td>
                    <td
                      className={`px-6 py-3 font-medium ${
                        s.deviation_vs_pessimistic_pct !== null && s.deviation_vs_pessimistic_pct >= 0
                          ? "text-signal-ok"
                          : "text-signal-bad"
                      }`}
                    >
                      {fmtRelPct(s.deviation_vs_pessimistic_pct)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-white">Planejamento vs cadastro (curva S)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Compara a <strong className="text-slate-400">quantidade cadastrada</strong> da etapa com a{" "}
            <strong className="text-slate-400">soma de todos os lançamentos planejados</strong> (otimista e pessimista).
            <strong className="text-slate-400"> Falta planejar</strong> = cadastro − Σ planejado (quanto ainda falta lançar
            no planejamento). <strong className="text-slate-400">Desvio %</strong> = (Σ planejado − cadastro) / cadastro
            (negativo = falta planejar; positivo = planejou acima do cadastro). Farol: verde = ambos cenários fecham o
            cadastro · amarelo = só um cenário · vermelho = ambos abaixo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Farol</th>
                <th className="px-6 py-3">Etapa</th>
                <th className="px-6 py-3">Qtd. cadastro</th>
                <th className="px-6 py-3">Σ plan. otimista</th>
                <th className="px-6 py-3">Σ plan. pessimista</th>
                <th className="px-6 py-3">Falta planej. otimista</th>
                <th className="px-6 py-3">Falta planej. pessimista</th>
                <th className="px-6 py-3">Desvio % otimista</th>
                <th className="px-6 py-3">Desvio % pessimista</th>
              </tr>
            </thead>
            <tbody>
              {stages.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                    Cadastre etapas e lançamentos para visualizar o fechamento do planejamento.
                  </td>
                </tr>
              ) : (
                stages.map((s) => (
                  <tr key={`saldo-${s.stage_id}`} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                    <td className="px-6 py-3">
                      <FarolDot farol={s.farol_saldo} />
                    </td>
                    <td className="px-6 py-3 font-medium text-white">
                      {s.name}
                      {s.unit ? <span className="ml-2 text-xs font-normal text-slate-500">({s.unit})</span> : null}
                    </td>
                    <td className="px-6 py-3 text-slate-300">{s.total_quantity.toFixed(2)}</td>
                    <td className="px-6 py-3 text-slate-300">{s.planning_sum_optimistic.toFixed(2)}</td>
                    <td className="px-6 py-3 text-slate-300">{s.planning_sum_pessimistic.toFixed(2)}</td>
                    <td className="px-6 py-3 text-amber-200/90">{s.pending_planning_optimistic.toFixed(2)}</td>
                    <td className="px-6 py-3 text-amber-200/90">{s.pending_planning_pessimistic.toFixed(2)}</td>
                    <td className="px-6 py-3 font-medium text-slate-300">{fmtRelPct(s.deviation_planning_optimistic_pct)}</td>
                    <td className="px-6 py-3 font-medium text-slate-300">{fmtRelPct(s.deviation_planning_pessimistic_pct)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
