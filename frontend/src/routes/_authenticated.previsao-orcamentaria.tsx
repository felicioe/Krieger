import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CircleHelp,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { opcoesCondominio, Selecao, SelecaoBusca } from "@/components/app/inputs";
import { PainelPrevisao } from "@/components/previsao/PainelPrevisao";
import { api } from "@/lib/api";
import { chaves, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import {
  encontrarExercicioAnterior,
  normalizarExercicio,
  prepararExercicio,
} from "@/domain/exercicio";
import { calcularPrevisao, demonstrativoBasePrevisao } from "@/domain/previsao";
import type { Condominio, Exercicio } from "@/domain/types";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { imprimirTabela } from "@/lib/imprimirTabela";
import { baixarMatrizXlsx } from "@/lib/exportar";
import { RolagemTabela } from "@/components/ui/table";

type Busca = { exercicio?: string; modo?: "rateio" | "relatorios" };

export const Route = createFileRoute("/_authenticated/previsao-orcamentaria")({
  head: ({ match }) =>
    match.search.modo === "relatorios"
      ? cabecalho(
          "Previsão para relatórios",
          "Realizado e previsto por grupo ou conta, sem os ajustes exclusivos do rateio.",
        )
      : cabecalho(
          "Previsão orçamentária",
          "Apuração do reajuste do rateio a partir do realizado do período.",
        ),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const exercicio = s["exercicio"];
    const modo = s["modo"] === "relatorios" ? "relatorios" : "rateio";
    return typeof exercicio === "string" && exercicio ? { exercicio, modo } : { modo };
  },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
    ]),
  component: PaginaPrevisao,
});

function PaginaPrevisao() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/previsao-orcamentaria" });
  const { data: exerciciosRaw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));

  const exercicios = useMemo(
    () =>
      exerciciosRaw
        .map((e) => normalizarExercicio(e))
        .sort(
          (a, b) =>
            Number(b.ano) - Number(a.ano) || a.condoNome.localeCompare(b.condoNome, "pt-BR"),
        ),
    [exerciciosRaw],
  );
  const exercicio = exercicios.find((e) => e.id === busca.exercicio) ?? exercicios[0];
  const exercicioAnterior = exercicio
    ? encontrarExercicioAnterior(exercicios, exercicio)
    : undefined;

  if (!exercicio) {
    return (
      <>
        <PageHeader
          titulo="Previsão orçamentária"
          descricao="Previsão orçamentária de cada prestação de contas."
        />
        <SectionCard titulo="Nenhuma prestação de contas">
          <p className="text-sm text-muted-foreground">
            Crie uma prestação de contas para montar a previsão orçamentária.
          </p>
          <Button asChild className="mt-4">
            <Link to="/prestacao-contas">Ir para Prestação de contas</Link>
          </Button>
        </SectionCard>
      </>
    );
  }

  const condoIdSelecionado = exercicio.condoId;
  const exerciciosDoCondominio = exercicios.filter((e) => e.condoId === condoIdSelecionado);
  const opcoesExercicio = exerciciosDoCondominio.map((e) => {
    const periodo = e.demonstrativo?.periodo;
    const intervalo = periodo?.ini && periodo.fim ? ` · ${periodo.ini} a ${periodo.fim}` : "";
    return { valor: e.id, rotulo: `Exercício ${e.ano}${intervalo}` };
  });
  const primeiraPrestacao = exerciciosDoCondominio[0];
  const selecionarCondominio = (condoId: string) => {
    const primeira = exercicios.find((e) => e.condoId === condoId);
    if (primeira)
      void navigate({
        search: { exercicio: primeira.id, modo: busca.modo ?? "rateio" },
        replace: true,
      });
    else void navigate({ search: {}, replace: true });
  };
  const seletor = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <Field rotulo="Condomínio">
        <SelecaoBusca
          value={condoIdSelecionado}
          onChange={selecionarCondominio}
          opcoes={opcoesCondominio(condominios)}
          placeholder="Escolha o condomínio"
          placeholderBusca="Pesquisar condomínio por nome, código ou CNPJ..."
        />
      </Field>
      <Field rotulo="Prestação de contas">
        <Selecao
          value={exercicio.id}
          onChange={(id) =>
            void navigate({
              search: { exercicio: id, modo: busca.modo ?? "rateio" },
              replace: true,
            })
          }
          opcoes={opcoesExercicio}
          disabled={!primeiraPrestacao}
        />
      </Field>
    </div>
  );

  return (
    <EditorPrevisao
      key={exercicio.id}
      inicial={exercicio}
      exercicioAnterior={exercicioAnterior ?? null}
      condominio={condominios.find((c) => c.id === exercicio.condoId)}
      seletor={seletor}
      modo={busca.modo ?? "rateio"}
    />
  );
}

function EditorPrevisao({
  inicial,
  exercicioAnterior,
  condominio,
  seletor,
  modo,
}: {
  inicial: Exercicio;
  exercicioAnterior: Pick<Exercicio, "demonstrativo"> | null;
  condominio: Condominio | undefined;
  seletor: ReactNode;
  modo: "rateio" | "relatorios";
}) {
  const queryClient = useQueryClient();
  const [e, setE] = useState<Exercicio>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const sujo = JSON.stringify(e) !== salvoJson;
  const unidades =
    e.fechado && e.fechamento ? e.fechamento.condominio.unidades : (condominio?.unidades ?? null);
  const demonstrativo = e.demonstrativo ?? demonstrativoVazio(e.condoNome);
  const mudar = (parcial: Partial<Exercicio>) =>
    setE((x) => (x.fechado ? x : { ...x, ...parcial }));

  // A base é o realizado do exercício ANTERIOR (fechado) — nunca o demonstrativo do próprio
  // exercício em edição, que vai sendo preenchido ao longo do ano e não pode servir de base móvel
  // pra uma previsão que precisa ficar estável. Sem exercício anterior (primeira prestação do
  // condomínio), cai no próprio demonstrativo. Mesma regra de domain/relatorioFinal.ts e das
  // demais telas que calculam a previsão de um exercício (docs/ESPECIFICACAO-V2.md).
  const demonstrativoBase =
    demonstrativoBasePrevisao(e, exercicioAnterior) ?? demonstrativoVazio(e.condoNome);
  const resultado = useMemo(
    () => calcularPrevisao(demonstrativoBase, { ...e, indices: e.consid.indices }, unidades),
    [demonstrativoBase, e, unidades],
  );

  const parcial = resultado.rateioSugerido === null;

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  useBlocker({
    shouldBlockFn: () =>
      sujoRef.current &&
      !window.confirm("Há alterações não salvas nesta previsão orçamentária. Sair mesmo assim?"),
    enableBeforeUnload: () => sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: (dados: Exercicio) => api.salvar("exercicios", dados),
    onSuccess: (salvo) => {
      const n = normalizarExercicio(salvo);
      queryClient.invalidateQueries({ queryKey: chaves.lista("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);
      setE(n);
      setSalvoJson(JSON.stringify(n));
      toast.success("Previsão orçamentária salva.");
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (e.fechado) return;
    salvar.mutate(prepararExercicio(e));
  }

  const periodo =
    demonstrativo.periodo.ini && demonstrativo.periodo.fim
      ? `${demonstrativo.periodo.ini} a ${demonstrativo.periodo.fim}`
      : null;

  if (modo === "relatorios") {
    return (
      <RelatorioPrevisao seletor={seletor} exercicio={e} resultado={resultado} periodo={periodo} />
    );
  }

  return (
    <>
      <PageHeader
        titulo={`Previsão orçamentária — Exercício ${e.ano}`}
        descricao={
          <>
            {e.condoNome || condominio?.nome}
            {periodo && <span className="num"> · período {periodo}</span>}
          </>
        }
        acoes={
          <>
            {parcial && (
              <Badge
                variant="warning"
                title="Falta dado para o valor por unidade. Salvar continua permitido."
              >
                Resultado parcial
              </Badge>
            )}
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <Button variant="ghost" size="icon" asChild title="Ajuda sobre esta tela">
              <Link
                to="/ajuda"
                search={{ secao: "previsao-orcamentaria" }}
                aria-label="Ajuda sobre a previsão orçamentária"
              >
                <CircleHelp />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/prestacao-contas/$id" params={{ id: e.id }}>
                <FileSpreadsheet /> Prestação de contas
              </Link>
            </Button>
            <Button
              permissao="previsao_orcamentaria.editar"
              type="submit"
              form="form-previsao"
              disabled={salvar.isPending || e.fechado}
            >
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      <SectionCard className="mb-6">{seletor}</SectionCard>

      {e.fechado && (
        <p className="mb-4 text-sm">
          Exercício fechado. Reabra na prestação de contas para alterar a previsão.
        </p>
      )}
      <form id="form-previsao" onSubmit={enviar} noValidate>
        <fieldset disabled={e.fechado} className="min-w-0">
          <PainelPrevisao
            exercicio={e}
            resultado={resultado}
            unidades={unidades}
            condoId={e.condoId}
            onChange={mudar}
          />
        </fieldset>
      </form>
    </>
  );
}

function RelatorioPrevisao({
  seletor,
  exercicio,
  resultado,
  periodo,
}: {
  seletor: ReactNode;
  exercicio: Exercicio;
  resultado: ReturnType<typeof calcularPrevisao>;
  periodo: string | null;
}) {
  const [detalhado, setDetalhado] = useState(false);
  const [exportandoXlsx, setExportandoXlsx] = useState(false);
  const exportandoRef = useRef(false);
  const demonstrativo = exercicio.demonstrativo ?? demonstrativoVazio(exercicio.condoNome);
  const fator = 1 + resultado.variacaoPct / 100;
  const linhas = demonstrativo.despesas.grupos.flatMap((grupo) =>
    detalhado
      ? grupo.itens.map((item) => ({
          nome: item.nome || "Sem nome",
          realizado: Number(item.valor) || 0,
          grupo: grupo.nome,
        }))
      : [
          {
            nome: grupo.nome || "Sem grupo",
            realizado: grupo.itens.reduce((s, item) => s + (Number(item.valor) || 0), 0),
            grupo: grupo.nome,
          },
        ],
  );
  const totalRealizado = linhas.reduce((s, linha) => s + linha.realizado, 0);
  const totalPrevisto = totalRealizado * fator;
  const dadosExportacao = linhas.map((linha) => ({
    Grupo: linha.grupo,
    Conta: linha.nome,
    Realizado: linha.realizado,
    Previsto: linha.realizado * fator,
    "Variação (%)": linha.realizado ? Number(((fator - 1) * 100).toFixed(2)) : null,
  }));
  const nomeArquivo = `previsao-relatorios-${exercicio.ano}`;
  const baixarCsv = () => {
    const cabecalho = ["Grupo", "Conta", "Realizado", "Previsto", "Variação (%)"];
    const conteudo = [
      cabecalho,
      ...dadosExportacao.map((linha) => [
        linha.Grupo,
        linha.Conta,
        linha.Realizado.toFixed(2),
        linha.Previsto.toFixed(2),
        linha["Variação (%)"] ?? "",
      ]),
    ]
      .map((linha) => linha.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + conteudo], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const baixarXlsx = async () => {
    if (exportandoRef.current) return;
    exportandoRef.current = true;
    setExportandoXlsx(true);
    try {
      await baixarMatrizXlsx(nomeArquivo, "Previsto x Realizado", [
        ["Grupo", "Conta", "Realizado", "Previsto", "Variação (%)"],
        ...dadosExportacao.map((linha) => [
          linha.Grupo,
          linha.Conta,
          linha.Realizado,
          linha.Previsto,
          linha["Variação (%)"] ?? "",
        ]),
      ]);
    } catch {
      toast.error("Não foi possível preparar a planilha. Tente exportar novamente.");
    } finally {
      exportandoRef.current = false;
      setExportandoXlsx(false);
    }
  };
  const imprimirPdf = () => {
    try {
      const abriu = imprimirTabela({
        titulo: `Previsto × Realizado — ${exercicio.condoNome} — Exercício ${exercicio.ano}`,
        subtitulo: periodo ?? "",
        cabecalhos: ["Grupo", "Conta", "Realizado", "Previsto", "Variação (%)"],
        linhas: dadosExportacao.map((linha) => [
          linha.Grupo,
          linha.Conta,
          formatBRL(linha.Realizado),
          formatBRL(linha.Previsto),
          linha["Variação (%)"] === null ? "—" : `${formatNumeroBR(linha["Variação (%)"])}%`,
        ]),
        totais: [
          "Total",
          "",
          formatBRL(totalRealizado),
          formatBRL(totalPrevisto),
          totalRealizado ? `${formatNumeroBR((fator - 1) * 100)}%` : "—",
        ],
      });
      if (!abriu)
        toast.error(
          "A janela de impressão foi bloqueada. Permita pop-ups deste site e tente novamente.",
        );
    } catch {
      toast.error("Não foi possível preparar a impressão. Tente novamente.");
    }
  };
  return (
    <>
      <PageHeader
        titulo={`Previsão para relatórios — Exercício ${exercicio.ano}`}
        descricao={
          <>
            {exercicio.condoNome}
            {periodo && <span className="num"> · período {periodo}</span>}
          </>
        }
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={imprimirPdf}>
              <FileText /> PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => void baixarXlsx()}
              disabled={exportandoXlsx}
              aria-busy={exportandoXlsx}
            >
              {exportandoXlsx ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}{" "}
              {exportandoXlsx ? "Preparando XLSX…" : "XLSX"}
            </Button>
            <Button variant="outline" onClick={baixarCsv}>
              <Download /> CSV
            </Button>
            <Button variant="outline" onClick={imprimirPdf}>
              <Printer /> Imprimir
            </Button>
          </div>
        }
      />
      <SectionCard className="mb-6">{seletor}</SectionCard>
      <SectionCard
        titulo="Previsto × Realizado"
        descricao={`Realizado aplicado pelo reajuste de ${formatNumeroBR(resultado.variacaoPct)}% · sem deduções, ajustes ou variação de despesas sugeridas.`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-md border bg-muted/40 p-1"
            role="group"
            aria-label="Modo de apresentação"
          >
            <Button
              type="button"
              size="sm"
              aria-pressed={!detalhado}
              variant={!detalhado ? "secondary" : "ghost"}
              onClick={() => setDetalhado(false)}
            >
              Por grupo
            </Button>
            <Button
              type="button"
              size="sm"
              aria-pressed={detalhado}
              variant={detalhado ? "secondary" : "ghost"}
              onClick={() => setDetalhado(true)}
            >
              Detalhado
            </Button>
          </div>
        </div>
        <RolagemTabela className="rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr className="border-b">
                <th className="px-3 py-2 text-left">{detalhado ? "Conta" : "Grupo"}</th>
                <th className="px-3 py-2 text-right">Realizado</th>
                <th className="px-3 py-2 text-right">Previsto</th>
                <th className="px-3 py-2 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, index) => {
                const previsto = linha.realizado * fator;
                const variacao = linha.realizado
                  ? formatNumeroBR((previsto / Math.abs(linha.realizado) - 1) * 100) + "%"
                  : "—";
                const novoGrupo =
                  detalhado && (index === 0 || linhas[index - 1]!.grupo !== linha.grupo);
                return (
                  <Fragment key={`${linha.grupo}-${linha.nome}-${index}`}>
                    {novoGrupo && (
                      <tr className="border-b bg-muted/30">
                        <th
                          colSpan={4}
                          className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {linha.grupo || "Sem grupo"}
                        </th>
                      </tr>
                    )}
                    <tr className="border-b last:border-0">
                      <td className="px-3 py-2">{linha.nome}</td>
                      <td className="num px-3 py-2 text-right">{formatBRL(linha.realizado)}</td>
                      <td className="num px-3 py-2 text-right font-medium">
                        {formatBRL(previsto)}
                      </td>
                      <td className="num px-3 py-2 text-right text-muted-foreground">{variacao}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-secondary font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="num px-3 py-2 text-right">{formatBRL(totalRealizado)}</td>
                <td className="num px-3 py-2 text-right text-primary">
                  {formatBRL(totalPrevisto)}
                </td>
                <td className="num px-3 py-2 text-right text-primary">
                  {totalRealizado
                    ? `${formatNumeroBR((totalPrevisto / Math.abs(totalRealizado) - 1) * 100)}%`
                    : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </RolagemTabela>
      </SectionCard>
    </>
  );
}
