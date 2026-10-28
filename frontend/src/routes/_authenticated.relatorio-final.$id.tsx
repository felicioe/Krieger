import { createFileRoute, Link, notFound, useBlocker } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, FileCheck2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { DataInput, Selecao } from "@/components/app/inputs";
import { PreviaRelatorio } from "@/components/relatorio/PreviaRelatorio";
import { EditorConsideracoes } from "@/components/relatorio/EditorConsideracoes";
import { DialogoConferencia } from "@/components/relatorio/DialogoConferencia";
import { api } from "@/lib/api";
import { baixarDocumento, ROTULO_FORMATO, type Formato } from "@/lib/documento/baixar";
import { documentoRelatorioFinal } from "@/documentos/relatorioFinal";
import { useUsuario } from "@/lib/auth";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { formatDataHora } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { normalizarCondominio } from "@/domain/condominio";
import { normalizarExercicio, prepararExercicio } from "@/domain/exercicio";
import { alternarSecao, montarRelatorioFinal, SECOES } from "@/domain/relatorioFinal";
import type { Condominio, ConfigEscritorio, Exercicio, Mensal } from "@/domain/types";
import { contagem, palavra } from "@/components/app/textos";

export const Route = createFileRoute("/_authenticated/relatorio-final/$id")({
  head: () => cabecalho("Relatório final", "Montagem e conferência do relatório final da prestação de contas."),
  loader: async ({ params, context: { queryClient } }) => {
    const [e] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Exercicio>("exercicios", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]);
    if (!e) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Prestação de contas não encontrada.</p>
      <Button variant="link" asChild>
        <Link to="/prestacao-contas">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaRelatorio,
});

function PaginaRelatorio() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Exercicio>("exercicios", id));
  return <EditorRelatorio key={id} inicial={normalizarExercicio(data ?? { id })} />;
}

function EditorRelatorio({ inicial }: { inicial: Exercicio }) {
  const queryClient = useQueryClient();
  const usuario = useUsuario();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [e, setE] = useState<Exercicio>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const [aba, setAba] = useState("previa");
  const [conferir, setConferir] = useState(false);

  const condoRaw = condominios.find((c) => c.id === e.condoId);
  const condo = useMemo(() => (condoRaw ? normalizarCondominio(condoRaw) : null), [condoRaw]);
  const rel = useMemo(() => montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio, mensais }), [e, condo, escritorio, mensais]);
  const sujo = JSON.stringify(e) !== salvoJson;
  const mudar = (parcial: Partial<Exercicio>) => setE((x) => ({ ...x, ...parcial }));

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  useBlocker({
    shouldBlockFn: () => sujoRef.current && !window.confirm("Há alterações não salvas no relatório. Sair mesmo assim?"),
    enableBeforeUnload: () => sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: (v: { dados: Exercicio; mensagem: string }) => api.salvar("exercicios", v.dados),
    onSuccess: (salvo, { mensagem }) => {
      const n = normalizarExercicio(salvo);
      queryClient.invalidateQueries({ queryKey: chaves.lista("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);
      setE(n);
      setSalvoJson(JSON.stringify(n));
      toast.success(mensagem);
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    salvar.mutate({ dados: prepararExercicio(e), mensagem: "Relatório salvo." });
  }

  async function emitir(formato: Formato) {
    const doc = await documentoRelatorioFinal({ rel, exercicio: e, condominio: condo, escritorio });
    await salvar.mutateAsync({
      dados: prepararExercicio({
        ...e,
        relatorioFinal: { ...e.relatorioFinal, emitidoEm: new Date().toISOString(), emitidoPor: usuario?.nome || usuario?.login || "" },
      }),
      mensagem: `Relatório emitido em ${ROTULO_FORMATO[formato]}.`,
    });
    try {
      await baixarDocumento(doc, formato);
    } catch (erro) {
      console.error(erro);
      toast.error(`A emissão foi registrada, mas não foi possível gerar o ${ROTULO_FORMATO[formato]}. Tente emitir de novo.`);
    }
  }

  const opcoesMes = rel.comparativo.meses.map((m) => ({
    valor: String(m.posicao),
    rotulo: `${m.rotulo}${m.relatorios === 0 ? " (sem relatório)" : ""}`,
  }));
  const emitidoEm = e.relatorioFinal?.emitidoEm;

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto min-h-0 p-0 text-muted-foreground" asChild>
            <Link to="/prestacao-contas/$id" params={{ id: e.id }}>
              <ArrowLeft /> Prestação de contas {e.ano}
            </Link>
          </Button>
        }
        titulo={`Relatório final · Exercício ${e.ano}`}
        descricao={
          <>
            {e.condoNome || condo?.nome}
            {emitidoEm && (
              <span className="ml-2">
                · Emitido em <span className="num">{formatDataHora(emitidoEm)}</span>
                {e.relatorioFinal?.emitidoPor ? ` por ${e.relatorioFinal.emitidoPor}` : ""}
              </span>
            )}
          </>
        }
        acoes={
          <>
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <Button variant="outline" type="submit" form="form-relatorio" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
            <Button type="button" onClick={() => setConferir(true)} disabled={salvar.isPending}>
              <FileCheck2 /> Conferir e emitir
            </Button>
          </>
        }
      />

      <form id="form-relatorio" onSubmit={enviar} noValidate>
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="h-10 bg-secondary">
            <TabsTrigger value="previa" className="px-4">Seções e prévia</TabsTrigger>
            <TabsTrigger value="consideracoes" className="px-4">Considerações finais</TabsTrigger>
          </TabsList>

          <TabsContent value="previa" className="mt-4">
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[18rem_minmax(0,1fr)]">
              <aside className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-3 2xl:sticky 2xl:top-4 2xl:grid-cols-1 2xl:self-start">
                <SectionCard titulo="Seções">
                  <ul className="space-y-2.5 max-md:space-y-0 pointer-coarse:space-y-0">
                    {SECOES.map((s) => (
                      <li key={s.id}>
                        <div className="flex items-center gap-2 max-md:min-h-11 max-md:gap-3 pointer-coarse:min-h-11 pointer-coarse:gap-3">
                          <Checkbox
                            id={`secao-${s.id}`}
                            checked={rel.secoes[s.id]}
                            onCheckedChange={(v) => mudar(alternarSecao(e, s.id, v === true))}
                          />
                          <Label htmlFor={`secao-${s.id}`} className="min-w-0 break-words text-sm font-normal">
                            {s.titulo}
                          </Label>
                        </div>
                        {s.id === "previstoRealizado" && rel.secoes.previstoRealizado && (
                          <div className="ml-6 mt-1.5 flex items-center gap-2 max-md:mt-0 max-md:min-h-11 max-md:gap-3 pointer-coarse:mt-0 pointer-coarse:min-h-11 pointer-coarse:gap-3">
                            <Checkbox
                              id="secao-contas-analiticas"
                              checked={e.mostrarContasAnaliticas !== false}
                              onCheckedChange={(v) => mudar({ mostrarContasAnaliticas: v === true })}
                            />
                            <Label htmlFor="secao-contas-analiticas" className="min-w-0 break-words text-xs font-normal text-muted-foreground">
                              Mostrar contas analíticas (desmarcado: só os totais por grupo)
                            </Label>
                          </div>
                        )}
                        {s.id === "analise" && rel.secoes.analise && (
                          <div className="ml-6 mt-1.5 flex items-center gap-2 max-md:mt-0 max-md:min-h-11 max-md:gap-3 pointer-coarse:mt-0 pointer-coarse:min-h-11 pointer-coarse:gap-3">
                            <Checkbox id="secao-pizza" checked={e.mostrarPizza !== false} onCheckedChange={(v) => mudar({ mostrarPizza: v === true })} />
                            <Label htmlFor="secao-pizza" className="min-w-0 break-words text-xs font-normal text-muted-foreground">
                              Pizza das despesas por grupo
                            </Label>
                          </div>
                        )}
                        {s.id === "analise" && rel.secoes.analise && (
                          <div className="ml-6 mt-1.5 flex items-center gap-2 max-md:mt-0 max-md:min-h-11 max-md:gap-3 pointer-coarse:mt-0 pointer-coarse:min-h-11 pointer-coarse:gap-3">
                            <Checkbox
                              id="secao-evolucao-mensal"
                              checked={e.mostrarEvolucaoMensal !== false}
                              onCheckedChange={(v) => mudar({ mostrarEvolucaoMensal: v === true })}
                            />
                            <Label htmlFor="secao-evolucao-mensal" className="min-w-0 break-words text-xs font-normal text-muted-foreground">
                              Evolução mensal (receitas, despesas, saldo)
                            </Label>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard titulo="Capa e assinatura">
                  <div className="grid grid-cols-1 gap-3">
                    <Field rotulo="Cidade">
                      <Input value={e.cidade} onChange={(ev) => mudar({ cidade: ev.target.value })} />
                    </Field>
                    <Field rotulo="Data de emissão">
                      <DataInput value={e.dataEmissao} onChange={(v) => mudar({ dataEmissao: v })} />
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Nome, assinatura e logo vêm do{" "}
                      <Link to="/escritorio" className="text-primary underline underline-offset-2 hover:decoration-2">
                        cadastro do Escritório
                      </Link>
                      .
                    </p>
                  </div>
                </SectionCard>

                <SectionCard titulo="Relatórios mensais">
                  <Field rotulo="Acumulado até" dica={`${rel.mensais.length === 0 ? "Nenhum relatório mensal" : contagem(rel.mensais.length, "relatório mensal", "relatórios mensais")} ${palavra(rel.mensais.length, "usado", "usados")} no Previsto × Realizado, na inadimplência e nas notas.`}>
                    <Selecao
                      value={String(rel.comparativo.mesAte.posicao)}
                      onChange={(v) => mudar({ relatorioFinal: { ...e.relatorioFinal, prAte: Number(v) } })}
                      opcoes={opcoesMes}
                    />
                  </Field>
                </SectionCard>
              </aside>

              <div className="min-w-0 rounded-md bg-muted/40 p-2 sm:p-6">
                <PreviaRelatorio rel={rel} exercicio={e} condominio={condo} escritorio={escritorio} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="consideracoes" className="mt-4">
            <EditorConsideracoes
              consid={e.consid}
              onChange={(consid) => mudar({ consid })}
              condominio={condo}
              receberMensais={rel.inadimplencia.final}
              agua={rel.agua}
            />
          </TabsContent>
        </Tabs>
      </form>

      <DialogoConferencia aberto={conferir} aoMudar={setConferir} rel={rel} aoEmitir={emitir} />
    </>
  );
}
