import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { MesAnoInput, SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { Exportacoes } from "@/components/app/Exportacoes";
import { itemQuery, listaQuery } from "@/lib/queries";
import { baixarCsv, baixarXlsx, celulaTexto } from "@/lib/exportar";
import { imprimirColunas } from "@/lib/imprimirColunas";
import { baixarDocumento } from "@/lib/documento/baixar";
import { cabecalho } from "@/lib/head";
import { useUsuario } from "@/lib/auth";
import { useCondominiosRecentes } from "@/hooks/useCondominiosRecentes";
import { documentoInadimplencia } from "@/documentos/inadimplencia";
import { mesAnoDe } from "@/domain/mensal";
import { normalizarExercicio } from "@/domain/exercicio";
import {
  colunasInadimplencia,
  evolucaoInadimplencia,
  rodapeInadimplencia,
  rotuloMes,
  type MesAno,
} from "@/domain/inadimplencia";
import type { Condominio, ConfigEscritorio, Exercicio, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorios/inadimplencia")({
  head: () =>
    cabecalho("Evolução da inadimplência", "Contas a receber mês a mês, a partir dos mensais."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]),
  component: Pagina,
});

/** Período padrão: os 12 meses que terminam no mês atual. */
function ultimos12Meses(hoje = new Date()): { de: MesAno; ate: MesAno } {
  const ate = { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
  const de = ate.mes === 12 ? { mes: 1, ano: ate.ano } : { mes: ate.mes + 1, ano: ate.ano - 1 };
  return { de, ate };
}

function Pagina() {
  const usuario = useUsuario();
  const { recentes } = useCondominiosRecentes(usuario?.id);
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: exerciciosRaw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: escritorio } = useSuspenseQuery(
    itemQuery<ConfigEscritorio>("config", "escritorio"),
  );
  const opcoes = opcoesCondominio(condominios, false, recentes);
  const [condoId, setCondoId] = useState(opcoes[0]?.valor ?? "");
  const padrao = ultimos12Meses();
  const [deTexto, setDeTexto] = useState(rotuloMes(padrao.de));
  const [ateTexto, setAteTexto] = useState(rotuloMes(padrao.ate));

  const exerciciosDoCondo = useMemo(
    () =>
      exerciciosRaw
        .map(normalizarExercicio)
        .filter((e) => e.condoId === condoId)
        .sort((a, b) => Number(b.ano) - Number(a.ano)),
    [exerciciosRaw, condoId],
  );
  const de = mesAnoDe(deTexto);
  const ate = mesAnoDe(ateTexto);
  const condo = condominios.find((c) => c.id === condoId) ?? null;
  const nomeCondo = condo?.nome || "Condomínio";

  if (!condominios.length)
    return (
      <SectionCard titulo="Nenhum condomínio cadastrado">
        <p className="text-sm text-muted-foreground">
          Cadastre um condomínio e importe os relatórios mensais para ver este relatório.
        </p>
      </SectionCard>
    );

  const r = de && ate ? evolucaoInadimplencia(mensais, condoId, de, ate) : null;
  const colunas = colunasInadimplencia();
  const linhas = r?.linhas ?? [];
  const arquivo = `inadimplencia ${nomeCondo} ${deTexto}-${ateTexto}`.replaceAll("/", "-");

  return (
    <>
      <PageHeader
        titulo="Evolução da inadimplência"
        descricao="Contas a receber mês a mês, com o percentual sobre as receitas e a comparação com o ano anterior."
        acoes={
          r ? (
            <Exportacoes
              acoes={{
                csv: () => baixarCsv(arquivo, colunas, linhas),
                xlsx: () => baixarXlsx(arquivo, "Inadimplência", colunas, linhas),
                documento: () =>
                  baixarDocumento(
                    documentoInadimplencia({
                      resultado: r,
                      condominio: condo,
                      nomeCondominio: nomeCondo,
                      escritorio,
                    }),
                    "pdf",
                  ),
                rotuloDocumento: "PDF (A4 paisagem)",
                imprimir: () =>
                  imprimirColunas({
                    titulo: "Evolução da inadimplência",
                    subtitulo: `${nomeCondo} · ${deTexto} a ${ateTexto}`,
                    colunas,
                    linhas,
                    totais: rodapeInadimplencia(r),
                  }),
              }}
            />
          ) : undefined
        }
      />
      <SectionCard
        titulo="Parâmetros"
        descricao="Escolha o condomínio e o período. Os atalhos usam o período de cada exercício."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field rotulo="Condomínio" className="sm:col-span-2">
            <SelecaoBusca
              value={condoId}
              onChange={setCondoId}
              opcoes={opcoes}
              placeholder="Escolha o condomínio"
            />
          </Field>
          <Field rotulo="De (mm/aaaa)" erro={de ? null : "Informe o mês no formato mm/aaaa."}>
            <MesAnoInput value={deTexto} onChange={setDeTexto} />
          </Field>
          <Field rotulo="Até (mm/aaaa)" erro={ate ? null : "Informe o mês no formato mm/aaaa."}>
            <MesAnoInput value={ateTexto} onChange={setAteTexto} />
          </Field>
        </div>
        {exerciciosDoCondo.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Atalhos de período">
            {exerciciosDoCondo.slice(0, 4).map((e) => {
              const ini = mesAnoDe(e.demonstrativo?.periodo?.ini);
              const fim = mesAnoDe(e.demonstrativo?.periodo?.fim);
              if (!ini || !fim) return null;
              return (
                <Button
                  key={e.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeTexto(rotuloMes(ini));
                    setAteTexto(rotuloMes(fim));
                  }}
                >
                  Exercício {e.ano}
                </Button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {r && r.avisos.length > 0 && (
        <ul
          className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground"
          aria-label="Avisos do relatório"
        >
          {r.avisos.map((aviso) => (
            <li key={aviso}>{aviso} Esses meses aparecem como "Sem dados".</li>
          ))}
        </ul>
      )}

      {r && r.linhas.length > 0 ? (
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
              {r.linhas.map((l) => (
                <TableRow
                  key={l.rotulo}
                  className={l.relatorios === 0 ? "text-muted-foreground" : undefined}
                >
                  {colunas.map((c) => (
                    <TableCell
                      key={c.titulo}
                      className={c.alinhamento === "direita" ? "num text-right" : undefined}
                    >
                      {celulaTexto(c, l)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                {rodapeInadimplencia(r).map((v, i) => (
                  <TableCell key={i} className={i > 0 ? "num text-right" : undefined}>
                    {v}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {r
            ? "O período escolhido não tem meses. Confira o início e o fim."
            : "Informe um período válido."}
        </p>
      )}
    </>
  );
}
