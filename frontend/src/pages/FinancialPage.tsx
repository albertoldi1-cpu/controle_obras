import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Banknote, Plus, Trash2, TrendingUp, Users } from "lucide-react";
import { api } from "../api";
import type { FinancialDashboard, FinancialEntry } from "../types";
import FinancialCurveChart from "../components/FinancialCurveChart";

type Ctx = { projectId: number };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const emptyForm = () => ({
  exec_date: new Date().toISOString().slice(0, 10),
  team_type: "",
  segment: "",
  uen: "",
  obra_code: "",
  labor_code: "",
  description: "",
  quantity: 0,
  ups: 0,
  ups_brl: 0,
  value_brl: 0,
  ep_note: "",
});

export default function FinancialPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [dash, setDash] = useState<FinancialDashboard | null>(null);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    const [d, list] = await Promise.all([
      api.financial.dashboard(projectId),
      api.financial.list(projectId),
    ]);
    setDash(d);
    setEntries(list);
  }

  useEffect(() => {
    let on = true;
    load().catch((e) => on && setErr(e instanceof Error ? e.message : "Erro"));
    return () => {
      on = false;
    };
  }, [projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.financial.create(projectId, {
        ...form,
        ep_note: form.ep_note.trim() || null,
      });
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: number) {
    if (!confirm("Excluir este lançamento?")) return;
    await api.financial.delete(projectId, id);
    await load();
  }

  if (err && !dash) {
    return <p className="text-signal-bad">{err}</p>;
  }
  if (!dash) {
    return <p className="animate-pulse text-slate-500">Carregando financeiro…</p>;
  }

  const { summary, series, by_team } = dash;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-amber-500/[0.06] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Avanço produtivo</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">Acompanhamento financeiro</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Mesma lógica da aba <strong className="text-slate-300">AVANÇO PRODUTIVO</strong> da planilha: equipe, UPS,
              mão de obra e valor (R$) — com curva acumulada e leitura executiva.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500"
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-signal-bad">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Custo acumulado</p>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-300">{brl(summary.total_value_brl)}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.entry_count} lançamentos</p>
        </div>
        <div className="glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Média por lançamento</p>
          <p className="mt-2 font-display text-2xl font-bold text-amber-200">{brl(summary.avg_value_per_entry)}</p>
        </div>
        <div className="glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">UPS total</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{summary.total_ups.toLocaleString("pt-BR")}</p>
        </div>
        <div className="glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Última execução</p>
          <p className="mt-2 font-display text-xl font-bold text-slate-200">
            {summary.last_exec_date
              ? new Date(summary.last_exec_date + "T12:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="glass rounded-2xl border border-emerald-500/15 p-6 shadow-xl shadow-black/20"
        >
          <h3 className="mb-4 font-display text-lg font-semibold text-white">Novo lançamento (planilha)</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Data da execução</label>
              <input
                type="date"
                required
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.exec_date}
                onChange={(e) => setForm((f) => ({ ...f, exec_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tipo de equipe</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.team_type}
                onChange={(e) => setForm((f) => ({ ...f, team_type: e.target.value }))}
                placeholder="ex. Linha Morta"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Segmento / UEN</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.segment}
                onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                placeholder="ESCAV"
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
            <div>
              <label className="mb-1 block text-xs text-slate-500">Obra (código)</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.obra_code}
                onChange={(e) => setForm((f) => ({ ...f, obra_code: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Cod. mão de obra</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.labor_code}
                onChange={(e) => setForm((f) => ({ ...f, labor_code: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs text-slate-500">Descrição</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Qtd</label>
              <input
                type="number"
                step="any"
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">UPS</label>
              <input
                type="number"
                step="any"
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.ups}
                onChange={(e) => setForm((f) => ({ ...f, ups: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">R$ UPS</label>
              <input
                type="number"
                step="any"
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.ups_brl}
                onChange={(e) => setForm((f) => ({ ...f, ups_brl: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Valor (R$)</label>
              <input
                type="number"
                step="any"
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.value_brl}
                onChange={(e) => setForm((f) => ({ ...f, value_brl: Number(e.target.value) }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">EP / obs.</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                value={form.ep_note}
                onChange={(e) => setForm((f) => ({ ...f, ep_note: e.target.value }))}
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
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-white/15 px-6 py-2 text-slate-400 hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <section className="glass overflow-hidden rounded-2xl border border-white/5">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h2 className="font-display text-xl font-semibold text-white">Curva de custo acumulado</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Barras: valor do dia · Linha: total acumulado (R$)</p>
        </div>
        <div className="p-4 md:p-6">
          <FinancialCurveChart data={series} />
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl border border-white/5">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-xl font-semibold text-white">Por tipo de equipe</h2>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-3">
          {by_team.length === 0 ? (
            <p className="col-span-full py-8 text-center text-slate-500">Sem dados agrupados.</p>
          ) : (
            by_team.map((row) => (
              <div
                key={row.team_type}
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent px-4 py-3"
              >
                <p className="text-sm font-medium text-white">{row.team_type || "—"}</p>
                <p className="mt-1 font-display text-lg text-emerald-300">{brl(row.total_brl)}</p>
                <p className="text-xs text-slate-500">{row.pct_of_total.toFixed(1)}% do total</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl border border-white/5">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-slate-400" />
            <h2 className="font-display text-xl font-semibold text-white">Lançamentos</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Equipe</th>
                <th className="px-4 py-3">Segm.</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">UPS</th>
                <th className="px-4 py-3">R$ UPS</th>
                <th className="px-4 py-3">Valor</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Nenhum lançamento. Use «Novo lançamento» para espelhar a planilha.
                  </td>
                </tr>
              ) : (
                entries.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {new Date(r.exec_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.team_type}</td>
                    <td className="px-4 py-3 text-slate-500">{r.segment}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-white">{r.description}</td>
                    <td className="px-4 py-3 text-slate-400">{r.quantity}</td>
                    <td className="px-4 py-3 text-slate-400">{r.ups}</td>
                    <td className="px-4 py-3 text-slate-400">{brl(r.ups_brl)}</td>
                    <td className="px-4 py-3 font-medium text-emerald-300">{brl(r.value_brl)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
