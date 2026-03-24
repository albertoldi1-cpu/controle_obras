import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import type { FinancialDailyPlan, FinancialTeam } from "../types";
import CsvImportBlock from "../components/CsvImportBlock";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const emptyForm = (teamId: number) => ({
  day: new Date().toISOString().slice(0, 10),
  team_id: teamId,
  daily_target_brl: 0,
  daily_planning_brl: 0,
});

export default function FinancialPlanningPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [teams, setTeams] = useState<FinancialTeam[]>([]);
  const [rows, setRows] = useState<FinancialDailyPlan[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(() => emptyForm(0));

  const load = useCallback(() => {
    setErr(null);
    return Promise.all([api.financial.listTeams(projectId), api.financial.listPlans(projectId)]).then(([t, p]) => {
      setTeams(t);
      setRows(p);
    });
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

  function startEdit(p: FinancialDailyPlan) {
    setEditingId(p.id);
    setForm({
      day: p.day,
      team_id: p.team_id,
      daily_target_brl: p.daily_target_brl,
      daily_planning_brl: p.daily_planning_brl ?? 0,
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
        daily_target_brl: form.daily_target_brl,
        daily_planning_brl: form.daily_planning_brl,
      };
      if (editingId !== null) {
        await api.financial.updatePlan(projectId, editingId, body);
      } else {
        await api.financial.createPlan(projectId, body);
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
    if (!confirm("Excluir este planejamento?")) return;
    setErr(null);
    try {
      await api.financial.deletePlan(projectId, id);
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
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Planejamento (por equipe)</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Meta diária em R$ por data e por equipe cadastrada — separado dos lançamentos de produção
          realizada.
        </p>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-1">
        <CsvImportBlock
          title="Importar planejamento (CSV)"
          description="Arquivo .csv codificado em UTF-8. A primeira linha é o cabeçalho; os dados começam na linha 2."
          modelLines={[
            "Linha 1 (cabeçalho): day,team_id,daily_target_brl,daily_planning_brl",
            "Linhas 2+: 2025-03-20,1,5000,5200",
            "daily_planning_brl pode ficar vazio ou 0. Dia: AAAA-MM-DD ou DD/MM/AAAA.",
            "team_id: id numérico da equipe (aba Equipes). Atualiza registro se já existir dia+equipe.",
          ]}
          onImport={async (file) => {
            const r = await api.financial.importCsv(projectId, "plans", file);
            await load();
            return r;
          }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : startCreate())}
          disabled={!teams.length}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {showForm && editingId === null ? "Fechar formulário" : "Novo planejamento"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="glass rounded-2xl border border-emerald-500/15 p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">
            {editingId !== null ? "Editar planejamento" : "Novo planejamento"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <label className="mb-1 block text-xs text-slate-500">Equipe</label>
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
                    daily_target_brl:
                      def != null && Number.isFinite(def) && def > 0 ? def : f.daily_target_brl,
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
            <div>
              <label className="mb-1 block text-xs text-slate-500">Meta da equipe (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.daily_target_brl}
                onChange={(e) => setForm((f) => ({ ...f, daily_target_brl: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Planejamento diário (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.daily_planning_brl}
                onChange={(e) => setForm((f) => ({ ...f, daily_planning_brl: Number(e.target.value) }))}
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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Dia</th>
                <th className="px-6 py-3">Equipe</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Meta equipe</th>
                <th className="px-6 py-3">Planej. diário</th>
                <th className="w-28 px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Nenhum planejamento. Use «Novo planejamento» ou o painel.
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
                    <td className="px-6 py-3 font-medium text-slate-200">{brl(p.daily_target_brl)}</td>
                    <td className="px-6 py-3 text-slate-300">{brl(p.daily_planning_brl ?? 0)}</td>
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
