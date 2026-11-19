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
import { chaves, listaQuery, listaQueryTolerante } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import {
  encontrarExercicioAnterior,
  normalizarExercicio,
  prepararExercicio,
} from "@/domain/exercicio";
import { calcularPrevisao, demonstrativoBasePrevisao } from "@/domain/previsao";
import { aplicarRateioBase, aplicarVariacaoDoHistorico, historicoDoExercicio } from "@/domain/historicoRateio";
import type { Condominio, Demonstrativo, Exercicio, HistoricoRateio } from "@/domain/types";
import { novoId } from "@/lib/id";
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
      queryClient.ensureQueryData(listaQueryTolerante<HistoricoRateio>("historico_rateios")),
    ]),
  component: PaginaPrevisao,
});

function PaginaPrevisao() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/previsao-orcamentaria" });
  const { data: exerciciosRaw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: historicoRateios } = useSuspenseQuery(
    listaQueryTolerante<HistoricoRateio>("historico_rateios"),
  );

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
      historicoRateios={historicoRateios}
      exercicios={exercicios}
      seletor={seletor}
      modo={busca.modo ?? "rateio"}
    />
  );
}

function EditorPrevisao({
  inicial,
  exercicioAnterior,
  condominio,
  historicoRateios,
  exercicios,
  seletor,
  modo,
}: {
  inicial: Exercicio;
  exercicioAnterior: Pick<Exercicio, "demonstrativo"> | null;
  condominio: Condominio | undefined;
  historicoRateios: HistoricoRateio[];
  exercicios: Exercicio[];
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
  // pra uma previsão que precisa ficar estável. `demonstrativoBasePrevisao` devolve null só para
  // exercício aberto SEM anterior; aí a regra da primeira prestação (docs/ESPECIFICACAO-V2.md)
  // manda usar o próprio demonstrativo — base móvel é o preço aceitável de não calcular R$ 0,00.
  // No modo relatórios, a base é SEMPRE o demonstrativo do exercício anterior (despesas
  // realizadas do período fechado), pois o próprio exercício já pode ter o índice embutido.
  // Aplicar 15,26% sobre R$ 982.212,87 geraria R$ 1.132.098,55; a base correta é
  // R$ 851.955,11 (anterior) → previsto ~R$ 982 mil. Fora do modo relatórios, mantém
  // a regra original de usar o demonstrativo do próprio exercício.
  const demonstrativoBase =
    modo === "relatorios"
      ? (exercicioAnterior?.demonstrativo ?? demonstrativo ?? demonstrativoVazio(e.condoNome))
      : (demonstrativoBasePrevisao(e, exercicioAnterior) ??
         demonstrativo ??
         demonstrativoVazio(e.condoNome));
  // Herda o rateioAtual do ano anterior antes de calcular a variação — sem isso, o fallback
  // de aplicarVariacaoDoHistorico não tem base para comparar com o rateioAprovado e retorna 0%.
  const eComRateioBase = aplicarRateioBase(e, historicoRateios);
  // Injeta a variação % do histórico de rateios quando o exercício não tem variação explícita.
  // No modo "relatorios" o demonstrativo é removido antes da chamada: lá a base da previsão é
  // o realizado anterior (R$ 851.955,11 no caso Lago Negro) e o índice do histórico (15,26%)
  // precisa ser aplicado UMA vez sobre ela; com o demonstrativo próprio (já reajustado, R$
  // 982.212,87) presente, a função não injetaria nada e a tela mostraria 0,00%.
  const paramsComHistorico = aplicarVariacaoDoHistorico(
    {
      ...eComRateioBase,
      ...(modo === "relatorios" ? { demonstrativo: null } : {}),
      indices: eComRateioBase.consid?.indices,
    },
    historicoRateios,
  );
  const resultado = useMemo(
    () => calcularPrevisao(demonstrativoBase, paramsComHistorico, unidades),
    [demonstrativoBase, paramsComHistorico, unidades],
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

  /**
   * Trava o rateio: grava o valor aprovado no exercício, registra a linha no histórico
   * acumulativo (`historico_rateios`) e propaga o valor como `rateioAtual` do exercício seguinte,
   * quando ele existe e ainda não tem um informado.
   */
  async function aoTravar() {
    const aprovado = resultado.rateioSugerido;
    if (aprovado === null || e.fechado) return;
    const atualizado = prepararExercicio({ ...e, rateioAprovado: aprovado });
    setE(atualizado);
    try {
      const salvo = await api.salvar("exercicios", atualizado);
      const n = normalizarExercicio(salvo);
      setE(n);
      setSalvoJson(JSON.stringify(n));
      queryClient.invalidateQueries({ queryKey: chaves.lista("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);

      // Garante que rateioAtual esteja preenchido (herdado do ano anterior) antes de calcular
      // a variacao. Sem isso, calcularVariacao(null, 370) retorna null e o historico fica sem %.
      const nComRateioBase = aplicarRateioBase(n, historicoRateios);
      const linha = historicoDoExercicio(
        { ...nComRateioBase, rateioAprovado: aprovado },
        aprovado,
        "calculo",
        new Date().toISOString(),
      );
      const existente = historicoRateios.find(
        (h) => h.condoId === linha.condoId && Number(h.ano) === linha.ano,
      );
      await api.salvar("historico_rateios", { ...linha, id: existente?.id ?? novoId() });
      queryClient.invalidateQueries({ queryKey: chaves.lista("historico_rateios") });

      // Propaga como base do exercício seguinte, se ainda não tiver rateio atual.
      const proximo = exercicios.find(
        (x) =>
          x.condoId === e.condoId &&
          Number(x.ano) === Number(n.ano) + 1 &&
          (x.rateioAtual === null || x.rateioAtual === undefined),
      );
      if (proximo) {
        await api.salvar("exercicios", { ...proximo, rateioAtual: aprovado });
        queryClient.invalidateQueries({ queryKey: chaves.lista("exercicios") });
      }

      toast.success(
        proximo
          ? `Rateio de ${formatBRL(aprovado)} travado. Aplicado como base de ${proximo.ano}.`
          : `Rateio de ${formatBRL(aprovado)} travado no histórico.`,
      );
    } catch (erro) {
      // O rateio aprovado já foi gravado no exercício antes deste ponto; o que falhou foi o
      // histórico acumulativo. Dizer isso evita o usuário achar que nada foi salvo.
      toast.error(
        `Rateio aprovado salvo no exercício, mas o histórico não gravou: ${
          erro instanceof Error ? erro.message : "erro desconhecido."
        }`,
      );
    }
  }

  const periodo =
    demonstrativo.periodo.ini && demonstrativo.periodo.fim
      ? `${demonstrativo.periodo.ini} a ${demonstrativo.periodo.fim}`
      : null;

  if (modo === "relatorios") {
    return (
      <RelatorioPrevisao seletor={seletor} exercicio={e} resultado={resultado} periodo={periodo} demonstrativoBase={demonstrativoBase} />
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
            aoTravar={aoTravar}
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
  demonstrativoBase,
}: {
  seletor: ReactNode;
  exercicio: Exercicio;
  resultado: ReturnType<typeof calcularPrevisao>;
  periodo: string | null;
  demonstrativoBase: Demonstrativo | null;
}) {
  const [detalhado, setDetalhado] = useState(false);
  const [exportandoXlsx, setExportandoXlsx] = useState(false);
  const exportandoRef = useRef(false);
  // No modo relatórios:
  // - Realizado = despesas do exercício ATUAL (2026) → exercicio.demonstrativo
  // - Previsto = base anterior (2025) × fator (1 + variação%) → cálculo da previsão
  // - Variação = (Previsto − Realizado) / Realizado × 100
  const demonstrativoRealizado = exercicio.demonstrativo ?? demonstrativoVazio(exercicio.condoNome);
  const demonstrativoBaseRef = demonstrativoBase ?? demonstrativoVazio(exercicio.condoNome);
  const fator = 1 + resultado.variacaoPct / 100;

  const gruposRealizado = demonstrativoRealizado.despesas.grupos;
  const gruposBase = demonstrativoBaseRef.despesas.grupos;

  // Mapeia grupos da base (2025) por nome normalizado para aplicar o fator.
  const norm = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const mapaGruposBase = new Map(gruposBase.map((g) => [norm(g.nome), g]));

  // Itera sobre os grupos do REALIZADO (2026) e cruza com a base (2025) para gerar o PREVISTO.
  const linhas = gruposRealizado.flatMap((grupoReal) => {
    const grupoBase = mapaGruposBase.get(norm(grupoReal.nome));
    // Previsto do grupo = soma da base (2025) × fator — mesmo valor nos dois modos.
    const baseTotal = grupoBase
      ? grupoBase.itens.reduce((s, item) => s + (Number(item.valor) || 0), 0)
      : 0;
    const previstoGrupo = baseTotal * fator;
    const realizadoGrupo = grupoReal.itens.reduce(
      (s, item) => s + (Number(item.valor) || 0),
      0,
    );

    return detalhado
      ? (() => {
          // Distribui o previsto do grupo proporcionalmente ao peso de cada item
          // no realizado, garantindo que a soma dos itens bata com o total do grupo.
          const itensComRealizado = grupoReal.itens.map((itemReal) => ({
            itemReal,
            realizado: Number(itemReal.valor) || 0,
          }));
          const totalRealizadoItens = itensComRealizado.reduce(
            (s, it) => s + it.realizado,
            0,
          );
          let previstoAcumulado = 0;
          return itensComRealizado.map((it, idx) => {
            const realizado = it.realizado;
            let previsto: number;
            if (idx === itensComRealizado.length - 1) {
              // Último item recebe o restante para fechar o total do grupo.
              previsto = previstoGrupo - previstoAcumulado;
            } else if (totalRealizadoItens > 0) {
              previsto = (realizado / totalRealizadoItens) * previstoGrupo;
            } else {
              previsto = 0;
            }
            previstoAcumulado += previsto;
            const variacaoPct =
              realizado !== 0 ? ((previsto - realizado) / realizado) * 100 : 0;
            return {
              nome: it.itemReal.nome || "Sem nome",
              realizado,
              previsto,
              variacaoPct,
              grupo: grupoReal.nome,
            };
          });
        })()
      : [
          (() => {
            const realizado = realizadoGrupo;
            const previsto = previstoGrupo;
            const variacaoPct =
              realizado !== 0 ? ((previsto - realizado) / realizado) * 100 : 0;
            return {
              nome: grupoReal.nome || "Sem grupo",
              realizado,
              previsto,
              variacaoPct,
              grupo: grupoReal.nome,
            };
          })(),
        ];
  });

  const totalRealizado = linhas.reduce((s, linha) => s + linha.realizado, 0);
  const totalPrevisto = linhas.reduce((s, linha) => s + linha.previsto, 0);
  const variacaoGeralPct = totalRealizado > 0 ? ((totalPrevisto - totalRealizado) / totalRealizado) * 100 : (resultado.variacaoPct || 0);

  const dadosExportacao = linhas.map((linha) => ({
    Grupo: linha.grupo,
    Conta: linha.nome,
    Realizado: linha.realizado,
    Previsto: linha.previsto,
    "Variação (%)": Number(linha.variacaoPct.toFixed(2)),
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
          totalRealizado ? `${formatNumeroBR(variacaoGeralPct)}%` : "—",
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
                const variacao = linha.realizado
                  ? formatNumeroBR(linha.variacaoPct) + "%"
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
                        {formatBRL(linha.previsto)}
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
                    ? `${formatNumeroBR(variacaoGeralPct)}%`
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
