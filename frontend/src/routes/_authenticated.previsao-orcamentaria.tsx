import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleHelp, FileSpreadsheet, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { PainelPrevisao } from "@/components/previsao/PainelPrevisao";
import { api } from "@/lib/api";
import { chaves, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { encontrarExercicioAnterior, normalizarExercicio, prepararExercicio } from "@/domain/exercicio";
import { calcularDesvioAnoAnterior, calcularPrevisao, demonstrativoBasePrevisao } from "@/domain/previsao";
import type { Condominio, Demonstrativo, Exercicio } from "@/domain/types";

type Busca = { exercicio?: string };

export const Route = createFileRoute("/_authenticated/previsao-orcamentaria")({
  head: () => cabecalho("Previsão orçamentária", "Previsão orçamentária sugerida do exercício, com deduções e variação editáveis."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const exercicio = s["exercicio"];
    return typeof exercicio === "string" && exercicio ? { exercicio } : {};
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
        .sort((a, b) => Number(b.ano) - Number(a.ano) || a.condoNome.localeCompare(b.condoNome, "pt-BR")),
    [exerciciosRaw],
  );
  const exercicio = exercicios.find((e) => e.id === busca.exercicio) ?? exercicios[0];

  if (!exercicio) {
    return (
      <>
        <PageHeader titulo="Previsão orçamentária" descricao="Previsão orçamentária de cada prestação de contas." />
        <SectionCard titulo="Nenhuma prestação de contas">
          <p className="text-sm text-muted-foreground">
            Crie uma prestação de contas (ou importe o PDF do Systemar) para montar a previsão orçamentária.
          </p>
          <Button asChild className="mt-4">
            <Link to="/prestacao-contas">Ir para Prestação de contas</Link>
          </Button>
        </SectionCard>
      </>
    );
  }

  const nomeCondo = (e: Exercicio) => e.condoNome || condominios.find((c) => c.id === e.condoId)?.nome || "Sem condomínio";
  const opcoes = exercicios.map((e) => ({
    valor: e.id,
    rotulo: `${nomeCondo(e)} · exercício ${e.ano}${e.previsaoSugerida ? "" : " (sem previsão do Systemar)"}`,
  }));
  const seletor = (
    <Field rotulo="Prestação de contas" className="max-w-xl">
      <Selecao value={exercicio.id} onChange={(id) => navigate({ search: { exercicio: id }, replace: true })} opcoes={opcoes} />
    </Field>
  );

  // Exercício anterior do mesmo condomínio — base da previsão (ver `demonstrativoBasePrevisao`) e
  // da sugestão de variação (desvio entre o que ele projetou pra este ano e o que este ano
  // realmente realizou). Sem esse exercício, ou sem despesas lançadas em nenhum dos dois, não há
  // sugestão (calcularDesvioAnoAnterior devolve null).
  const exercicioAnterior = encontrarExercicioAnterior(exercicios, exercicio);
  // A "última previsão" e a sugestão de variação recalculam a previsão do PRÓPRIO exercício
  // anterior — e essa previsão segue a mesma regra: parte do realizado do anterior DELE, não do
  // seu próprio demonstrativo (achado do Codex no PR #170: com três exercícios em sequência, usar
  // o demonstrativo do próprio exercício anterior repete a mesma divergência que a troca de base
  // corrigiu no exercício atual).
  const demonstrativoBaseAnterior = exercicioAnterior
    ? demonstrativoBasePrevisao(exercicioAnterior, encontrarExercicioAnterior(exercicios, exercicioAnterior))
    : null;

  return (
    <EditorPrevisao
      key={exercicio.id}
      inicial={exercicio}
      condominio={condominios.find((c) => c.id === exercicio.condoId)}
      exercicioAnterior={exercicioAnterior}
      demonstrativoBaseAnterior={demonstrativoBaseAnterior}
      seletor={seletor}
    />
  );
}

function EditorPrevisao({
  inicial,
  condominio,
  exercicioAnterior,
  demonstrativoBaseAnterior,
  seletor,
}: {
  inicial: Exercicio;
  condominio: Condominio | undefined;
  exercicioAnterior: Exercicio | undefined;
  /** Base pra recalcular a previsão do PRÓPRIO exercício anterior (ver `demonstrativoBasePrevisao`) —
   * nunca o demonstrativo dele mesmo, senão "última previsão" e a sugestão repetem a divergência
   * que a troca de base corrigiu no exercício atual. */
  demonstrativoBaseAnterior: Demonstrativo | null;
  seletor: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [e, setE] = useState<Exercicio>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const sujo = JSON.stringify(e) !== salvoJson;
  const unidades = condominio?.unidades ?? null;
  const demonstrativo = e.demonstrativo ?? demonstrativoVazio(e.condoNome);
  const mudar = (parcial: Partial<Exercicio>) => setE((x) => ({ ...x, ...parcial }));

  // A base é o realizado do exercício ANTERIOR (fechado) — nunca o demonstrativo do próprio
  // exercício em edição, que vai sendo preenchido ao longo do ano e não pode servir de base móvel
  // pra uma previsão que precisa ficar estável. Sem exercício anterior (primeira prestação do
  // condomínio), cai no comportamento antigo (usa o próprio demonstrativo).
  const demonstrativoBase = demonstrativoBasePrevisao(e, exercicioAnterior);
  const resultado = useMemo(
    () => calcularPrevisao(demonstrativoBase, { ...e, indices: e.consid.indices }, unidades),
    [demonstrativoBase, e, unidades],
  );

  // Última previsão já aprovada para este exercício: o que o exercício anterior projetou, com os
  // parâmetros (variação/ajustes) que ELE já tinha confirmado — referência fixa, não recalculada
  // com os parâmetros (ainda não confirmados) do exercício atual.
  const ultimaPrevisao = useMemo(
    () =>
      exercicioAnterior
        ? calcularPrevisao(demonstrativoBaseAnterior, { ...exercicioAnterior, indices: exercicioAnterior.consid.indices }, null).totalAnual
        : null,
    [exercicioAnterior, demonstrativoBaseAnterior],
  );

  // Sugestão (nunca aplicada sozinha) de variação pro exercício seguinte: desvio entre o previsto
  // que o exercício anterior calculou pra este ano e o que este ano realmente gastou.
  const desvio = useMemo(
    () =>
      exercicioAnterior
        ? calcularDesvioAnoAnterior(
            demonstrativoBaseAnterior,
            { ...exercicioAnterior, indices: exercicioAnterior.consid.indices },
            e.demonstrativo,
          )
        : null,
    [exercicioAnterior, demonstrativoBaseAnterior, e.demonstrativo],
  );

  const parcial = resultado.rateioSugerido === null;

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  useBlocker({
    shouldBlockFn: () => sujoRef.current && !window.confirm("Há alterações não salvas nesta previsão orçamentária. Sair mesmo assim?"),
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
    salvar.mutate(prepararExercicio(e));
  }

  const periodo = demonstrativo.periodo.ini && demonstrativo.periodo.fim ? `${demonstrativo.periodo.ini} a ${demonstrativo.periodo.fim}` : null;

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
              <Badge variant="warning" title="Falta dado para o valor por unidade. Salvar continua permitido.">
                Resultado parcial
              </Badge>
            )}
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <Button variant="ghost" size="icon" asChild title="Ajuda sobre esta tela">
              <Link to="/ajuda" search={{ secao: "previsao-orcamentaria" }} aria-label="Ajuda sobre a previsão orçamentária">
                <CircleHelp />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/prestacao-contas/$id" params={{ id: e.id }}>
                <FileSpreadsheet /> Prestação de contas
              </Link>
            </Button>
            <Button permissao="previsao_orcamentaria.editar" type="submit" form="form-previsao" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      <SectionCard className="mb-6">{seletor}</SectionCard>

      <form id="form-previsao" onSubmit={enviar} noValidate>
        <PainelPrevisao
              exercicio={e}
              resultado={resultado}
              unidades={unidades}
              condoId={e.condoId}
              grupos={demonstrativoBase?.despesas.grupos.map((g) => g.nome) ?? []}
              onChange={mudar}
              desvio={desvio}
              anoAnterior={exercicioAnterior?.ano}
              ultimaPrevisao={ultimaPrevisao}
        />
      </form>
    </>
  );
}
