import { useState } from "react";
import { Upload } from "lucide-react";

type ImportFn = (file: File) => Promise<{ upserted: number; errors: string[] }>;

export default function CsvImportBlock({
  title,
  description,
  modelLines,
  onImport,
}: {
  title: string;
  description: string;
  modelLines: string[];
  onImport: ImportFn;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-white/10 bg-ink-950/80 p-3 text-[11px] leading-relaxed text-slate-400">
        {modelLines.join("\n")}
      </pre>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20">
        <Upload className="h-4 w-4" />
        {busy ? "Importando…" : "Selecionar arquivo CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={onFile} />
      </label>
      {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
