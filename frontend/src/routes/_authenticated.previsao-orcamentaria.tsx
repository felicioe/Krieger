import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FileSpreadsheet, Loader2, RefreshCw, Save } from "lucide-react";
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
import { normalizarExercicio, prepararExercicio } from "@/domain/exercicio";
import { calcularPrevisao } from "@/domain/previsao";
import { demonstrativoDoPeriodo } from "@/domain/demonstrativoDinamico";
import type { Condominio, Exercicio, Mensal } from "@/domain/types";

type Busca = { exercicio?: string };

export const Route = createFileRoute("/_authenticated/previsao-orcamentaria")({
  head: () =>
    cabecalho(
      "Previsão orçamentária",
      "Previsão orçamentária sugerida do exercício, com deduções e variação editáveis.",
    ),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const exercicio = s["exercicio"];
    return typeof exercicio === "string" && exercicio ? { exercicio } : {};
  },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
    ]),
  component: PaginaPrevisao,
});

function PaginaPrevisao() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/previsao-orcamentaria" });
  const { data: exerciciosRaw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais, refetch: atualizarMensais, isFetching: atualizandoMensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));

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

  if (!exercicio) {
    return (
      <>
        <PageHeader
          titulo="Previsão orçamentária"
          descricao="Previsão orçamentária de cada prestação de contas."
        />
        <SectionCard titulo="Nenhuma prestação de contas">
          <p className="text-sm text-muted-foreground">
            Crie uma prestação de contas ou importe os relatórios mensais para montar a previsão
            orçamentária.
          </p>
          <Button asChild className="mt-4">
            <Link to="/prestacao-contas">Ir para Prestação de contas</Link>
          </Button>
        </SectionCard>
      </>
    );
  }

  const nomeCondo = (e: Exercicio) =>
    e.condoNome || condominios.find((c) => c.id === e.condoId)?.nome || "Sem condomínio";
  const opcoes = exercicios.map((e) => ({
    valor: e.id,
    rotulo: `${nomeCondo(e)} · exercício ${e.ano}`,
  }));
  const seletor = (
    <Field rotulo="Prestação de contas" className="max-w-xl">
      <Selecao
        value={exercicio.id}
        onChange={(id) => navigate({ search: { exercicio: id }, replace: true })}
        opcoes={opcoes}
      />
    </Field>
  );

  // Exercício anterior do mesmo condomínio — a base da sugestão de variação (desvio entre o que
  // ele projetou pra este ano e o que este ano realmente realizou). Sem esse exercício, ou sem
  // despesas lançadas em nenhum dos dois, não há sugestão (calcularDesvioAnoAnterior devolve null).
  const exercicioAnterior = exercicios.find(
    (x) => x.condoId === exercicio.condoId && Number(x.ano) === Number(exercicio.ano) - 1,
  );

  return (
    <EditorPrevisao
      key={exercicio.id}
      inicial={exercicio}
      condominio={condominios.find((c) => c.id === exercicio.condoId)}
      mensais={mensais}
      atualizarMensais={atualizarMensais}
      atualizandoMensais={atualizandoMensais}
      exercicioAnterior={exercicioAnterior}
      seletor={seletor}
    />
  );
}

function EditorPrevisao({
  inicial,
  condominio,
  mensais,
  atualizarMensais,
  atualizandoMensais,
  exercicioAnterior,
  seletor,
}: {
  inicial: Exercicio;
  condominio: Condominio | undefined;
  mensais: Mensal[];
  atualizarMensais: () => Promise<unknown>;
  atualizandoMensais: boolean;
  exercicioAnterior: Exercicio | undefined;
  seletor: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [e, setE] = useState<Exercicio>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const sujo = JSON.stringify(e) !== salvoJson;
  const unidades = condominio?.unidades ?? null;
  const demonstrativo = e.demonstrativo ?? demonstrativoVazio(e.condoNome);
  // A previsão da nova prestação nasce do realizado da prestação anterior. O demonstrativo
  // atual continua sendo usado pelos relatórios e pelo comparativo, mas não deve substituir a
  // base histórica do orçamento novo.
  const demonstrativoBase = useMemo(
    () => demonstrativoDoPeriodo(demonstrativo, mensais, e.condoId),
    [demonstrativo, mensais, e.condoId],
  );
  const parametrosBase = useMemo(
    () => ({
      ...e,
      indices: e.consid.indices,
      prev: {
        ...(e.prev ?? { modo: "tradicional", ajustes: [], fundoReservaPct: null }),
        // Ajustes feitos na prestação anterior corrigem a base do novo exercício.
        // Os índices e demais parâmetros continuam sendo os do exercício atual.
        ajustes: [...(exercicioAnterior?.prev?.ajustes ?? []), ...(e.prev?.ajustes ?? [])],
      },
    }),
    [e, exercicioAnterior],
  );
  const mudar = (parcial: Partial<Exercicio>) => setE((x) => ({ ...x, ...parcial }));

  const resultado = useMemo(
    () => calcularPrevisao(demonstrativoBase, parametrosBase, unidades),
    [demonstrativoBase, parametrosBase, unidades],
  );
  const rateioAnterior = useMemo(
    () =>
      exercicioAnterior?.rateioAprovado ?? exercicioAnterior?.rateioAtual ?? null,
    [exercicioAnterior?.rateioAprovado, exercicioAnterior?.rateioAtual],
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
    salvar.mutate(prepararExercicio(e));
  }

  const periodo =
    demonstrativo.periodo.ini && demonstrativo.periodo.fim
      ? `${demonstrativo.periodo.ini} a ${demonstrativo.periodo.fim}`
      : null;

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
            <Button variant="outline" asChild>
              <Link to="/prestacao-contas/$id" params={{ id: e.id }}>
                <FileSpreadsheet /> Prestação de contas
              </Link>
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void atualizarMensais().then(() => toast.success("Dados mensais atualizados."))}
              disabled={atualizandoMensais}
              title="Ler novamente os relatórios mensais importados"
            >
              {atualizandoMensais ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Atualizar dados
            </Button>
            <Button
              permissao="previsao_orcamentaria.editar"
              type="submit"
              form="form-previsao"
              disabled={salvar.isPending}
            >
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
          grupos={demonstrativoBase.despesas.grupos.map((g) => g.nome)}
          onChange={mudar}
          rotuloBase={exercicioAnterior ? "Base (realizado do exercício anterior)" : undefined}
          rateioAnterior={rateioAnterior}
        />
      </form>
    </>
  );
}
