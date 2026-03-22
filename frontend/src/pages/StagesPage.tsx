import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { api } from "../api";
import type { Stage } from "../types";

type Ctx = { projectId: number };

export default function StagesPage() {
  const { projectId } = useOutletContext<Ctx>();
  const [stages, setStages] = useState<Stage[]>([]);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("0.1");
  const [total, setTotal] = useState("100");
  const [unit, setUnit] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Stage | null>(null);
  const [en, setEn] = useState("");
  const [ew, setEw] = useState("");
  const [et, setEt] = useState("");
  const [eu, setEu] = useState("");

  async function load() {
    const list = await api.stages.list(projectId);
    setStages(list);
  }

  useEffect(() => {
    load().catch(() => setErr("Falha ao carregar etapas"));
  }, [projectId]);

  useEffect(() => {
    if (edit) {
      setEn(edit.name);
      setEw(String(edit.weight));
      setEt(String(edit.total_quantity));
      setEu(edit.unit ?? "");
    }
  }, [edit]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const w = parseFloat(weight.replace(",", "."));
    const q = parseFloat(total.replace(",", "."));
    if (!name.trim() || !(w >= 0 && w <= 1) || !(q > 0)) {
      setErr("Preencha nome, peso entre 0 e 1 e quantidade total maior que zero.");
      return;
    }
    try {
      await api.stages.create(projectId, {
        name: name.trim(),
        weight: w,
        total_quantity: q,
        unit: unit.trim() || null,
        sort_order: stages.length,
      });
      setName("");
      setUnit("");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao criar etapa");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const w = parseFloat(ew.replace(",", "."));
    const q = parseFloat(et.replace(",", "."));
    if (!en.trim() || !(w >= 0 && w <= 1) || !(q > 0)) {
      setModalErr("Dados de edição inválidos.");
      return;
    }
    setModalErr(null);
    try {
      await api.stages.update(edit.id, {
        name: en.trim(),
        weight: w,
        total_quantity: q,
        unit: eu.trim() || null,
      });
      setEdit(null);
      await load();
    } catch (ex) {
      setModalErr(ex instanceof Error ? ex.message : "Erro ao salvar");
    }
  }

  async function del(id: number) {
    if (!confirm("Excluir esta etapa e todos os lançamentos?")) return;
    await api.stages.delete(id);
    await load();
  }

  const sumW = stages.reduce((a, s) => a + s.weight, 0);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        O <strong className="text-slate-300">peso</strong> da etapa vale para{" "}
        <strong className="text-white">ambos os cenários</strong> (otimista e pessimista); o que muda é só a
        quantidade planejada por dia em cada cenário.
        <span className="ml-2 rounded-md bg-white/5 px-2 py-0.5 text-xs">
          Soma dos pesos: {(sumW * 100).toFixed(1)}%
        </span>
      </p>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass relative w-full max-w-md rounded-2xl p-6">
            <button
              type="button"
              className="absolute right-4 top-4 text-slate-500 hover:text-white"
              onClick={() => {
                setModalErr(null);
                setEdit(null);
              }}
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-semibold text-white">Editar etapa</h3>
            <form onSubmit={saveEdit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Nome</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={en}
                  onChange={(e) => setEn(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Peso (0–1)</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={ew}
                  onChange={(e) => setEw(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Qtd. total</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={et}
                  onChange={(e) => setEt(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Unidade</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
                  value={eu}
                  onChange={(e) => setEu(e.target.value)}
                />
              </div>
              {modalErr && <p className="text-sm text-signal-bad">{modalErr}</p>}
              <button type="submit" className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white">
                Salvar alterações
              </button>
            </form>
          </div>
        </div>
      )}

      <form onSubmit={add} className="glass grid gap-4 rounded-2xl p-6 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-slate-500">Nome da etapa</label>
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-accent/50"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Escavação"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Peso (0–1)</label>
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-accent/50"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Qtd. total</label>
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-accent/50"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Unidade</label>
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-accent/50"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="UN, m…"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white hover:bg-accent-glow"
          >
            Adicionar etapa
          </button>
        </div>
        {err && !edit && <p className="sm:col-span-2 text-sm text-signal-bad lg:col-span-6">{err}</p>}
      </form>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Peso</th>
              <th className="px-4 py-3">Qtd total</th>
              <th className="px-4 py-3">Unid.</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                <td className="px-4 py-3 text-slate-300">{(s.weight * 100).toFixed(2)}%</td>
                <td className="px-4 py-3 text-slate-300">{s.total_quantity}</td>
                <td className="px-4 py-3 text-slate-500">{s.unit ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setModalErr(null);
                      setEdit(s);
                    }}
                    className="mr-1 rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-accent-glow"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => del(s.id)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-signal-bad/15 hover:text-signal-bad"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stages.length === 0 && (
          <p className="p-8 text-center text-slate-500">Nenhuma etapa. Adicione acima.</p>
        )}
      </div>
    </div>
  );
}
