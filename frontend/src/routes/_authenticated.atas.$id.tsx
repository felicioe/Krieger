import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, FileText, Loader2, LockOpen, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { BotaoDocumento } from "@/components/documentos/BotaoDocumento";
import { DataInput, HoraInput, InteiroInput, Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { dataParaBR, dataParaISO, formatData, formatNumeroBR, parseData } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import {
  contarUnidadesPresentes,
  normalizarAta,
  novoItemAta,
  OPCOES_MODALIDADE,
  OPCOES_TIPO,
  percentualQuorum,
  prepararAta,
  rotuloStatus,
  validarAta,
  type ErrosAta,
  type ItemAta,
  type Presente,
} from "@/domain/ata";
import { rotuloTipo } from "@/domain/edital";
import { normalizarCondominio } from "@/domain/condominio";
import { documentoAta } from "@/documentos/ata";
import type { Assembleia, Ata, Condominio, ConfigEscritorio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/atas/$id")({
  head: () => cabecalho("Ata", "Ata da assembleia: mesa, presentes, itens da pauta e deliberações."),
  loader: async ({ params, context: { queryClient } }) => {
    const [a] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Ata>("atas", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]);
    if (!a) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Ata não encontrada.</p>
      <Button variant="link" asChild>
        <Link to="/atas">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaAta,
});

/** No formulário a data é editada como dd/mm/aaaa; é gravada como aaaa-mm-dd (igual ao edital). */
function paraFormulario(a: Ata): Ata {
  const d = parseData(a.data);
  return { ...a, data: d ? dataParaBR(d) : a.data };
}
function paraGravar(a: Ata): Ata {
  const d = parseData(a.data);
  return { ...a, data: d ? dataParaISO(d) : a.data };
}

function PaginaAta() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Ata>("atas", id));
  return <FormAta key={id} inicial={paraFormulario(normalizarAta(data ?? { id }))} />;
}

type Acao = "finalizar" | "reabrir" | "excluir" | null;

function FormAta({ inicial }: { inicial: Ata }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [a, setA] = useState<Ata>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const [erros, setErros] = useState<ErrosAta>({});
  const [acao, setAcao] = useState<Acao>(null);

  const travada = a.status === "finalizada";
  const condo = condominios.find((c) => c.id === a.condoId);
  const edital = assembleias.find((x) => x.id === a.assembleiaId) ?? null;
  const cidade = edital?.cidade || escritorio?.cidade || "";
  const sujo = JSON.stringify(a) !== salvoJson;
  const unidadesNaLista = contarUnidadesPresentes(a.presentes);
  const pct = percentualQuorum(a.quorum);

  const mudar = (parcial: Partial<Ata>) => {
    setA((x) => ({ ...x, ...parcial }));
    const mudadas = Object.keys(parcial);
    if (mudadas.some((k) => k in erros)) setErros((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !mudadas.includes(k))));
  };

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const liberado = useRef(false);
  useBlocker({
    shouldBlockFn: () =>
      !liberado.current && sujoRef.current && !window.confirm("Há alterações não salvas nesta ata. Sair mesmo assim?"),
    enableBeforeUnload: () => !liberado.current && sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: (dados: { ata: Ata; mensagem: string }) => api.salvar("atas", dados.ata),
    onSuccess: (salvo, { mensagem }) => {
      const n = paraFormulario(normalizarAta(salvo));
      queryClient.invalidateQueries({ queryKey: chaves.lista("atas") });
      queryClient.setQueryData(chaves.item("atas", salvo.id), salvo);
      setA(n);
      setSalvoJson(JSON.stringify(n));
      toast.success(mensagem);
    },
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir("atas", a.id),
    onSuccess: () => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("atas") });
      toast.success("Ata excluída.");
      navigate({ to: "/atas" });
    },
  });

  /** Valida e devolve a ata pronta para gravar, ou null (mostrando os erros). */
  function pronta(): Ata | null {
    const e = validarAta(a);
    setErros(e);
    if (Object.keys(e).length) {
      toast.error("Confira os campos destacados.");
      return null;
    }
    return prepararAta(paraGravar(a));
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (travada) return;
    const p = pronta();
    if (p) salvar.mutate({ ata: p, mensagem: "Ata salva." });
  }

  const gerarDocumento = () =>
    documentoAta({ ata: paraGravar(a), condominio: condo ? normalizarCondominio(condo) : null, cidade, escritorio });

  const titulo = `Ata · Assembleia ${rotuloTipo(a.tipo)}`;
  const descricao = [condo?.nome, cidade, parseData(a.data) ? formatData(a.data) : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto min-h-0 p-0 text-muted-foreground" asChild>
            <Link to="/atas">
              <ArrowLeft /> Atas
            </Link>
          </Button>
        }
        titulo={titulo}
        descricao={descricao}
        acoes={
          <>
            <Badge variant={travada ? "success" : "warning"}>{rotuloStatus(a.status)}</Badge>
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <BotaoDocumento
              gerar={gerarDocumento}
              bloqueio={sujo ? "Salve a ata antes de gerar o documento." : null}
              rotulo={travada ? "Gerar ata" : "Gerar rascunho"}
            />
            {travada ? (
              <Button permissao="atas.editar" variant="outline" type="button" onClick={() => setAcao("reabrir")} disabled={salvar.isPending}>
                <LockOpen /> Reabrir
              </Button>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={() => setAcao("excluir")} className="text-destructive hover:text-destructive">
                  <Trash2 /> Excluir
                </Button>
                <Button permissao="atas.editar" variant="outline" type="submit" form="form-ata" disabled={salvar.isPending}>
                  {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Salvar
                </Button>
                <Button permissao="atas.editar" type="button" onClick={() => pronta() && setAcao("finalizar")} disabled={salvar.isPending}>
                  <CheckCircle2 /> Finalizar
                </Button>
              </>
            )}
          </>
        }
      />

      {travada && (
        <Alert className="mb-6">
          <AlertDescription>Ata finalizada: a edição está travada. Use “Reabrir” se precisar corrigir algo.</AlertDescription>
        </Alert>
      )}

      <form id="form-ata" onSubmit={enviar} noValidate>
        <fieldset disabled={travada} className="min-w-0 space-y-6">
          <SectionCard
            titulo="Cabeçalho"
            descricao="Dados do condomínio e do edital usados no cabeçalho da ata."
            acoes={
              edital ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/editais/$id" params={{ id: edital.id }}>
                    <FileText /> Ver edital
                  </Link>
                </Button>
              ) : undefined
            }
          >
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Condomínio</dt>
                <dd className="mt-1 font-medium">{condo?.nomeRelatorio || condo?.nome || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Cidade</dt>
                <dd className="mt-1">{cidade || <span className="text-muted-foreground">Não informada no edital nem no escritório</span>}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Edital</dt>
                <dd className="mt-1">{edital ? `${formatData(edital.data)} · ${rotuloTipo(edital.tipo)}` : <span className="text-muted-foreground">Sem edital vinculado</span>}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard titulo="Reunião">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field rotulo="Tipo">
                <Selecao value={a.tipo} onChange={(v) => mudar({ tipo: v })} opcoes={OPCOES_TIPO} />
              </Field>
              <Field rotulo="Modalidade">
                <Selecao value={a.modalidade} onChange={(v) => mudar({ modalidade: v })} opcoes={OPCOES_MODALIDADE} />
              </Field>
              <Field rotulo="Data" obrigatorio erro={erros.data ?? null}>
                <DataInput value={a.data} onChange={(v) => mudar({ data: v })} />
              </Field>
              <Field rotulo="Horário" erro={erros.hora ?? null} {...(edital?.hora2 ? { dica: `Edital: ${edital.hora1} / ${edital.hora2}.` } : {})}>
                <HoraInput value={a.hora} onChange={(v) => mudar({ hora: v })} />
              </Field>
              <Field rotulo="Local" className="sm:col-span-2 lg:col-span-4">
                <Input value={a.local} onChange={(e) => mudar({ local: e.target.value })} />
              </Field>
              <Field rotulo="Presidente da mesa" className="lg:col-span-2">
                <Input value={a.mesa.presidente} onChange={(e) => mudar({ mesa: { ...a.mesa, presidente: e.target.value } })} />
              </Field>
              <Field rotulo="Secretário(a)" className="lg:col-span-2">
                <Input value={a.mesa.secretario} onChange={(e) => mudar({ mesa: { ...a.mesa, secretario: e.target.value } })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            titulo="Presentes"
            descricao={`${a.presentes.length} ${a.presentes.length === 1 ? "pessoa" : "pessoas"} na lista · ${unidadesNaLista} ${unidadesNaLista === 1 ? "unidade" : "unidades"} diferentes.`}
          >
            <RepeatableList<Presente>
              itens={a.presentes}
              onChange={(presentes) => mudar({ presentes })}
              novo={() => ({ unidade: "", nome: "", procurador: false })}
              colunas="grid-cols-1 @min-[12rem]:grid-cols-[5.5rem_minmax(0,1fr)] @2xl:grid-cols-[7rem_minmax(0,1fr)_8rem]"
              cabecalhos={["Unidade", "Nome", "Procurador"]}
              rotuloAdicionar="Adicionar presente"
              vazio="Ninguém na lista ainda."
              reordenavel={false}
              render={(p, up, i) => (
                <>
                  <Input aria-label={`Unidade do presente ${i + 1}`} placeholder="Unidade" value={p.unidade} onChange={(e) => up({ unidade: e.target.value })} />
                  <Input aria-label={`Nome do presente ${i + 1}`} placeholder="Nome" value={p.nome} onChange={(e) => up({ nome: e.target.value })} />
                  <label className="col-span-full flex min-h-9 min-w-0 items-center gap-2 pl-1.5 text-sm max-md:min-h-11 max-md:gap-3 pointer-coarse:min-h-11 pointer-coarse:gap-3 @min-[12rem]:col-span-1 @min-[12rem]:col-start-2 @2xl:col-start-auto">
                    <Checkbox checked={p.procurador} onCheckedChange={(v) => up({ procurador: v === true })} aria-label={`Presente ${i + 1} é procurador`} />
                    <span className="min-w-0 break-words">Procurador</span>
                  </label>
                </>
              )}
            />
          </SectionCard>

          <SectionCard titulo="Quórum">
            <div className="grid items-end gap-4 sm:grid-cols-[10rem_10rem_minmax(0,1fr)]">
              <Field rotulo="Unidades presentes">
                <InteiroInput value={a.quorum.unidadesPresentes} onChange={(v) => mudar({ quorum: { ...a.quorum, unidadesPresentes: v ?? 0 } })} />
              </Field>
              <Field rotulo="Total de unidades">
                <InteiroInput value={a.quorum.totalUnidades} onChange={(v) => mudar({ quorum: { ...a.quorum, totalUnidades: v ?? 0 } })} />
              </Field>
              <div className="flex flex-wrap items-center gap-3 pb-1">
                <span className="num text-sm">
                  {pct === null ? "—" : `${formatNumeroBR(pct, 2)}% das unidades`}
                </span>
                {!travada && unidadesNaLista !== a.quorum.unidadesPresentes && unidadesNaLista > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => mudar({ quorum: { ...a.quorum, unidadesPresentes: unidadesNaLista } })}
                  >
                    <Users /> Usar contagem da lista ({unidadesNaLista})
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard titulo="Itens da pauta" descricao={edital ? "Carregados da pauta do edital. Registre a discussão, a deliberação e os votos de cada item." : "Registre a discussão, a deliberação e os votos de cada item."}>
            <RepeatableList<ItemAta>
              itens={a.itens}
              onChange={(itens) => mudar({ itens })}
              novo={() => novoItemAta()}
              colunas="grid-cols-1"
              rotuloAdicionar="Adicionar item"
              vazio="Nenhum item."
              render={(item, up, i) => {
                const total = item.votos.favor + item.votos.contra + item.votos.abstencao;
                return (
                  <div className="grid grid-cols-1 gap-3 rounded-md border bg-card p-3 @max-[10rem]:p-2">
                    <Field rotulo={`Item ${i + 1}`}>
                      <Input value={item.titulo} onChange={(e) => up({ titulo: e.target.value })} className="font-medium" />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
                      <Field rotulo="Discussão">
                        <Textarea value={item.discussao} onChange={(e) => up({ discussao: e.target.value })} rows={3} />
                      </Field>
                      <Field rotulo="Deliberação">
                        <Textarea value={item.deliberacao} onChange={(e) => up({ deliberacao: e.target.value })} rows={3} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 items-end gap-3 @min-[14rem]:grid-cols-3 @2xl:grid-cols-[8rem_8rem_8rem_minmax(0,1fr)]">
                      <Field rotulo="A favor">
                        <InteiroInput value={item.votos.favor} onChange={(v) => up({ votos: { ...item.votos, favor: v ?? 0 } })} />
                      </Field>
                      <Field rotulo="Contra">
                        <InteiroInput value={item.votos.contra} onChange={(v) => up({ votos: { ...item.votos, contra: v ?? 0 } })} />
                      </Field>
                      <Field rotulo="Abstenções">
                        <InteiroInput value={item.votos.abstencao} onChange={(v) => up({ votos: { ...item.votos, abstencao: v ?? 0 } })} />
                      </Field>
                      <p className="num col-span-full pb-2 text-xs text-muted-foreground @2xl:col-span-1">{total ? `${total} votos` : "Sem votação registrada"}</p>
                    </div>
                  </div>
                );
              }}
            />
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard titulo="Encerramento">
              <Textarea aria-label="Encerramento" value={a.encerramento} onChange={(e) => mudar({ encerramento: e.target.value })} rows={5} />
            </SectionCard>
            <SectionCard titulo="Observações">
              <Textarea aria-label="Observações" value={a.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} rows={5} />
            </SectionCard>
          </div>
        </fieldset>
      </form>

      <ConfirmDialog
        aberto={acao === "finalizar"}
        aoMudar={(v) => !v && setAcao(null)}
        titulo="Finalizar a ata?"
        descricao="A ata será salva e a edição ficará travada. Se precisar corrigir algo depois, use “Reabrir”."
        rotuloConfirmar="Finalizar"
        aoConfirmar={async () => {
          const p = pronta();
          if (p) await salvar.mutateAsync({ ata: { ...p, status: "finalizada" }, mensagem: "Ata finalizada." });
        }}
      />
      <ConfirmDialog
        aberto={acao === "reabrir"}
        aoMudar={(v) => !v && setAcao(null)}
        titulo="Reabrir a ata?"
        descricao="A ata volta a ser rascunho e poderá ser editada."
        rotuloConfirmar="Reabrir"
        aoConfirmar={() => salvar.mutateAsync({ ata: { ...paraGravar(a), status: "rascunho" }, mensagem: "Ata reaberta para edição." })}
      />
      <ConfirmDialog
        aberto={acao === "excluir"}
        aoMudar={(v) => !v && setAcao(null)}
        titulo="Excluir ata?"
        descricao={`A ata${descricao ? ` (${descricao})` : ""} será excluída. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
