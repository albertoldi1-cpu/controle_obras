import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, Filter } from "lucide-react";
import { api } from "../api";
import type { FinancialPanelDashboard } from "../types";
import FinancialPlannedProducedChart from "../components/FinancialPlannedProducedChart";
import FarolDot from "../components/FarolDot";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinancialPanelPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [data, setData] = useState<FinancialPanelDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [team, setTeam] = useState("");
  const [exporting, setExporting] = useState(false);

  const q = useCallback(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      team_type: team || undefined,
    }),
    [dateFrom, dateTo, team]
  );

  useEffect(() => {
    let on = true;
    setErr(null);
    api.financial
      .panel(projectId, q())
      .then((d) => on && setData(d))
      .catch((e) => on && setErr(e instanceof Error ? e.message : "Erro"));
    return () => {
      on = false;
    };
  }, [projectId, q]);

  async function doExport() {
    setExporting(true);
    setErr(null);
    try {
      const blob = await api.financial.exportXlsx(projectId, q());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `painel-financeiro-${projectId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  if (err && !data) {
    return <p className="text-signal-bad">{err}</p>;
  }
  if (!data) {
    return <p className="animate-pulse text-slate-500">Carregando painel financeiro…</p>;
  }

  const dev = data.summary.deviation_pct;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-slate-900/40 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Painel Financeiro</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Avanço produtivo: meta diária (planejado) versus valor produzido, curva acumulada e farol por dia — no
          mesmo espírito do painel de avanço físico.
        </p>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      <div className="glass flex flex-wrap items-end gap-4 rounded-2xl p-5">
        <Filter className="h-5 w-5 text-emerald-400" />
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
        <div>
          <label className="mb-1 block text-xs text-slate-500">Equipe</label>
          <select
            className="min-w-[160px] rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            <option value="">Todas</option>
            {data.team_types.map((t) => (
              <option key={t || "__sem_tipo__"} value={t}>
                {t.trim() ? t : "—"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => doExport()}
          disabled={exporting}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Gerando…" : "Excel"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total planejado</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-200">{brl(data.summary.total_planned_brl)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total produzido</p>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-300">{brl(data.summary.total_produced_brl)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Desvio</p>
          <p
            className={`mt-2 font-display text-2xl font-bold ${
              dev !== null && dev >= 0 ? "text-signal-ok" : "text-signal-warn"
            }`}
          >
            {dev === null ? "—" : `${dev >= 0 ? "+" : ""}${dev.toFixed(1)}%`}
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Último dia com dados</p>
          <p className="mt-2 font-display text-xl text-white">
            {data.summary.last_data_day
              ? new Date(data.summary.last_data_day + "T12:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold text-white">Curva planejado × produzido</h2>
        <p className="mt-1 text-sm text-slate-500">
          Barras: valores do dia · Linhas: acumulado planejado (cinza) e acumulado produzido (verde).
        </p>
        <div className="mt-6">
          <FinancialPlannedProducedChart data={data.series} />
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-white">Farol por dia</h2>
          <p className="mt-1 text-sm text-slate-500">
            Verde: produzido ≥ planejado · Amarelo: ≥ 85% do planejado · Vermelho: abaixo de 85%
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Farol</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Equipes (dia)</th>
                <th className="px-6 py-3">Planejado</th>
                <th className="px-6 py-3">Produzido</th>
              </tr>
            </thead>
            <tbody>
              {data.farol_days.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Sem dados no período. Use Planejamento e Lanç. produtividade.
                  </td>
                </tr>
              ) : (
                [...data.farol_days].reverse().map((row) => (
                  <tr key={row.day} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-3">
                      <FarolDot farol={row.farol} />
                    </td>
                    <td className="px-6 py-3 text-slate-300">
                      {new Date(row.day + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-3 text-slate-400">{row.teams_count}</td>
                    <td className="px-6 py-3 text-slate-300">{brl(row.planned_brl)}</td>
                    <td className="px-6 py-3 font-medium text-emerald-300">{brl(row.produced_brl)}</td>
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
