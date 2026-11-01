import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FileSpreadsheet, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { PainelPrevisao } from "@/components/previsao/PainelPrevisao";
import { PainelPrevisaoSugerida } from "@/components/previsao/PainelPrevisaoSugerida";
import { api } from "@/lib/api";
import { chaves, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { novoId } from "@/lib/id";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { normalizarExercicio, prepararExercicio } from "@/domain/exercicio";
import { calcularPrevisao } from "@/domain/previsao";
import { calcularPrevisaoSugerida, calcularPrevisaoSugeridaPorUnidade, chaveDivergencia, compararComTotaisPdf } from "@/domain/previsaoSugerida";
import type { Condominio, DecisaoDivergenciaPrevisao, Exercicio } from "@/domain/types";

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

  return (
    <EditorPrevisao
      key={exercicio.id}
      inicial={exercicio}
      condominio={condominios.find((c) => c.id === exercicio.condoId)}
      seletor={seletor}
    />
  );
}

function EditorPrevisao({
  inicial,
  condominio,
  seletor,
}: {
  inicial: Exercicio;
  condominio: Condominio | undefined;
  seletor: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [e, setE] = useState<Exercicio>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const sujo = JSON.stringify(e) !== salvoJson;
  const unidades = condominio?.unidades ?? null;
  const demonstrativo = e.demonstrativo ?? demonstrativoVazio(e.condoNome);
  const [aba, setAba] = useState(e.previsaoSugerida ? "sugerida" : "demonstrativo");
  const mudar = (parcial: Partial<Exercicio>) => setE((x) => ({ ...x, ...parcial }));

  const resultado = useMemo(
    () => calcularPrevisao(e.demonstrativo, { ...e, indices: e.consid.indices }, unidades),
    [e, unidades],
  );

  // Só para avisar no topo que o resultado da aba aberta está incompleto (não muda o Salvar).
  const valorUnidadeSugerida = useMemo(() => {
    if (!e.previsaoSugerida) return null;
    const rs = calcularPrevisaoSugerida(e.previsaoSugerida);
    return calcularPrevisaoSugeridaPorUnidade(rs.rateioMensalSugerido, unidades, e.prev?.fundoReservaPct ?? 0, e.arredondamento).valorUnidade;
  }, [e.previsaoSugerida, unidades, e.prev?.fundoReservaPct, e.arredondamento]);
  const parcial = aba === "sugerida" ? !!e.previsaoSugerida && valorUnidadeSugerida === null : resultado.rateioSugerido === null;

  // Divergência entre os totais do PDF (congelados em previsaoSugerida.totaisPdf) e o recalculado a
  // partir das categorias/deduções/variação atuais — "em conferência" até confirmar (não bloqueia o
  // Salvar; só sinaliza, aqui e na lista de Prestação de contas).
  const divergenciasPv = useMemo(() => {
    if (!e.previsaoSugerida) return [];
    return compararComTotaisPdf(calcularPrevisaoSugerida(e.previsaoSugerida), e.previsaoSugerida.totaisPdf);
  }, [e.previsaoSugerida]);
  const chaveDivergenciaAtual = useMemo(() => chaveDivergencia(divergenciasPv), [divergenciasPv]);
  const decisao = e.previsaoSugerida?.decisaoDivergencia;
  const emConferencia = divergenciasPv.length > 0 && !(decisao?.chave === chaveDivergenciaAtual && decisao.status === "confirmado");
  const chaveDecisaoAntesDoSalvar = useRef<string | null>(null);

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
      const decidida = n.previsaoSugerida?.decisaoDivergencia;
      if (decidida && decidida.chave !== chaveDecisaoAntesDoSalvar.current) {
        const campos = compararComTotaisPdf(calcularPrevisaoSugerida(n.previsaoSugerida!), n.previsaoSugerida!.totaisPdf);
        if (campos.length > 0) {
          api
            .salvar<DecisaoDivergenciaPrevisao>("decisoes_previsao", {
              id: novoId(),
              condoId: n.condoId,
              condoNome: n.condoNome || condominio?.nome || "",
              exercicioId: n.id,
              ano: n.ano,
              campos,
              status: decidida.status,
              decididoPor: decidida.por,
              decididoPorNome: decidida.porNome,
              decididoEm: decidida.em,
            })
            .then(() => queryClient.invalidateQueries({ queryKey: chaves.lista("decisoes_previsao") }))
            .catch(() => undefined); // não bloqueia o salvamento da previsão; só o log de auditoria falharia
        }
      }
      setE(n);
      setSalvoJson(JSON.stringify(n));
      toast.success("Previsão orçamentária salva.");
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    chaveDecisaoAntesDoSalvar.current = (JSON.parse(salvoJson) as Exercicio).previsaoSugerida?.decisaoDivergencia?.chave ?? null;
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
            {emConferencia && (
              <Badge variant="warning" title='Ver a aba "Sugerida pelo Systemar" para revisar e decidir.'>
                Em conferência
              </Badge>
            )}
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
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
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="h-auto min-h-10 max-w-full flex-wrap justify-start bg-secondary">
            <TabsTrigger value="sugerida" className="whitespace-normal px-4">Sugerida pelo Systemar</TabsTrigger>
            <TabsTrigger value="demonstrativo" className="whitespace-normal px-4">Calculada pelo demonstrativo</TabsTrigger>
          </TabsList>
          <TabsContent value="sugerida" className="mt-4">
            {e.previsaoSugerida ? (
              <PainelPrevisaoSugerida
                exercicio={e}
                previsao={e.previsaoSugerida}
                unidades={unidades}
                condoId={e.condoId}
                onChange={mudar}
              />
            ) : (
              <SectionCard titulo="Sem previsão sugerida">
                <p className="text-sm text-muted-foreground">
                  Esta prestação de contas não tem a folha “Previsão orçamentária ordinária sugerida” do Systemar. Use “Importar PDF”
                  na prestação de contas com o relatório que traz essa folha, ou trabalhe na aba “Calculada pelo demonstrativo”.
                </p>
                <Button variant="outline" asChild className="mt-4">
                  <Link to="/prestacao-contas/$id" params={{ id: e.id }}>
                    Abrir a prestação de contas
                  </Link>
                </Button>
              </SectionCard>
            )}
          </TabsContent>
          <TabsContent value="demonstrativo" className="mt-4">
            <PainelPrevisao
              exercicio={e}
              resultado={resultado}
              unidades={unidades}
              condoId={e.condoId}
              grupos={demonstrativo.despesas.grupos.map((g) => g.nome)}
              onChange={mudar}
            />
          </TabsContent>
        </Tabs>
      </form>
    </>
  );
}
