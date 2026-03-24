import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Download, Filter } from "lucide-react";
import { api } from "../api";
import type { FinancialDailyPlan, FinancialPanelDashboard } from "../types";
import FinancialPlannedProducedChart from "../components/FinancialPlannedProducedChart";
import FarolDot from "../components/FarolDot";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const today = () => new Date().toISOString().slice(0, 10);

export default function FinancialPanelPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [data, setData] = useState<FinancialPanelDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [teamId, setTeamId] = useState<number | "">("");
  const [exporting, setExporting] = useState(false);
  const [busyPlan, setBusyPlan] = useState(false);
  const [busyProd, setBusyProd] = useState(false);
  const [planDay, setPlanDay] = useState(today);
  const [planTeamId, setPlanTeamId] = useState<number | "">("");
  const [planValue, setPlanValue] = useState(0);
  const [planPlanningBrl, setPlanPlanningBrl] = useState(0);
  const [prodDay, setProdDay] = useState(today);
  const [prodTeamId, setProdTeamId] = useState<number | "">("");
  const [prodValue, setProdValue] = useState(0);
  const [prodObs, setProdObs] = useState("");
  const [planByKey, setPlanByKey] = useState<Record<string, Pick<FinancialDailyPlan, "daily_target_brl" | "daily_planning_brl">>>({});

  const q = useCallback(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      team_id: teamId === "" ? undefined : teamId,
    }),
    [dateFrom, dateTo, teamId]
  );

  const reload = useCallback(() => {
    setErr(null);
    return Promise.all([api.financial.panel(projectId, q()), api.financial.listPlans(projectId)]).then(
      ([dash, plans]) => {
        setData(dash);
        const m: Record<string, Pick<FinancialDailyPlan, "daily_target_brl" | "daily_planning_brl">> = {};
        for (const p of plans) {
          m[`${p.day}|${p.team_id}`] = {
            daily_target_brl: p.daily_target_brl,
            daily_planning_brl: p.daily_planning_brl ?? 0,
          };
        }
        setPlanByKey(m);
      }
    );
  }, [projectId, q]);

  useEffect(() => {
    let on = true;
    reload().catch((e) => on && setErr(e instanceof Error ? e.message : "Erro"));
    return () => {
      on = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!data?.teams.length) return;
    if (planTeamId === "") setPlanTeamId(data.teams[0].id);
    if (prodTeamId === "") setProdTeamId(data.teams[0].id);
  }, [data?.teams, planTeamId, prodTeamId]);

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

  async function submitPlanned(e: React.FormEvent) {
    e.preventDefault();
    if (planTeamId === "") {
      setErr("Selecione a equipe.");
      return;
    }
    setBusyPlan(true);
    setErr(null);
    try {
      await api.financial.createPlan(projectId, {
        day: planDay,
        team_id: planTeamId,
        daily_target_brl: planValue,
        daily_planning_brl: planPlanningBrl,
      });
      setPlanValue(0);
      setPlanPlanningBrl(0);
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao salvar planejado");
    } finally {
      setBusyPlan(false);
    }
  }

  async function submitProduced(e: React.FormEvent) {
    e.preventDefault();
    if (prodTeamId === "") {
      setErr("Selecione a equipe que realizou a produção.");
      return;
    }
    setBusyProd(true);
    setErr(null);
    try {
      await api.financial.createProduction(projectId, {
        day: prodDay,
        team_id: prodTeamId,
        produced_value_brl: prodValue,
        observation: prodObs.trim() || null,
      });
      setProdValue(0);
      setProdObs("");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao salvar realizado");
    } finally {
      setBusyProd(false);
    }
  }

  if (err && !data) {
    return <p className="text-signal-bad">{err}</p>;
  }
  if (!data) {
    return <p className="animate-pulse text-slate-500">Carregando painel financeiro…</p>;
  }

  const dev = data.summary.deviation_pct;
  const teams = data.teams;
  const prodPlan = prodTeamId !== "" ? planByKey[`${prodDay}|${prodTeamId}`] : undefined;
  const prodTeam = prodTeamId !== "" ? teams.find((t) => t.id === prodTeamId) : undefined;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-slate-900/40 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Painel Financeiro</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Avanço produtivo: lançamentos separados de <strong className="text-slate-300">meta</strong> e{" "}
          <strong className="text-slate-300">realizado</strong> por dia e por equipe cadastrada; curva acumulada e farol
          diário.
        </p>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      {teams.length === 0 ? (
        <div className="glass rounded-2xl border border-amber-500/20 p-6 text-slate-300">
          <p className="font-medium text-white">Nenhuma equipe cadastrada</p>
          <p className="mt-2 text-sm text-slate-400">
            Cadastre ao menos uma equipe (nome, tipo, UEN, encarregado) antes de lançar planejado ou realizado.
          </p>
          <Link
            to={`/projeto/${projectId}/financeiro/equipes`}
            className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Ir para Equipes
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={submitPlanned} className="glass rounded-2xl border border-slate-500/20 p-5">
            <h2 className="font-display text-lg font-semibold text-slate-200">Planejado (dia)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Meta da equipe, planejamento diário (R$) e depois o produzido no formulário ao lado.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Data</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={planDay}
                  onChange={(e) => setPlanDay(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Equipe</label>
                <select
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={planTeamId === "" ? "" : String(planTeamId)}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : "";
                    setPlanTeamId(id);
                    if (id === "") return;
                    const tm = teams.find((t) => t.id === id);
                    const def = tm?.default_daily_target_brl;
                    if (def != null && Number.isFinite(def) && def > 0) setPlanValue(def);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.team_type ? ` · ${t.team_type}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Meta da equipe (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={planValue}
                  onChange={(e) => setPlanValue(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Planejamento diário (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={planPlanningBrl}
                  onChange={(e) => setPlanPlanningBrl(Number(e.target.value))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busyPlan}
              className="mt-4 rounded-xl bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
            >
              {busyPlan ? "Salvando…" : "Salvar planejado"}
            </button>
          </form>

          <form onSubmit={submitProduced} className="glass rounded-2xl border border-emerald-500/25 p-5">
            <h2 className="font-display text-lg font-semibold text-emerald-200">Realizado do dia</h2>
            <p className="mt-1 text-xs text-slate-500">Valor produzido (R$) pela equipe na data.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Data</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={prodDay}
                  onChange={(e) => setProdDay(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Equipe que produziu</label>
                <select
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={prodTeamId === "" ? "" : String(prodTeamId)}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : "";
                    setProdTeamId(id);
                    if (id === "") return;
                    const tm = teams.find((t) => t.id === id);
                    const def = tm?.default_daily_target_brl;
                    if (def != null && Number.isFinite(def) && def > 0) setProdValue(def);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.team_type ? ` · ${t.team_type}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                <p>
                  <span className="text-slate-500">Meta diária (cadastro da equipe):</span>{" "}
                  {prodTeam?.default_daily_target_brl != null && prodTeam.default_daily_target_brl > 0
                    ? brl(prodTeam.default_daily_target_brl)
                    : "—"}
                </p>
                {prodPlan && (
                  <p className="mt-1">
                    <span className="text-slate-500">Planejado neste dia:</span> meta {brl(prodPlan.daily_target_brl)}
                    {prodPlan.daily_planning_brl > 0 ? ` · planej. ${brl(prodPlan.daily_planning_brl)}` : ""}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-500">Produzido (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={prodValue}
                  onChange={(e) => setProdValue(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-500">Observações</label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white placeholder:text-slate-600"
                  value={prodObs}
                  onChange={(e) => setProdObs(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busyProd}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busyProd ? "Salvando…" : "Salvar realizado"}
            </button>
          </form>
        </div>
      )}

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
            className="min-w-[200px] rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={teamId === "" ? "" : String(teamId)}
            onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Todas</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Meta Total das Equipes</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-200">{brl(data.summary.total_planned_brl)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total produzido</p>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-300">{brl(data.summary.total_produced_brl)}</p>
          <p className="mt-2 text-xs text-slate-500">
            Soma dos valores de <strong className="text-slate-400">realizado do dia</strong> (produzido por equipe) no
            período filtrado.
          </p>
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
        <h2 className="font-display text-xl font-semibold text-white">Evolução diária</h2>
        <p className="mt-1 text-sm text-slate-500">
          Eixo esquerdo (R$): meta total das equipes e valor produzido acumulados. Eixo direito (%): avanço físico da obra
          e avanço produtivo (produzido acumulado ÷ valor total da obra).
        </p>
        <div className="mt-6">
          <FinancialPlannedProducedChart data={data.series} obraTotalBrl={data.obra_total_value_brl} />
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-white">Farol por dia</h2>
          <p className="mt-1 text-sm text-slate-500">
            Planejado do dia: soma do <strong className="text-slate-400">planejamento diário</strong> (R$) das
            equipes que produziram, quando informado; senão usa a <strong className="text-slate-400">meta da equipe</strong>.
            Verde: produzido ≥ planejado · Amarelo: ≥ 85% · Vermelho: abaixo de 85%.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Farol</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Equipes ativas</th>
                <th className="px-6 py-3">Meta Total das Equipes (dia)</th>
                <th className="px-6 py-3">Produzido (dia)</th>
              </tr>
            </thead>
            <tbody>
              {data.farol_days.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Sem dados no período. Use os lançamentos acima ou as abas Planejamento / Produtividade.
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
