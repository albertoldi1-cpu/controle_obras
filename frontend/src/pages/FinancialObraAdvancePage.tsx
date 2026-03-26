import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import type { BillingForecastEntry, BillingForecastScenario, ObraFinancialAdvance } from "../types";
import ObraFinancialAdvanceChart from "../components/ObraFinancialAdvanceChart";

type Ctx = { projectId: number };

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function scenarioLabel(s: BillingForecastScenario) {
  return s === "optimistic" ? "Otimista" : "Pessimista";
}

function defaultDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FinancialObraAdvancePage() {
  const { projectId } = useOutletContext<Ctx>();
  const [adv, setAdv] = useState<ObraFinancialAdvance | null>(null);
  const [rows, setRows] = useState<BillingForecastEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [day, setDay] = useState(defaultDay);
  const [amount, setAmount] = useState("");
  const [scenario, setScenario] = useState<BillingForecastScenario>("optimistic");

  const loadAll = useCallback(() => {
    setErr(null);
    return Promise.all([
      api.financial.obraAdvance(projectId),
      api.financial.listBillingForecasts(projectId),
    ]).then(
      ([a, r]) => {
        setAdv(a);
        setRows(r);
      },
      (e) => setErr(e instanceof Error ? e.message : "Erro ao carregar")
    );
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function resetForm() {
    setEditingId(null);
    setDay(defaultDay());
    setAmount("");
    setScenario("optimistic");
    setFormErr(null);
  }

  function startEdit(entry: BillingForecastEntry) {
    setEditingId(entry.id);
    setDay(entry.day);
    setAmount(String(entry.amount_brl));
    setScenario(entry.scenario);
    setFormErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const val = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(val) || val < 0) {
      setFormErr("Informe um valor planejado válido (≥ 0).");
      return;
    }
    setBusy(true);
    try {
      if (editingId != null) {
        await api.financial.updateBillingForecast(projectId, editingId, {
          day,
          scenario,
          amount_brl: val,
        });
      } else {
        await api.financial.createBillingForecast(projectId, { day, scenario, amount_brl: val });
      }
      resetForm();
      await loadAll();
    } catch (ex) {
      setFormErr(ex instanceof Error ? ex.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Excluir este lançamento de previsão?")) return;
    setBusy(true);
    try {
      await api.financial.deleteBillingForecast(projectId, id);
      if (editingId === id) resetForm();
      await loadAll();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  if (err && !adv) {
    return <p className="text-signal-bad">{err}</p>;
  }
  if (!adv) {
    return <p className="animate-pulse text-slate-500">Carregando avanço financeiro…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-transparent to-slate-900/40 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Avanço financeiro</h1>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold text-white">Curva</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Valor total da obra</p>
            <p className="mt-2 font-display text-2xl font-bold text-white">
              {adv.obra_total_value_brl != null ? brl(adv.obra_total_value_brl) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Valor total produzido</p>
            <p className="mt-2 font-display text-2xl font-bold text-accent-glow">{brl(adv.total_produced_brl || 0)}</p>
          </div>
        </div>
        <div className="mt-4">
          <ObraFinancialAdvanceChart data={adv.series} />
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold text-white">Previsão Financeira</h2>
        <p className="mt-1 text-sm text-slate-500">
          Lançamentos manuais: cada registro alimenta a curva (valores diários em R$ por cenário).
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Data do faturamento planejado</label>
              <input
                type="date"
                required
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Valor planejado (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Cenário</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as BillingForecastScenario)}
                className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-sm text-white"
              >
                <option value="optimistic">Otimista</option>
                <option value="pessimistic">Pessimista</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-lift disabled:opacity-50"
              >
                {editingId != null ? "Salvar alterações" : "Incluir lançamento"}
              </button>
              {editingId != null ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={resetForm}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </div>
          {formErr ? <p className="text-sm text-signal-bad">{formErr}</p> : null}
        </form>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Cenário</th>
                <th className="px-3 py-3">Valor (R$)</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    Nenhum lançamento cadastrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 text-slate-300">
                    <td className="px-3 py-3 text-white">
                      {new Date(r.day + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-3">{scenarioLabel(r.scenario)}</td>
                    <td className="px-3 py-3">
                      {r.amount_brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(r)}
                        className="mr-2 inline-flex items-center gap-1 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDelete(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-300"
                        title="Excluir"
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
