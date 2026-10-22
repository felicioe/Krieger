import { createFileRoute, Link, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DinheiroInput, InteiroInput } from "@/components/app/inputs";
import { EditorDemonstrativo } from "@/components/demonstrativo/EditorDemonstrativo";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { DialogoDivergencia } from "@/components/importacao/DialogoDivergencia";
import { BotaoDocumento } from "@/components/documentos/BotaoDocumento";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { divergenciasImportacao, origemComArquivo, type DivergenciaImportacao } from "@/domain/importacao";
import { competenciaMensal, normalizarMensal, prepararMensal, rotuloCompetencia, validarMensal } from "@/domain/mensal";
import { normalizarCondominio } from "@/domain/condominio";
import { documentoMensal } from "@/documentos/mensal";
import type { Condominio, ConfigEscritorio, Demonstrativo, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorio-mensal/$id")({
  head: () => cabecalho("Relatório mensal", "Demonstrativo do mês, contas a receber e notas explicativas."),
  loader: async ({ params, context: { queryClient } }) => {
    const [m] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Mensal>("mensais", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]);
    if (!m) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Relatório mensal não encontrado.</p>
      <Button variant="link" asChild>
        <Link to="/relatorio-mensal">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaMensal,
});

function PaginaMensal() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Mensal>("mensais", id));
  return <FormMensal key={id} inicial={normalizarMensal(data ?? { id })} />;
}

type Nota = Mensal["notas"][number];

function FormMensal({ inicial }: { inicial: Mensal }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [m, setM] = useState<Mensal>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [aba, setAba] = useState("demonstrativo");
  // Totais do PDF importado, guardados até o primeiro salvamento seguinte (trava de divergência).
  const [snapshotImportado, setSnapshotImportado] = useState<Demonstrativo | null>(null);
  const [divergencias, setDivergencias] = useState<DivergenciaImportacao[]>([]);
  const [confirmarDivergencia, setConfirmarDivergencia] = useState(false);

  const condo = condominios.find((c) => c.id === m.condoId);
  const demonstrativo = m.demonstrativo ?? demonstrativoVazio(m.condoNome);
  const competencia = competenciaMensal(m);
  const sujo = JSON.stringify(m) !== salvoJson;
  const mudar = (parcial: Partial<Mensal>) => setM((x) => ({ ...x, ...parcial }));

  // Rubricas do demonstrativo, sugeridas nas notas explicativas.
  const rubricas = [
    ...new Set([
      ...demonstrativo.receitas.itens.map((i) => i.nome),
      ...demonstrativo.despesas.grupos.flatMap((g) => g.itens.map((i) => i.nome)),
    ].filter(Boolean)),
  ];

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const liberado = useRef(false);
  useBlocker({
    shouldBlockFn: () =>
      !liberado.current &&
      sujoRef.current &&
      !window.confirm("Há alterações não salvas neste relatório mensal. Sair mesmo assim?"),
    enableBeforeUnload: () => !liberado.current && sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: (dados: Mensal) => api.salvar("mensais", dados),
    onSuccess: (salvo) => {
      const n = normalizarMensal(salvo);
      queryClient.invalidateQueries({ queryKey: chaves.lista("mensais") });
      queryClient.setQueryData(chaves.item("mensais", salvo.id), salvo);
      setM(n);
      setSalvoJson(JSON.stringify(n));
      toast.success("Relatório mensal salvo.");
      setSnapshotImportado(null);
    },
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir("mensais", m.id),
    onSuccess: () => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("mensais") });
      toast.success("Relatório mensal excluído.");
      navigate({ to: "/relatorio-mensal" });
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    const v = validarMensal(m.condoId, competencia, mensais, m.id);
    if (!v.ok) {
      toast.error(v.erro);
      setAba("demonstrativo");
      return;
    }
    if (snapshotImportado) {
      const d = divergenciasImportacao(snapshotImportado, m.demonstrativo ?? demonstrativoVazio(m.condoNome));
      if (d.length > 0) {
        setDivergencias(d);
        setConfirmarDivergencia(true);
        return;
      }
    }
    salvar.mutate(prepararMensal(m));
  }

  const nomeCondo = m.condoNome || condo?.nome || "";

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/relatorio-mensal">
              <ArrowLeft /> Relatório mensal
            </Link>
          </Button>
        }
        titulo={`Relatório mensal ${rotuloCompetencia(competencia)}`}
        descricao={nomeCondo}
        acoes={
          <>
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <BotaoDocumento
              gerar={() => documentoMensal({ mensal: m, condominio: condo ? normalizarCondominio(condo) : null, escritorio })}
              bloqueio={sujo ? "Salve o relatório antes de gerar o documento." : null}
              rotulo="Gerar relatório"
            />
            <ImportarPdf
              modo="editor"
              destino="mensais"
              condominio={condo}
              nomeCondominio={nomeCondo}
              aoAplicar={(r) => {
                mudar({
                  demonstrativo: r.demonstrativo,
                  ...(r.receber ? { receber: r.receber } : {}),
                  origem: origemComArquivo(m.origem, r.arquivo),
                });
                setSnapshotImportado(r.demonstrativo);
                setAba("demonstrativo");
              }}
            />
            <Button variant="outline" type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:text-destructive">
              <Trash2 /> Excluir
            </Button>
            <Button type="submit" form="form-mensal" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      <form id="form-mensal" onSubmit={enviar} noValidate>
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="h-10 bg-secondary">
            <TabsTrigger value="demonstrativo" className="px-4">Demonstrativo</TabsTrigger>
            <TabsTrigger value="receber" className="px-4">Contas a receber</TabsTrigger>
            <TabsTrigger value="notas" className="px-4">
              Notas explicativas
              {m.notas.length > 0 && <span className="num ml-1.5 text-xs text-muted-foreground">({m.notas.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demonstrativo" className="mt-4">
            <EditorDemonstrativo
              valor={demonstrativo}
              onChange={(d) => mudar({ demonstrativo: d })}
              descricaoDespesas="Organize as despesas por grupo (Pessoal, Consumo, Manutenção…). Os mesmos nomes da previsão facilitam o Previsto × Realizado."
            />
          </TabsContent>

          <TabsContent value="receber" className="mt-4">
            <SectionCard titulo="Contas a receber" descricao={`Inadimplência do condomínio ao fim de ${rotuloCompetencia(competencia)}.`}>
              <div className="grid max-w-lg gap-4 sm:grid-cols-2">
                <Field rotulo="Unidades inadimplentes" {...(condo?.unidades ? { dica: `De ${condo.unidades} unidades.` } : {})}>
                  <InteiroInput
                    value={m.receber.unidades}
                    onChange={(v) => mudar({ receber: { ...m.receber, unidades: v } })}
                  />
                </Field>
                <Field rotulo="Valor total a receber">
                  <DinheiroInput value={m.receber.valor} onChange={(v) => mudar({ receber: { ...m.receber, valor: v } })} />
                </Field>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <SectionCard titulo="Notas explicativas" descricao="Esclarecimentos sobre rubricas do mês (reajustes, despesas extraordinárias etc.).">
              <datalist id="rubricas-mes">
                {rubricas.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <RepeatableList<Nota>
                itens={m.notas}
                onChange={(notas) => mudar({ notas })}
                novo={() => ({ rubrica: "", texto: "", valor: null })}
                colunas="grid-cols-1 @xs:grid-cols-[minmax(0,1fr)_9rem] @2xl:grid-cols-[minmax(0,1fr)_11rem]"
                cabecalhos={["Rubrica", "Valor"]}
                rotuloAdicionar="Adicionar nota"
                vazio="Nenhuma nota explicativa neste mês."
                render={(n, up) => (
                  <>
                    <Input
                      aria-label="Rubrica"
                      placeholder="Rubrica"
                      list="rubricas-mes"
                      value={n.rubrica}
                      onChange={(e) => up({ rubrica: e.target.value })}
                    />
                    <DinheiroInput aria-label="Valor" value={n.valor} onChange={(v) => up({ valor: v })} />
                    <Textarea
                      aria-label="Texto da nota"
                      placeholder="Texto da nota explicativa"
                      value={n.texto}
                      onChange={(e) => up({ texto: e.target.value })}
                      rows={2}
                      className="col-span-2 mb-2"
                    />
                  </>
                )}
              />
            </SectionCard>
          </TabsContent>
        </Tabs>
      </form>

      <DialogoDivergencia
        aberto={confirmarDivergencia}
        aoMudar={setConfirmarDivergencia}
        divergencias={divergencias}
        aoConfirmar={() => salvar.mutateAsync(prepararMensal(m)).then(() => setSnapshotImportado(null))}
      />

      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir relatório mensal?"
        descricao={`O relatório de ${rotuloCompetencia(competencia)} de ${nomeCondo} será excluído. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
