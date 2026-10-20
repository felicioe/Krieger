import { createFileRoute, Link, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ClipboardList, ClipboardPlus, ListRestart, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { MenuDocumentos } from "@/components/documentos/MenuDocumentos";
import { DataInput, HoraInput, InteiroInput, Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { dataParaBR, dataParaISO, formatData, parseData } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import {
  camposDaModalidade,
  ENTREGAS_CONTAS,
  MODALIDADES,
  normalizarAssembleia,
  prepararAssembleia,
  rotuloTipo,
  TIPOS_ASSEMBLEIA,
  validarAssembleia,
  type ErrosAssembleia,
} from "@/domain/edital";
import { normalizarModelo } from "@/domain/modelo";
import { ataDoEdital, novaAtaDeAssembleia } from "@/domain/ata";
import { normalizarCondominio } from "@/domain/condominio";
import { documentoEdital } from "@/documentos/edital";
import { documentoListaPresenca, documentoProcuracao } from "@/documentos/presenca";
import type { Assembleia, Ata, Condominio, ConfigEscritorio, Modelo } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/editais/$id")({
  head: () => cabecalho("Edital", "Dados do edital de convocação da assembleia."),
  loader: async ({ params, context: { queryClient } }) => {
    const [a] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Assembleia>("assembleias", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Modelo>("modelos")),
      queryClient.ensureQueryData(listaQuery<Ata>("atas")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]);
    if (!a) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Edital não encontrado.</p>
      <Button variant="link" asChild>
        <Link to="/editais">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaEdital,
});

/** No formulário a data da assembleia é editada como dd/mm/aaaa; é gravada como aaaa-mm-dd. */
function paraFormulario(a: Assembleia): Assembleia {
  const d = parseData(a.data);
  return { ...a, data: d ? dataParaBR(d) : a.data };
}

function PaginaEdital() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Assembleia>("assembleias", id));
  return <FormEdital key={id} inicial={paraFormulario(normalizarAssembleia(data ?? { id }))} />;
}

const SEM_MODELO = "__sem";

function FormEdital({ inicial }: { inicial: Assembleia }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: modelosRaw } = useSuspenseQuery(listaQuery<Modelo>("modelos"));
  const modelos = modelosRaw.map((m) => normalizarModelo(m));
  const { data: atas } = useSuspenseQuery(listaQuery<Ata>("atas"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [a, setA] = useState<Assembleia>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const [erros, setErros] = useState<ErrosAssembleia>({});
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [confirmarPauta, setConfirmarPauta] = useState(false);

  const condo = condominios.find((c) => c.id === a.condoId);
  const modelo = modelos.find((m) => m.id === a.modeloId) ?? null;
  const campos = camposDaModalidade(a.modalidade);
  const sujo = JSON.stringify(a) !== salvoJson;
  const mudar = (parcial: Partial<Assembleia>) => {
    setA((x) => ({ ...x, ...parcial }));
    const chavesMudadas = Object.keys(parcial);
    if (chavesMudadas.some((k) => k in erros)) {
      setErros((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !chavesMudadas.includes(k))));
    }
  };

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const liberado = useRef(false);
  useBlocker({
    shouldBlockFn: () =>
      !liberado.current && sujoRef.current && !window.confirm("Há alterações não salvas neste edital. Sair mesmo assim?"),
    enableBeforeUnload: () => !liberado.current && sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: (dados: Assembleia) => api.salvar("assembleias", dados),
    onSuccess: (salvo) => {
      const n = paraFormulario(normalizarAssembleia(salvo));
      queryClient.invalidateQueries({ queryKey: chaves.lista("assembleias") });
      queryClient.setQueryData(chaves.item("assembleias", salvo.id), salvo);
      setA(n);
      setSalvoJson(JSON.stringify(n));
      toast.success("Edital salvo.");
    },
  });

  const ata = ataDoEdital(a.id, atas);
  const criarAta = useMutation({
    mutationFn: (dados: Omit<Ata, "id">) => api.salvar<Omit<Ata, "id"> & { id?: string }>("atas", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("atas") });
      queryClient.setQueryData(chaves.item("atas", salvo.id), salvo);
      toast.success("Ata criada com a pauta deste edital.");
      navigate({ to: "/atas/$id", params: { id: salvo.id } });
    },
  });
  function novaAta() {
    const d = parseData(a.data);
    if (!condo || !d) return;
    criarAta.mutate(novaAtaDeAssembleia({ ...a, data: dataParaISO(d) }, normalizarCondominio(condo)));
  }

  const excluir = useMutation({
    mutationFn: () => api.excluir("assembleias", a.id),
    onSuccess: () => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("assembleias") });
      toast.success("Edital excluído.");
      navigate({ to: "/editais" });
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    const e = validarAssembleia(a);
    setErros(e);
    if (Object.keys(e).length) {
      toast.error("Confira os campos destacados.");
      return;
    }
    const d = parseData(a.data);
    if (!d) return;
    salvar.mutate(prepararAssembleia({ ...a, data: dataParaISO(d) }));
  }

  function escolherModelo(id: string) {
    const novo = id === SEM_MODELO ? "" : id;
    const m = modelos.find((x) => x.id === novo);
    // Pauta vazia: já carrega a do modelo escolhido; senão, o usuário decide pelo botão.
    if (m && a.pauta.every((p) => !p.trim())) mudar({ modeloId: novo, pauta: [...m.pautaOrdinaria] });
    else mudar({ modeloId: novo });
  }

  const opcoesCondo = [...condominios]
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
    .map((c) => ({ valor: c.id, rotulo: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome }));
  const opcoesModelo = [
    { valor: SEM_MODELO, rotulo: "Sem modelo" },
    ...modelos.map((m) => ({ valor: m.id, rotulo: m.nome })),
    ...(a.modeloId && !modelo ? [{ valor: a.modeloId, rotulo: "(modelo excluído)" }] : []),
  ];

  const bloqueioDocumentos = sujo ? "Salve o edital antes de gerar os documentos." : !condo ? "Escolha o condomínio." : null;
  const entradaDocumento = () => {
    const d = parseData(a.data);
    return { assembleia: { ...a, data: d ? dataParaISO(d) : a.data }, condominio: normalizarCondominio(condo!), escritorio };
  };
  const documentos = [
    {
      rotulo: "Edital",
      bloqueio: modelo ? null : "Escolha um modelo de edital para gerar o edital.",
      gerar: () => documentoEdital({ ...entradaDocumento(), modelo: modelo! }),
    },
    { rotulo: "Lista de presença", gerar: () => documentoListaPresenca(entradaDocumento()) },
    { rotulo: "Procuração", gerar: () => documentoProcuracao(entradaDocumento()) },
  ];

  const titulo = `Edital · Assembleia ${rotuloTipo(a.tipo)}`;
  const descricao = [condo?.nome, parseData(a.data) ? formatData(a.data) : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/editais">
              <ArrowLeft /> Editais
            </Link>
          </Button>
        }
        titulo={titulo}
        descricao={descricao}
        acoes={
          <>
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <MenuDocumentos documentos={documentos} bloqueio={bloqueioDocumentos} rotulo="Gerar documentos" />
            {ata ? (
              <Button variant="outline" asChild>
                <Link to="/atas/$id" params={{ id: ata.id }}>
                  <ClipboardList /> Abrir ata
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                type="button"
                onClick={novaAta}
                disabled={sujo || !condo || criarAta.isPending}
                title={sujo ? "Salve o edital antes de criar a ata." : undefined}
              >
                {criarAta.isPending ? <Loader2 className="animate-spin" /> : <ClipboardPlus />}
                Criar ata
              </Button>
            )}
            <Button variant="outline" type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:text-destructive">
              <Trash2 /> Excluir
            </Button>
            <Button type="submit" form="form-edital" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      <form id="form-edital" onSubmit={enviar} className="space-y-6" noValidate>
        <SectionCard titulo="Assembleia">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field rotulo="Condomínio" obrigatorio erro={erros.condoId ?? null} className="sm:col-span-2">
              <Selecao value={a.condoId} onChange={(v) => mudar({ condoId: v })} opcoes={opcoesCondo} placeholder="Escolha o condomínio" />
            </Field>
            <Field rotulo="Tipo">
              <Selecao value={a.tipo} onChange={(v) => mudar({ tipo: v })} opcoes={TIPOS_ASSEMBLEIA} />
            </Field>
            <Field rotulo="Modalidade" dica={campos.zoom ? (campos.local ? "Local físico e Zoom." : "Somente Zoom.") : "Somente local físico."}>
              <Selecao value={a.modalidade} onChange={(v) => mudar({ modalidade: v })} opcoes={MODALIDADES} />
            </Field>
            <Field
              rotulo="Data"
              obrigatorio
              erro={erros.data ?? null}
              {...(condo?.prazoConvocacao ? { dica: `Prazo de convocação do condomínio: ${condo.prazoConvocacao} dias.` } : {})}
            >
              <DataInput value={a.data} onChange={(v) => mudar({ data: v })} />
            </Field>
            <Field rotulo="1ª convocação" obrigatorio erro={erros.hora1 ?? null}>
              <HoraInput value={a.hora1} onChange={(v) => mudar({ hora1: v })} />
            </Field>
            <Field rotulo="2ª convocação" erro={erros.hora2 ?? null}>
              <HoraInput value={a.hora2} onChange={(v) => mudar({ hora2: v })} />
            </Field>
            <Field rotulo="Modelo de edital">
              <Selecao value={a.modeloId || SEM_MODELO} onChange={escolherModelo} opcoes={opcoesModelo} />
            </Field>
            <Field rotulo="Quórum" className="sm:col-span-2 lg:col-span-4" dica="Texto que aparece no edital.">
              <Input value={a.quorum} onChange={(e) => mudar({ quorum: e.target.value })} placeholder="Ex.: maioria simples dos presentes" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          titulo={campos.zoom && campos.local ? "Local e videoconferência" : campos.zoom ? "Videoconferência" : "Local"}
          descricao="Os campos mudam conforme a modalidade escolhida."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {campos.local && (
              <Field rotulo="Local" className="sm:col-span-3">
                <Input value={a.local} onChange={(e) => mudar({ local: e.target.value })} placeholder="Ex.: Salão de festas do condomínio" />
              </Field>
            )}
            {campos.zoom && (
              <>
                <Field rotulo="Link do Zoom" className="sm:col-span-3">
                  <Input value={a.zoomLink} onChange={(e) => mudar({ zoomLink: e.target.value })} placeholder="https://zoom.us/j/..." inputMode="url" />
                </Field>
                <Field rotulo="ID da reunião">
                  <Input value={a.zoomId} onChange={(e) => mudar({ zoomId: e.target.value })} className="num" />
                </Field>
                <Field rotulo="Senha">
                  <Input value={a.zoomSenha} onChange={(e) => mudar({ zoomSenha: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          titulo="Pauta"
          descricao={modelo ? `Pauta padrão carregada de “${modelo.nome}”. Edite, reordene ou acrescente itens.` : "Itens da ordem do dia."}
          acoes={
            modelo ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (a.pauta.some((p) => p.trim()) ? setConfirmarPauta(true) : mudar({ pauta: [...modelo.pautaOrdinaria] }))}
                disabled={modelo.pautaOrdinaria.length === 0}
              >
                <ListRestart /> Recarregar pauta do modelo
              </Button>
            ) : undefined
          }
        >
          <RepeatableList<{ texto: string }>
            itens={a.pauta.map((texto) => ({ texto }))}
            onChange={(l) => mudar({ pauta: l.map((i) => i.texto) })}
            novo={() => ({ texto: "" })}
            colunas="grid-cols-[2rem_minmax(0,1fr)]"
            rotuloAdicionar="Adicionar item"
            vazio="Nenhum item na pauta."
            render={(item, up, i) => (
              <>
                <span className="num flex h-9 items-center justify-end text-sm text-muted-foreground">{i + 1}.</span>
                <Input aria-label={`Item ${i + 1} da pauta`} value={item.texto} onChange={(e) => up({ texto: e.target.value })} />
              </>
            )}
          />
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard titulo="Prestação de contas">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field rotulo="Exercício" dica="Ano das contas apresentadas.">
                <Input value={a.exercicio} onChange={(e) => mudar({ exercicio: e.target.value })} className="num" inputMode="numeric" placeholder="aaaa" />
              </Field>
              <Field rotulo="Entrega das contas">
                <Selecao value={a.entregaContas} onChange={(v) => mudar({ entregaContas: v })} opcoes={ENTREGAS_CONTAS} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard titulo="Emissão e assinatura">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field rotulo="Cidade">
                <Input value={a.cidade} onChange={(e) => mudar({ cidade: e.target.value })} />
              </Field>
              <Field rotulo="Data de emissão" erro={erros.dataEmissao ?? null}>
                <DataInput value={a.dataEmissao} onChange={(v) => mudar({ dataEmissao: v })} />
              </Field>
              <Field rotulo="Assinante">
                <Input value={a.assinante} onChange={(e) => mudar({ assinante: e.target.value })} />
              </Field>
              <Field rotulo="Cargo">
                <Input value={a.cargo} onChange={(e) => mudar({ cargo: e.target.value })} placeholder="Ex.: Síndico" />
              </Field>
              <Field rotulo="Linhas da lista de presença" {...(condo?.unidades ? { dica: `O condomínio tem ${condo.unidades} unidades.` } : {})}>
                <InteiroInput value={a.linhasLista} onChange={(v) => mudar({ linhasLista: v })} />
              </Field>
              <div className="flex items-center gap-3 self-end pb-2">
                <Switch id="timbrado" checked={a.timbrado} onCheckedChange={(v) => mudar({ timbrado: v })} />
                <Label htmlFor="timbrado" className="text-sm font-normal">
                  Papel timbrado
                </Label>
              </div>
            </div>
          </SectionCard>
        </div>
      </form>

      <ConfirmDialog
        aberto={confirmarPauta}
        aoMudar={setConfirmarPauta}
        titulo="Recarregar a pauta do modelo?"
        descricao="Os itens atuais da pauta serão substituídos pela pauta padrão do modelo."
        rotuloConfirmar="Substituir pauta"
        aoConfirmar={() => modelo && mudar({ pauta: [...modelo.pautaOrdinaria] })}
      />
      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir edital?"
        descricao={`O edital da assembleia ${rotuloTipo(a.tipo).toLowerCase()}${descricao ? ` (${descricao})` : ""} será excluído.${ata ? " A ata ligada a ele continua salva." : ""} Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
