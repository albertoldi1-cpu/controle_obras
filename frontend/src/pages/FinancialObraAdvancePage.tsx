import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api";
import type { ObraFinancialAdvance } from "../types";
import ObraFinancialAdvanceChart from "../components/ObraFinancialAdvanceChart";
import SpreadsheetImportBlock from "../components/SpreadsheetImportBlock";

type Ctx = { projectId: number };

export default function FinancialObraAdvancePage() {
  const { projectId } = useOutletContext<Ctx>();
  const [data, setData] = useState<ObraFinancialAdvance | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr(null);
    api.financial
      .obraAdvance(projectId)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro ao carregar"));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) {
    return <p className="text-signal-bad">{err}</p>;
  }
  if (!data) {
    return <p className="animate-pulse text-slate-500">Carregando avanço financeiro…</p>;
  }

  const sourceLabel =
    data.source_planned === "imported"
      ? "Previsões financeiras: importadas da planilha (faturamento diário nas linhas indicadas)."
      : "Ainda não há import da planilha: as linhas otimista/pessimista aparecem após o upload. O avanço físico vem dos lançamentos.";

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-transparent to-slate-900/40 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Avanço financeiro</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Três séries: <strong className="text-slate-300">avanço físico executado</strong> (mesma lógica do painel Avanço
          físico, eixo em % da obra) e <strong className="text-slate-300">previsão financeira diária</strong> em R$ (eixo
          direito) para os cenários otimista e pessimista, lidos da folha «AVANÇO FINANCEIRO».
        </p>
        <p className="mt-3 text-xs text-slate-500">{sourceLabel}</p>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold text-white">Importar «AVANÇO FINANCEIRO» (Excel)</h2>
        <p className="mt-1 text-sm text-slate-500">
          O ficheiro não fica no repositório. O layout esperado na folha (números de linha como no Excel):
        </p>
        <div className="mt-4">
          <SpreadsheetImportBlock
            title="Planilha «AVANÇO FINANCEIRO»"
            specLines={[
              "Folha com nome contendo «AVANÇO FINANCEIRO» (ou primeira folha com «financeiro» no nome).",
              "Otimista: linha 4 = datas da previsão (eixo X); linha 13 = faturamento diário em R$ (eixo Y), coluna a coluna.",
              "Pessimista: linha 16 = datas; linha 25 = faturamento diário em R$, alinhado às mesmas colunas.",
              "Cada import substitui os dados financeiros gravados anteriormente neste projeto.",
            ]}
            onImport={async (file) => {
              const r = await api.financial.importObraAdvanceXlsx(projectId, file);
              await load();
              return { upserted: r.upserted, errors: r.errors };
            }}
          />
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Curva — físico × previsões financeiras</h2>
            <p className="mt-1 text-sm text-slate-500">
              Eixo esquerdo: % de avanço físico da obra (ponderado). Eixo direito: valores diários em reais (import).
            </p>
          </div>
          <div className="flex max-w-md flex-col gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="block h-0 w-7 border-t-2 border-dashed border-[#94a3b8]" aria-hidden />
              Avanço físico (%)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="block h-0.5 w-7 rounded-full bg-[#4ade80]" aria-hidden />
              Previsão otimista (R$/dia)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="block h-0.5 w-7 rounded-full bg-[#3d8bfd]" aria-hidden />
              Previsão pessimista (R$/dia)
            </span>
          </div>
        </div>
        <ObraFinancialAdvanceChart data={data.series} />
      </section>
    </div>
  );
}
