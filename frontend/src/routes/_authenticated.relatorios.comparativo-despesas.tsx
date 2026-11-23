import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { Selecao, SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { Exportacoes } from "@/components/app/Exportacoes";
import { itemQuery, listaQuery } from "@/lib/queries";
import { baixarXlsx, celulaTexto } from "@/lib/exportar";
import { imprimirColunas } from "@/lib/imprimirColunas";
import { cabecalho } from "@/lib/head";
import { useUsuario } from "@/lib/auth";
import { useCondominiosRecentes } from "@/hooks/useCondominiosRecentes";
import { documentoComparativoDespesas } from "@/documentos/comparativoDespesas";
import { normalizarExercicio } from "@/domain/exercicio";
import {
  colunasComparativoDespesas,
  comparativoDespesas,
  rodapeComparativoDespesas,
  type OrdemComparativo,
} from "@/domain/comparativoDespesas";
import type { Condominio, ConfigEscritorio, Exercicio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorios/comparativo-despesas")({
  head: () =>
    cabecalho("Comparativo de despesas", "Evolução de cada grupo de despesa entre exercícios."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]),
  component: Pagina,
});

const ORDENS: { valor: OrdemComparativo; rotulo: string }[] = [
  { valor: "variacao", rotulo: "Maior variação" },
  { valor: "valor", rotulo: "Maior valor no último exercício" },
];

function Pagina() {
  const usuario = useUsuario();
  const { recentes } = useCondominiosRecentes(usuario?.id);
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: exerciciosRaw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: escritorio } = useSuspenseQuery(
    itemQuery<ConfigEscritorio>("config", "escritorio"),
  );
  const opcoes = opcoesCondominio(condominios, false, recentes);
  const [condoId, setCondoId] = useState(opcoes[0]?.valor ?? "");
  const [anoDe, setAnoDe] = useState<string>("");
  const [anoAte, setAnoAte] = useState<string>("");
  const [analitico, setAnalitico] = useState(false);
  const [ordem, setOrdem] = useState<OrdemComparativo>("variacao");

  const doCondo = useMemo(
    () =>
      exerciciosRaw
        .map(normalizarExercicio)
        .filter((e) => e.condoId === condoId)
        .sort((a, b) => Number(a.ano) - Number(b.ano)),
    [exerciciosRaw, condoId],
  );
  const anos = doCondo.map((e) => String(e.ano));
  // Sem escolha, o período é do primeiro ao último exercício do condomínio.
  const de = anos.includes(anoDe) ? anoDe : (anos[0] ?? "");
  const ate = anos.includes(anoAte) ? anoAte : (anos.at(-1) ?? "");
  const noPeriodo = doCondo.filter(
    (e) => Number(e.ano) >= Number(de) && Number(e.ano) <= Number(ate),
  );
  const r = comparativoDespesas(noPeriodo, { analitico, ordem });
  const colunas = colunasComparativoDespesas(r, analitico);
  const condo = condominios.find((c) => c.id === condoId) ?? null;
  const nomeCondo = condo?.nome || "Condomínio";
  const arquivo = `comparativo-despesas ${nomeCondo} ${de}-${ate}`;
  const opAnos = anos.map((a) => ({ valor: a, rotulo: a }));

  return (
    <>
      <PageHeader
        titulo="Comparativo de despesas"
        descricao="Como cada grupo de despesa evoluiu entre os exercícios do período."
        acoes={
          r.anos.length > 0 ? (
            <Exportacoes
              acoes={{
                documentos: [
                  {
                    rotulo: "Comparativo de despesas",
                    gerar: () =>
                      documentoComparativoDespesas({
                        resultado: r,
                        analitico,
                        condominio: condo,
                        nomeCondominio: nomeCondo,
                        escritorio,
                      }),
                  },
                ],
                xlsx: () => baixarXlsx(arquivo, "Despesas", colunas, r.linhas),
                imprimir: () =>
                  imprimirColunas({
                    titulo: "Comparativo de despesas",
                    subtitulo: `${nomeCondo} · exercícios ${de} a ${ate}`,
                    colunas,
                    linhas: r.linhas,
                    totais: rodapeComparativoDespesas(r, analitico),
                  }),
              }}
            />
          ) : undefined
        }
      />
      <SectionCard
        titulo="Parâmetros"
        descricao="A variação compara o primeiro e o último exercício."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field rotulo="Condomínio" className="sm:col-span-2">
            <SelecaoBusca
              value={condoId}
              onChange={(v) => {
                setCondoId(v);
                setAnoDe("");
                setAnoAte("");
              }}
              opcoes={opcoes}
              placeholder="Escolha o condomínio"
            />
          </Field>
          <Field rotulo="Do exercício">
            <Selecao value={de} onChange={setAnoDe} opcoes={opAnos} />
          </Field>
          <Field rotulo="Até o exercício">
            <Selecao value={ate} onChange={setAnoAte} opcoes={opAnos} />
          </Field>
          <Field rotulo="Ordenar por">
            <Selecao
              value={ordem}
              onChange={(v) => setOrdem(v as OrdemComparativo)}
              opcoes={ORDENS}
            />
          </Field>
          <div className="flex min-h-11 items-end gap-2 pb-2 text-xs text-muted-foreground">
            <Checkbox
              id="cd-analitico"
              checked={analitico}
              onCheckedChange={(v) => setAnalitico(v === true)}
            />
            <Label htmlFor="cd-analitico">Abrir por rubrica</Label>
          </div>
        </div>
      </SectionCard>

      {r.anos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este condomínio ainda não tem prestação de contas com despesas.
        </p>
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
              {r.linhas.map((l) => (
                <TableRow key={`${l.grupo}|${l.rubrica ?? ""}`}>
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
                {rodapeComparativoDespesas(r, analitico).map((v, i) => (
                  <TableCell
                    key={i}
                    className={i > (analitico ? 1 : 0) ? "num text-right" : undefined}
                  >
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
