import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import type { FinancialDailyPlan } from "../types";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const emptyForm = () => ({
  day: new Date().toISOString().slice(0, 10),
  team_type: "",
  teams_count: 1,
  daily_target_brl: 0,
});

export default function FinancialPlanningPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [rows, setRows] = useState<FinancialDailyPlan[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    setErr(null);
    return api.financial.listPlans(projectId).then(setRows);
  }, [projectId]);

  useEffect(() => {
    let on = true;
    load().catch((e) => on && setErr(e instanceof Error ? e.message : "Erro"));
    return () => {
      on = false;
    };
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function startEdit(p: FinancialDailyPlan) {
    setEditingId(p.id);
    setForm({
      day: p.day,
      team_type: p.team_type,
      teams_count: p.teams_count,
      daily_target_brl: p.daily_target_brl,
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
        team_type: form.team_type.trim(),
        teams_count: form.teams_count,
        daily_target_brl: form.daily_target_brl,
      };
      if (editingId !== null) {
        await api.financial.updatePlan(projectId, editingId, body);
      } else {
        await api.financial.createPlan(projectId, body);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
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

  const sorted = [...rows].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.team_type.localeCompare(b.team_type)));

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Planejamento (meta diária)</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Por dia e tipo de equipe: quantidade de equipes no dia, tipo de equipe e valor da meta diária (R$ planejado).
        </p>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : startCreate())}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
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
              <label className="mb-1 block text-xs text-slate-500">Tipo de equipe</label>
              <input
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.team_type}
                onChange={(e) => setForm((f) => ({ ...f, team_type: e.target.value }))}
                placeholder="ex. Linha morta"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Qtd. equipes no dia</label>
              <input
                type="number"
                min={1}
                step={1}
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.teams_count}
                onChange={(e) => setForm((f) => ({ ...f, teams_count: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Meta diária (R$)</label>
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
          <p className="mt-1 text-sm text-slate-500">Chave única: dia + tipo de equipe.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Dia</th>
                <th className="px-6 py-3">Tipo de equipe</th>
                <th className="px-6 py-3">Equipes</th>
                <th className="px-6 py-3">Meta diária</th>
                <th className="w-28 px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Nenhum planejamento. Use «Novo planejamento».
                  </td>
                </tr>
              ) : (
                sorted.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-6 py-3 text-slate-300">
                      {new Date(p.day + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-3 text-white">{p.team_type || "—"}</td>
                    <td className="px-6 py-3 text-slate-400">{p.teams_count}</td>
                    <td className="px-6 py-3 font-medium text-emerald-300">{brl(p.daily_target_brl)}</td>
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
