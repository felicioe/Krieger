import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { itemQuery, listaQuery } from "@/lib/queries";
import { Exportacoes } from "@/components/app/Exportacoes";
import { baixarCsv, baixarXlsx } from "@/lib/exportar";
import { imprimirColunas } from "@/lib/imprimirColunas";
import { colunasMensalExport, linhasMensalExport } from "@/lib/colunasRelatorios";
import { documentoPrevistoRealizadoMensal } from "@/documentos/previstoRealizadoMensal";
import { baixarDocumento } from "@/lib/documento/baixar";
import { TabelaMensal } from "@/components/previsto-realizado/TabelaMensal";
import { cabecalho } from "@/lib/head";
import { encontrarExercicioAnterior, normalizarExercicio } from "@/domain/exercicio";
import { demonstrativoBasePrevisao } from "@/domain/previsao";
import { compararPrevistoRealizadoMensal } from "@/domain/previstoRealizadoMensal";
import type { Condominio, ConfigEscritorio, Exercicio, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorios/orcado-realizado-mensal")({
  head: () =>
    cabecalho("Previsto × Realizado mensal", "Conferência mensal do previsto e do realizado."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]),
  component: Pagina,
});

function Pagina() {
  const { data: raw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: escritorio } = useSuspenseQuery(
    itemQuery<ConfigEscritorio>("config", "escritorio"),
  );
  const exercicios = useMemo(
    () => raw.map(normalizarExercicio).sort((a, b) => Number(b.ano) - Number(a.ano)),
    [raw],
  );
  const [exercicioId, setExercicioId] = useState(exercicios[0]?.id ?? "");
  const [inicio, setInicio] = useState(1);
  const [fim, setFim] = useState(12);
  const [orcado, setOrcado] = useState(true);
  const [horizontal, setHorizontal] = useState(true);
  const [vertical, setVertical] = useState(false);
  const e = exercicios.find((x) => x.id === exercicioId) ?? exercicios[0];
  const condo = e ? condominios.find((c) => c.id === e.condoId) : null;
  // Mesma base do editor de previsão: o realizado do exercício anterior, nunca o demonstrativo do
  // próprio exercício — pra este comparativo nunca divergir da previsão aprovada ali.
  const demonstrativoBase = e
    ? demonstrativoBasePrevisao(e, encontrarExercicioAnterior(exercicios, e))
    : null;
  const r = e
    ? compararPrevistoRealizadoMensal(e, mensais, {
        condominio: condo ?? null,
        inicio,
        fim,
        demonstrativoBase,
      })
    : null;
  const opEx = exercicios.map((x) => ({
    valor: x.id,
    rotulo: `${x.condoNome || condominios.find((c) => c.id === x.condoId)?.nome || "Condomínio"} · previsão ${x.ano}`,
  }));
  const opMes = Array.from({ length: 12 }, (_, i) => ({
    valor: String(i + 1),
    rotulo: `Mês ${i + 1}`,
  }));
  if (!r || !e)
    return (
      <SectionCard titulo="Nenhuma previsão disponível">
        <p className="text-sm text-muted-foreground">
          Crie uma previsão orçamentária para gerar este relatório.
        </p>
      </SectionCard>
    );
  const opcoesExport = { orcado, horizontal, vertical };
  const colunasExport = colunasMensalExport(r, opcoesExport);
  const linhasExport = linhasMensalExport(r);
  const nomeCondo = condo?.nome || e.condoNome || "Condomínio";
  const arquivoSaida = `previsto-realizado-mensal ${nomeCondo} ${String(e.ano)}`;
  return (
    <>
      <PageHeader
        titulo="Previsto × Realizado mensal"
        descricao="Conferência mês a mês, com totais por linha e por coluna."
        acoes={
          <Exportacoes
            acoes={{
              csv: () => baixarCsv(arquivoSaida, colunasExport, linhasExport),
              xlsx: () => baixarXlsx(arquivoSaida, "Mensal", colunasExport, linhasExport),
              documento: () =>
                baixarDocumento(
                  documentoPrevistoRealizadoMensal({
                    resultado: r,
                    exercicio: e,
                    condominio: condo ?? null,
                    escritorio,
                    mensais,
                    opcoes: opcoesExport,
                  }),
                  "pdf",
                ),
              rotuloDocumento: "PDF (A4 paisagem)",
              imprimir: () =>
                imprimirColunas({
                  titulo: "Previsto × Realizado mensal",
                  subtitulo: `${nomeCondo} · ${r.meses[0]?.rotulo ?? "—"} a ${r.meses.at(-1)?.rotulo ?? "—"}`,
                  colunas: colunasExport,
                  linhas: linhasExport,
                }),
            }}
          />
        }
      />
      <SectionCard
        titulo="Parâmetros"
        descricao="Todas as análises respeitam exclusivamente o período selecionado."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field rotulo="Previsão">
            <Selecao value={e.id} onChange={setExercicioId} opcoes={opEx} />
          </Field>
          <Field rotulo="De">
            <Selecao
              value={String(inicio)}
              onChange={(v) => setInicio(Math.min(Number(v), fim))}
              opcoes={opMes}
            />
          </Field>
          <Field rotulo="Até">
            <Selecao
              value={String(fim)}
              onChange={(v) => setFim(Math.max(Number(v), inicio))}
              opcoes={opMes}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-2">
            <Op id="mr-orcado" checked={orcado} onChange={setOrcado}>
              Mostrar previsto
            </Op>
            <Op id="mr-h" checked={horizontal} onChange={setHorizontal}>
              Análise horizontal
            </Op>
            <Op id="mr-v" checked={vertical} onChange={setVertical}>
              Análise vertical
            </Op>
          </div>
        </div>
      </SectionCard>
      <TabelaMensal resultado={r} orcado={orcado} horizontal={horizontal} vertical={vertical} />
    </>
  );
}

function Op({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id}>{children}</Label>
    </div>
  );
}
