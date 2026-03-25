import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Save } from "lucide-react";
import { api } from "../api";
import { requestDashboardRefresh } from "../lib/dashboardEvents";
import type { Stage } from "../types";
import SpreadsheetImportBlock from "../components/SpreadsheetImportBlock";

type Ctx = { projectId: number };

function enumerateDays(fromStr: string, toStr: string): string[] {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  const res: string[] = [];
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    res.push(`${y}-${m}-${day}`);
  }
  return res;
}

function defaultRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(start), to: fmt(end) };
}

type Cell = { opt: string; pes: string; ex: string; note: string };

export default function EntriesPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [stages, setStages] = useState<Stage[]>([]);
  const [{ from, to }, setRange] = useState(defaultRange);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [stageFilter, setStageFilter] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingEx, setSavingEx] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const days = useMemo(() => enumerateDays(from, to), [from, to]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const list = await api.stages.list(projectId);
      setStages(list);
      const entriesLists = await Promise.all(list.map((s) => api.stages.entries(s.id)));
      const next: Record<string, Cell> = {};
      list.forEach((st, i) => {
        for (const e of entriesLists[i]) {
          const key = `${st.id}|${e.day}`;
          next[key] = {
            opt: String(e.planned_optimistic),
            pes: String(e.planned_pessimistic),
            ex: String(e.executed),
            note: e.execution_note ?? "",
          };
        }
      });
      setCells(next);
    } catch {
      setMsg("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function getCell(stageId: number, day: string): Cell {
    return cells[`${stageId}|${day}`] ?? { opt: "0", pes: "0", ex: "0", note: "" };
  }

  function setPlan(stageId: number, day: string, field: "opt" | "pes", value: string) {
    const key = `${stageId}|${day}`;
    setCells((prev) => ({
      ...prev,
      [key]: {
        opt: field === "opt" ? value : prev[key]?.opt ?? "0",
        pes: field === "pes" ? value : prev[key]?.pes ?? "0",
        ex: prev[key]?.ex ?? "0",
        note: prev[key]?.note ?? "",
      },
    }));
  }

  function setExec(stageId: number, day: string, field: "ex" | "note", value: string) {
    const key = `${stageId}|${day}`;
    setCells((prev) => ({
      ...prev,
      [key]: {
        opt: prev[key]?.opt ?? "0",
        pes: prev[key]?.pes ?? "0",
        ex: field === "ex" ? value : prev[key]?.ex ?? "0",
        note: field === "note" ? value : prev[key]?.note ?? "",
      },
    }));
  }

  async function savePlanned() {
    setSavingPlan(true);
    setMsg(null);
    try {
      const entries: Array<{
        stage_id: number;
        day: string;
        planned_optimistic: number;
        planned_pessimistic: number;
      }> = [];
      for (const st of stages) {
        for (const day of days) {
          const c = getCell(st.id, day);
          entries.push({
            stage_id: st.id,
            day,
            planned_optimistic: parseFloat(c.opt.replace(",", ".")) || 0,
            planned_pessimistic: parseFloat(c.pes.replace(",", ".")) || 0,
          });
        }
      }
      const r = await api.bulkPlanned(projectId, entries);
      setMsg(`Planejamento salvo (${r.upserted} células).`);
      requestDashboardRefresh(projectId);
      await loadAll();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar planejamento");
    } finally {
      setSavingPlan(false);
    }
  }

  async function saveExecuted() {
    setSavingEx(true);
    setMsg(null);
    try {
      const entries: Array<{
        stage_id: number;
        day: string;
        executed: number;
        execution_note: string | null;
      }> = [];
      for (const st of stages) {
        for (const day of days) {
          const c = getCell(st.id, day);
          const note = c.note.trim() || null;
          entries.push({
            stage_id: st.id,
            day,
            executed: parseFloat(c.ex.replace(",", ".")) || 0,
            execution_note: note,
          });
        }
      }
      const r = await api.bulkExecuted(projectId, entries);
      setMsg(`Execução salva (${r.upserted} células).`);
      requestDashboardRefresh(projectId);
      await loadAll();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar execução");
    } finally {
      setSavingEx(false);
    }
  }

  const visibleStages = stageFilter === "all" ? stages : stages.filter((s) => s.id === stageFilter);

  if (loading) {
    return <p className="text-slate-500">Carregando lançamentos…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-1 block text-xs text-slate-500">De</label>
          <input
            type="date"
            className="rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Até</label>
          <input
            type="date"
            className="rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-slate-500">Filtrar etapa</label>
          <select
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
            value={stageFilter === "all" ? "all" : String(stageFilter)}
            onChange={(e) => setStageFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Todas</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => loadAll()}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          Recarregar período
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpreadsheetImportBlock
          title="Importar planejado (otimista / pessimista)"
          specLines={[
            "Arquivo Excel (.xlsx recomendado, ou .xls). O sistema lê somente a primeira aba da planilha.",
            "Linha 1 = cabeçalho fixo, colunas A a D com estes títulos exatos: stage_id | day | planned_optimistic | planned_pessimistic",
            "A partir da linha 2: uma linha por combinação etapa + dia. stage_id = número inteiro da etapa (confira na aba Etapas deste projeto).",
            `Etapas deste projeto: ${stages.map((s) => `id ${s.id} = ${s.name}`).join(" · ") || "cadastre etapas antes."}`,
            "day: data em texto AAAA-MM-DD ou DD/MM/AAAA (ou célula formatada como data no Excel). planned_optimistic e planned_pessimistic: quantidades numéricas (decimais com vírgula ou ponto).",
            "Comportamento: se já existir registro para a mesma etapa e data, os valores otimista e pessimista são atualizados; caso contrário, é criado um novo lançamento com executado zerado.",
          ]}
          onImport={async (file) => {
            const r = await api.importEntriesSpreadsheet(projectId, "planned", file);
            await loadAll();
            return r;
          }}
        />
        <SpreadsheetImportBlock
          title="Importar executado (produção física no dia)"
          specLines={[
            "Arquivo Excel (.xlsx ou .xls), primeira aba apenas.",
            "Linha 1 = cabeçalho: colunas A a D — stage_id | day | executed | execution_note (a coluna D é opcional).",
            "Linhas 2 em diante: stage_id (inteiro), day (data como acima), executed (quantidade realizada no dia), execution_note (texto livre; pode ficar vazio).",
            `Etapas: ${stages.map((s) => `id ${s.id} = ${s.name}`).join(" · ") || "—"}`,
            "Atualiza o executado (e observação, se informada) quando já existir etapa+dia; senão cria lançamento com planejado otimista/pessimista em zero.",
          ]}
          onImport={async (file) => {
            const r = await api.importEntriesSpreadsheet(projectId, "executed", file);
            await loadAll();
            return r;
          }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={savePlanned}
          disabled={savingPlan || stages.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-2.5 font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {savingPlan ? "Salvando…" : "Salvar planejamento (otimista / pessimista)"}
        </button>
        <button
          type="button"
          onClick={saveExecuted}
          disabled={savingEx || stages.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-semibold text-white shadow-lift disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {savingEx ? "Salvando…" : "Salvar execução e observações"}
        </button>
      </div>

      {msg && (
        <p className={`text-sm ${msg.startsWith("Erro") ? "text-signal-bad" : "text-signal-ok"}`}>{msg}</p>
      )}

      {stages.length === 0 ? (
        <p className="text-slate-500">Cadastre etapas antes de lançar quantidades diárias.</p>
      ) : (
        <div className="space-y-12">
          {visibleStages.map((st) => (
            <div key={st.id} className="space-y-6">
              <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2">
                <h3 className="font-display text-lg font-semibold text-white">{st.name}</h3>
                <p className="text-xs text-slate-500">
                  Total {st.total_quantity} {st.unit ?? ""} · peso {(st.weight * 100).toFixed(1)}% (ambos cenários)
                </p>
              </div>

              <div className="glass overflow-hidden rounded-2xl border border-emerald-500/20">
                <div className="border-b border-white/10 bg-emerald-500/10 px-4 py-2">
                  <h4 className="text-sm font-semibold text-emerald-200">Janela 1 — Planejamento diário</h4>
                  <p className="text-xs text-slate-500">Quantidades previstas por dia (otimista e pessimista).</p>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="sticky top-0 z-10 bg-ink-900/95 text-xs uppercase text-slate-500 backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2">Otimista (dia)</th>
                        <th className="px-3 py-2">Pessimista (dia)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => {
                        const c = getCell(st.id, day);
                        const br = new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        });
                        return (
                          <tr key={`p-${day}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{br}</td>
                            <td className="px-2 py-1">
                              <input
                                className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-center text-emerald-200"
                                value={c.opt}
                                onChange={(e) => setPlan(st.id, day, "opt", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-center text-slate-300"
                                value={c.pes}
                                onChange={(e) => setPlan(st.id, day, "pes", e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass overflow-hidden rounded-2xl border border-accent/25">
                <div className="border-b border-white/10 bg-accent/10 px-4 py-2">
                  <h4 className="text-sm font-semibold text-accent-glow">Janela 2 — Executado no dia</h4>
                  <p className="text-xs text-slate-500">
                    Produção realizada e observações sobre impedimentos em relação ao programado.
                  </p>
                </div>
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="sticky top-0 z-10 bg-ink-900/95 text-xs uppercase text-slate-500 backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2">Executado (dia)</th>
                        <th className="px-3 py-2 text-left">Observação / problemas do dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => {
                        const c = getCell(st.id, day);
                        const br = new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        });
                        return (
                          <tr key={`e-${day}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{br}</td>
                            <td className="px-2 py-1 align-top">
                              <input
                                className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-center text-accent-glow"
                                value={c.ex}
                                onChange={(e) => setExec(st.id, day, "ex", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1 align-top">
                              <textarea
                                rows={2}
                                className="w-full resize-y rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600"
                                placeholder="Chuva, falta de material, equipe…"
                                value={c.note}
                                onChange={(e) => setExec(st.id, day, "note", e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
