import { useState } from "react";
import { Upload } from "lucide-react";

type ImportFn = (file: File) => Promise<{ upserted: number; errors: string[] }>;

/**
 * Upload Excel (.xlsx / .xls) com instruções completas para o usuário montar a planilha.
 */
export default function SpreadsheetImportBlock({
  title,
  specLines,
  onImport,
}: {
  title: string;
  /** Cada item: requisito da planilha (colunas, tipos, linhas, comportamento). */
  specLines: string[];
  onImport: ImportFn;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setMsg("Selecione um arquivo .xlsx ou .xls.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await onImport(file);
      const errPart =
        r.errors.length > 0 ? ` Avisos: ${r.errors.slice(0, 5).join(" · ")}${r.errors.length > 5 ? "…" : ""}` : "";
      setMsg(`Importadas ${r.upserted} linha(s).${errPart}`);
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : "Falha no import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed text-slate-400">
        {specLines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20">
        <Upload className="h-4 w-4" />
        {busy ? "Importando…" : "Selecionar planilha Excel (.xlsx ou .xls)"}
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={busy}
          onChange={onFile}
        />
      </label>
      {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
