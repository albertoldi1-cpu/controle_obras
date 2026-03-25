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
      ? "Planejado: dados importados da planilha «AVANÇO FINANCEIRO» (cenário otimista)."
      : "Planejado: soma do planejamento/meta diária por equipe (sem import). Faça upload da planilha para alinhar ao Excel.";

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-transparent to-slate-900/40 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Avanço financeiro</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Compara o <strong className="text-slate-300">valor financeiro planejado para a obra</strong> (acumulado em % do
          total da obra) com o <strong className="text-slate-300">avanço produtivo</strong>, na mesma linguagem visual do
          executado na curva S física (cinza tracejado).
        </p>
        <p className="mt-3 text-xs text-slate-500">{sourceLabel}</p>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold text-white">Importar planejamento (Excel)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use o ficheiro com a folha «AVANÇO FINANCEIRO» (bloco otimista). O ficheiro não fica no repositório — apenas é
          lido no servidor e gravado por dia neste projeto.
        </p>
        <div className="mt-4">
          <SpreadsheetImportBlock
            title="Planilha «AVANÇO FINANCEIRO»"
            specLines={[
              "Folha com nome contendo «AVANÇO FINANCEIRO» (ex.: do seu Excel de controle).",
              "Bloco cenário otimista: linha com «OTIMISTA» na coluna A e datas nas colunas seguintes (a partir da B).",
              "Linhas de detalhe abaixo são somadas por dia; linhas de totais acumulados (monótonas) são ignoradas.",
              "O import substitui o planejamento financeiro da obra guardado anteriormente neste projeto.",
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
            <h2 className="font-display text-xl font-semibold text-white">Curva — planejado × produtivo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Eixo Y: % sobre o valor total da obra
              {data.obra_total_value_brl != null
                ? ` (${Number(data.obra_total_value_brl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`
                : " (defina o valor total da obra no projeto)"}
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="block h-0.5 w-7 rounded-full bg-[#4ade80]" aria-hidden />
              Planejado financeiro
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="block h-0 w-7 border-t-2 border-dashed border-[#94a3b8]" aria-hidden />
              Avanço produtivo
            </span>
          </div>
        </div>
        <ObraFinancialAdvanceChart data={data.series} />
      </section>
    </div>
  );
}
