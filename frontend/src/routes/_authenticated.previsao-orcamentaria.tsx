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
import { opcoesCondominio, Selecao, SelecaoBusca } from "@/components/app/inputs";
import { PainelPrevisao } from "@/components/previsao/PainelPrevisao";
import { api } from "@/lib/api";
import { chaves, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { normalizarExercicio, prepararExercicio } from "@/domain/exercicio";
import { calcularPrevisao } from "@/domain/previsao";
import type { Condominio, Exercicio } from "@/domain/types";

type Busca = { exercicio?: string; modo?: "rateio" | "relatorios" };

export const Route = createFileRoute("/_authenticated/previsao-orcamentaria")({
  head: () => cabecalho("Previsão orçamentária", "Previsão orçamentária sugerida do exercício, com deduções e variação editáveis."),
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
    if (primeira) void navigate({ search: { exercicio: primeira.id }, replace: true });
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
          onChange={(id) => void navigate({ search: { exercicio: id }, replace: true })}
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
      condominio={condominios.find((c) => c.id === exercicio.condoId)}
      seletor={seletor}
      modo={busca.modo ?? "rateio"}
    />
  );
}

function EditorPrevisao({
  inicial,
  condominio,
  seletor,
  modo,
}: {
  inicial: Exercicio;
  condominio: Condominio | undefined;
  seletor: ReactNode;
  modo: "rateio" | "relatorios";
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
  const resultado = useMemo(
    () => calcularPrevisao(demonstrativo, { ...e, indices: e.consid.indices }, unidades),
    [demonstrativo, e, unidades],
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
        titulo={`${modo === "relatorios" ? "Previsão para relatórios" : "Previsão orçamentária"} — Exercício ${e.ano}`}
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

      {modo === "relatorios" && (
        <SectionCard className="mb-6" titulo="Previsão efetiva dos relatórios" descricao="Mantenha aqui os valores previstos que serão comparados ao realizado nos relatórios Previsto × Realizado.">
          <p className="text-sm text-muted-foreground">Esta tela usa a mesma previsão salva do exercício, sem alterar a apuração do percentual de rateio. Ajustes feitos aqui refletem nos relatórios previstos x realizados após salvar.</p>
        </SectionCard>
      )}

      <form id="form-previsao" onSubmit={enviar} noValidate>
        <PainelPrevisao
              exercicio={e}
              resultado={resultado}
              unidades={unidades}
              condoId={e.condoId}
              onChange={mudar}
        />
      </form>
    </>
  );
}
