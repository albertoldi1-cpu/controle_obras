import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import type { FinancialTeam } from "../types";

type Ctx = { projectId: number };

const emptyForm = () => ({
  name: "",
  team_type: "",
  uen: "",
  encarregado: "",
});

export default function FinancialTeamsPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [rows, setRows] = useState<FinancialTeam[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    setErr(null);
    return api.financial.listTeams(projectId).then(setRows);
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

  function startEdit(t: FinancialTeam) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      team_type: t.team_type,
      uen: t.uen,
      encarregado: t.encarregado,
    });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: form.name.trim(),
        team_type: form.team_type.trim(),
        uen: form.uen.trim(),
        encarregado: form.encarregado.trim(),
      };
      if (editingId !== null) {
        await api.financial.updateTeam(projectId, editingId, body);
      } else {
        await api.financial.createTeam(projectId, body);
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
    if (!confirm("Excluir esta equipe? Planejamentos e produção vinculados serão removidos.")) return;
    setErr(null);
    try {
      await api.financial.deleteTeam(projectId, id);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Equipes</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Cadastro de equipes: nome, tipo de equipe, UEN e encarregado. Os lançamentos de planejado e realizado referenciam
          estas equipes.
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
          {showForm && editingId === null ? "Fechar formulário" : "Nova equipe"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="glass rounded-2xl border border-emerald-500/15 p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">
            {editingId !== null ? "Editar equipe" : "Nova equipe"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Nome da equipe</label>
              <input
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex. Equipe A — Linha morta"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tipo de equipe</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.team_type}
                onChange={(e) => setForm((f) => ({ ...f, team_type: e.target.value }))}
                placeholder="ex. Linha morta"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">UEN</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.uen}
                onChange={(e) => setForm((f) => ({ ...f, uen: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Encarregado</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.encarregado}
                onChange={(e) => setForm((f) => ({ ...f, encarregado: e.target.value }))}
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
          <h2 className="font-display text-xl font-semibold text-white">Cadastro</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">UEN</th>
                <th className="px-6 py-3">Encarregado</th>
                <th className="w-28 px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma equipe. Use «Nova equipe».
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-3 font-medium text-white">{t.name}</td>
                    <td className="px-6 py-3 text-slate-400">{t.team_type || "—"}</td>
                    <td className="px-6 py-3 text-slate-400">{t.uen || "—"}</td>
                    <td className="px-6 py-3 text-slate-400">{t.encarregado || "—"}</td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(t.id)}
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
