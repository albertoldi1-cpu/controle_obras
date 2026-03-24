import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import type { FinancialDailyProduction, FinancialTeam } from "../types";
import SpreadsheetImportBlock from "../components/SpreadsheetImportBlock";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const emptyForm = (teamId: number) => ({
  day: new Date().toISOString().slice(0, 10),
  team_id: teamId,
  produced_value_brl: 0,
  observation: "",
});

export default function FinancialProductivityPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [teams, setTeams] = useState<FinancialTeam[]>([]);
  const [rows, setRows] = useState<FinancialDailyProduction[]>([]);
  const [planDetail, setPlanDetail] = useState<
    Record<string, { target: number; planning: number }>
  >({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(() => emptyForm(0));

  const load = useCallback(() => {
    setErr(null);
    return Promise.all([
      api.financial.listTeams(projectId),
      api.financial.listProduction(projectId),
      api.financial.listPlans(projectId),
    ]).then(([t, r, plans]) => {
        setTeams(t);
        setRows(r);
        const idx: Record<string, { target: number; planning: number }> = {};
        for (const p of plans)
          idx[`${p.day}|${p.team_id}`] = {
            target: p.daily_target_brl,
            planning: p.daily_planning_brl ?? 0,
          };
        setPlanDetail(idx);
      }
    );
  }, [projectId]);

  useEffect(() => {
    let on = true;
    load().catch((e) => on && setErr(e instanceof Error ? e.message : "Erro"));
    return () => {
      on = false;
    };
  }, [load]);

  function startCreate() {
    if (!teams.length) {
      setErr("Cadastre ao menos uma equipe na aba Equipes.");
      return;
    }
    setEditingId(null);
    setForm(emptyForm(teams[0].id));
    setShowForm(true);
  }

  function startEdit(p: FinancialDailyProduction) {
    setEditingId(p.id);
    setForm({
      day: p.day,
      team_id: p.team_id,
      produced_value_brl: p.produced_value_brl,
      observation: p.observation ?? "",
    });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = {
        day: form.day,
        team_id: form.team_id,
        produced_value_brl: form.produced_value_brl,
        observation: form.observation.trim() || null,
      };
      if (editingId !== null) {
        await api.financial.updateProduction(projectId, editingId, body);
      } else {
        await api.financial.createProduction(projectId, body);
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: number) {
    if (!confirm("Excluir este lançamento?")) return;
    setErr(null);
    try {
      await api.financial.deleteProduction(projectId, id);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao excluir");
    }
  }

  const sorted = [...rows].sort((a, b) =>
    a.day < b.day ? 1 : a.day > b.day ? -1 : a.team.name.localeCompare(b.team.name)
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Lançamentos de produtividade</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Valor produzido (R$) por dia e por equipe que realizou a produção — separado do planejamento diário.
        </p>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      <SpreadsheetImportBlock
        title="Importar produção realizada (valor R$ por equipe e dia)"
        specLines={[
          "Excel .xlsx ou .xls; somente a primeira aba.",
          "Linha 1 — cabeçalho: day | team_id | produced_value_brl | observation (coluna D opcional).",
          "Linhas seguintes: data do dia; team_id da equipe que produziu; produced_value_brl (valor realizado em reais); observation (texto, opcional).",
          "Valores em R$ devem ser numéricos. Chave única: projeto + data + equipe — linha existente é atualizada; nova combinação gera novo lançamento.",
        ]}
        onImport={async (file) => {
          const r = await api.financial.importSpreadsheet(projectId, "production", file);
          await load();
          return r;
        }}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : startCreate())}
          disabled={!teams.length}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {showForm && editingId === null ? "Fechar formulário" : "Novo lançamento"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="glass rounded-2xl border border-emerald-500/15 p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">
            {editingId !== null ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Dia</label>
              <input
                type="date"
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.day}
                onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Equipe que produziu</label>
              <select
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={String(form.team_id)}
                onChange={(e) => {
                  const tid = Number(e.target.value);
                  const tm = teams.find((t) => t.id === tid);
                  const def = tm?.default_daily_target_brl;
                  setForm((f) => ({
                    ...f,
                    team_id: tid,
                    produced_value_brl:
                      editingId === null &&
                      def != null &&
                      Number.isFinite(def) &&
                      def > 0
                        ? def
                        : f.produced_value_brl,
                  }));
                }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              {(() => {
                const tm = teams.find((t) => t.id === form.team_id);
                const pl = planDetail[`${form.day}|${form.team_id}`];
                return (
                  <>
                    <p>
                      Meta diária (cadastro):{" "}
                      {tm?.default_daily_target_brl != null && tm.default_daily_target_brl > 0
                        ? brl(tm.default_daily_target_brl)
                        : "—"}
                    </p>
                    {pl && (
                      <p className="mt-1">
                        Planejado neste dia: meta {brl(pl.target)}
                        {pl.planning > 0 ? ` · planej. ${brl(pl.planning)}` : ""}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Valor produzido (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.produced_value_brl}
                onChange={(e) => setForm((f) => ({ ...f, produced_value_brl: Number(e.target.value) }))}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs text-slate-500">Observações</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white placeholder:text-slate-600"
                value={form.observation}
                onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-xl border border-white/15 px-6 py-2 text-slate-400 hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-white">Registros</h2>
          <p className="mt-1 text-sm text-slate-500">Chave única: dia + equipe.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Dia</th>
                <th className="px-6 py-3">Equipe</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Meta equipe</th>
                <th className="px-6 py-3">Planej. diário</th>
                <th className="px-6 py-3">Produzido</th>
                <th className="px-6 py-3">Obs.</th>
                <th className="w-28 px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    Nenhum lançamento. Use «Novo lançamento» ou o painel.
                  </td>
                </tr>
              ) : (
                sorted.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-6 py-3 text-slate-300">
                      {new Date(p.day + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-3 text-white">{p.team.name}</td>
                    <td className="px-6 py-3 text-slate-400">{p.team.team_type || "—"}</td>
                    <td className="px-6 py-3 text-slate-300">
                      {brl(planDetail[`${p.day}|${p.team_id}`]?.target ?? 0)}
                    </td>
                    <td className="px-6 py-3 text-slate-400">
                      {brl(planDetail[`${p.day}|${p.team_id}`]?.planning ?? 0)}
                    </td>
                    <td className="px-6 py-3 font-medium text-emerald-300">{brl(p.produced_value_brl)}</td>
                    <td className="max-w-xs px-6 py-3 text-slate-400">
                      {p.observation ? <span className="line-clamp-2">{p.observation}</span> : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(p.id)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
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
