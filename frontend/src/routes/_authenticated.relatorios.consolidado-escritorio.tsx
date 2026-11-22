import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { MesAnoInput, Selecao } from "@/components/app/inputs";
import { Exportacoes } from "@/components/app/Exportacoes";
import { listaQuery, listaQueryTolerante } from "@/lib/queries";
import { baixarXlsx, celulaTexto } from "@/lib/exportar";
import { imprimirColunas } from "@/lib/imprimirColunas";
import { cabecalho } from "@/lib/head";
import { cn } from "@/lib/utils";
import { mesAnoDe } from "@/domain/mensal";
import {
  ROTULO_SITUACAO,
  colunasConsolidado,
  consolidadoEscritorio,
  filtrarConsolidado,
  mesReferenciaPadrao,
  ordenarConsolidado,
  rodapeConsolidado,
  type CriterioConsolidado,
  type SituacaoCarga,
} from "@/domain/consolidadoEscritorio";
import type { Condominio, HistoricoRateio, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorios/consolidado-escritorio")({
  head: () =>
    cabecalho(
      "Consolidado do escritório",
      "Todos os condomínios lado a lado, para priorizar o mês.",
    ),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(listaQueryTolerante<HistoricoRateio>("historico_rateios")),
    ]),
  component: Pagina,
});

const ORDENS: { valor: CriterioConsolidado; rotulo: string }[] = [
  { valor: "atraso", rotulo: "Atraso de carga" },
  { valor: "inadimplencia", rotulo: "Maior inadimplência" },
  { valor: "saldo", rotulo: "Menor saldo" },
];
const SITUACOES: { valor: SituacaoCarga | "todas"; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "atrasado", rotulo: ROTULO_SITUACAO.atrasado },
  { valor: "incompleto", rotulo: ROTULO_SITUACAO.incompleto },
  { valor: "em_dia", rotulo: ROTULO_SITUACAO.em_dia },
];
const COR_SITUACAO: Record<SituacaoCarga, string> = {
  atrasado: "text-destructive",
  incompleto: "text-amber-800",
  em_dia: "text-success",
};

function Pagina() {
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: historico } = useSuspenseQuery(
    listaQueryTolerante<HistoricoRateio>("historico_rateios"),
  );
  const padrao = mesReferenciaPadrao();
  const [referenciaTexto, setReferenciaTexto] = useState(
    `${String(padrao.mes).padStart(2, "0")}/${padrao.ano}`,
  );
  const [ordem, setOrdem] = useState<CriterioConsolidado>("atraso");
  const [situacao, setSituacao] = useState<SituacaoCarga | "todas">("todas");
  const [busca, setBusca] = useState("");

  const referencia = mesAnoDe(referenciaTexto) ?? padrao;
  const todas = consolidadoEscritorio(condominios, mensais, historico, referencia);
  const linhas = ordenarConsolidado(filtrarConsolidado(todas, busca, situacao), ordem);
  const colunas = colunasConsolidado();
  const arquivo = `consolidado-escritorio ${referenciaTexto.replace("/", "-")}`;
  const contagem = (s: SituacaoCarga) => todas.filter((l) => l.situacao === s).length;

  return (
    <>
      <PageHeader
        titulo="Consolidado do escritório"
        descricao="Todos os condomínios lado a lado, para decidir onde olhar primeiro no mês."
        acoes={
          <Exportacoes
            acoes={{
              xlsx: () => baixarXlsx(arquivo, "Consolidado", colunas, linhas),
              imprimir: () =>
                imprimirColunas({
                  titulo: "Consolidado do escritório",
                  subtitulo: `Mês de referência ${referenciaTexto}`,
                  colunas,
                  linhas,
                  totais: rodapeConsolidado(linhas),
                }),
            }}
          />
        }
      />
      <SectionCard titulo="Parâmetros">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field
            rotulo="Mês de referência (mm/aaaa)"
            erro={mesAnoDe(referenciaTexto) ? null : "Informe o mês no formato mm/aaaa."}
          >
            <MesAnoInput value={referenciaTexto} onChange={setReferenciaTexto} />
          </Field>
          <Field rotulo="Situação">
            <Selecao
              value={situacao}
              onChange={(v) => setSituacao(v as SituacaoCarga | "todas")}
              opcoes={SITUACOES}
            />
          </Field>
          <Field rotulo="Ordenar por">
            <Selecao
              value={ordem}
              onChange={(v) => setOrdem(v as CriterioConsolidado)}
              opcoes={ORDENS}
            />
          </Field>
          <Field rotulo="Buscar (nome, código ou CNPJ)">
            <Input value={busca} onChange={(ev) => setBusca(ev.target.value)} />
          </Field>
        </div>
        <ul
          className="mt-4 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3"
          aria-label="Legenda da situação"
        >
          <li>
            <strong className={COR_SITUACAO.atrasado}>Atrasado ({contagem("atrasado")})</strong>:
            sem relatório mensal do mês de referência.
          </li>
          <li>
            <strong className={COR_SITUACAO.incompleto}>
              Incompleto ({contagem("incompleto")})
            </strong>
            : há relatório, mas o saldo não fecha.
          </li>
          <li>
            <strong className={COR_SITUACAO.em_dia}>Em dia ({contagem("em_dia")})</strong>:
            relatório carregado e saldo conferido.
          </li>
        </ul>
      </SectionCard>

      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum condomínio com esses filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {colunas.map((c) => (
                  <TableHead
                    key={c.titulo}
                    className={c.alinhamento === "direita" ? "text-right" : undefined}
                  >
                    {c.titulo}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.condoId}>
                  {colunas.map((c) => (
                    <TableCell
                      key={c.titulo}
                      title={c.titulo === "Situação" ? l.motivo : undefined}
                      className={cn(
                        c.alinhamento === "direita" && "num text-right",
                        c.titulo === "Situação" && cn("font-medium", COR_SITUACAO[l.situacao]),
                      )}
                    >
                      {celulaTexto(c, l)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                {rodapeConsolidado(linhas).map((v, i) => (
                  <TableCell key={i} className={i >= 4 ? "num text-right" : undefined}>
                    {v}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}
