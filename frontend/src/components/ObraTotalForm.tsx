import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Project } from "../types";

export default function ObraTotalForm({
  projectId,
  project,
  onSaved,
}: {
  projectId: number;
  project: Project | null;
  onSaved: (p: Project) => void;
}) {
  const [obraInput, setObraInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const v = project?.obra_total_value_brl;
    if (v != null && Number.isFinite(v)) setObraInput(String(v));
    else setObraInput("");
  }, [project?.obra_total_value_brl]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const trimmed = obraInput.trim();
      const payload =
        trimmed === ""
          ? { obra_total_value_brl: null as number | null }
          : { obra_total_value_brl: Number(trimmed.replace(",", ".")) };
      if (trimmed !== "" && !Number.isFinite(payload.obra_total_value_brl)) {
        setMsg("Valor inválido.");
        return;
      }
      const updated = await api.projects.update(projectId, payload);
      onSaved(updated);
      setMsg("Salvo.");
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
          Valor total da obra (R$)
        </label>
        <p className="mb-2 text-xs text-slate-500">
          Usado no painel produtivo (avanço produtivo %), curvas e previsão de faturamento diária.
        </p>
        <input
          type="number"
          min={0}
          step="0.01"
          className="w-full max-w-md rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
          placeholder="Ex.: 3002162.75"
          value={obraInput}
          onChange={(e) => {
            setObraInput(e.target.value);
            setMsg(null);
          }}
        />
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar valor"}
        </button>
        {msg && <p className="text-xs text-slate-400">{msg}</p>}
      </div>
    </form>
  );
}
