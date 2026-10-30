import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, Eye, FileDown, FolderOpen, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import {
  MODALIDADES_NOTIFICACAO,
  dataPorExtenso,
  extrairCidadeDoEndereco,
  montarParagrafoFatoPadrao,
  montarParagrafoProvidencia,
  rotuloCategoriaDocumento,
  valorPorExtensoBRL,
  type ModalidadeNotificacao,
} from "@/domain/notificacao";
import type { Condominio, ConfigEscritorio, ConsultaOrigem, ConsultaResposta } from "@/domain/types";
import { api, mensagemErro } from "@/lib/api";
import { baixarNotificacaoDocx } from "@/lib/documento/notificacao";
import { dataParaBR } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import {
  consultaHistoricoQuery,
  documentosDriveQuery,
  documentosResumoQuery,
  itemQuery,
  listaQuery,
} from "@/lib/queries";

type Busca = { condoId?: string; docId?: string };

export const Route = createFileRoute("/_authenticated/consulta-documentos")({
  head: () =>
    cabecalho(
      "Consulta Inteligente",
      "Pesquisa inteligente por IA nos documentos dos condomínios com geração opcional de Notificação e Multa em Word (.DOCX).",
    ),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const condoId = typeof s["condoId"] === "string" && s["condoId"] ? s["condoId"] : undefined;
    const docId = typeof s["docId"] === "string" && s["docId"] ? s["docId"] : undefined;
    return { ...(condoId ? { condoId } : {}), ...(docId ? { docId } : {}) };
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
  component: PaginaConsultaDocumentos,
});

const ORIGEM_ROTULO: Record<ConsultaOrigem, string> = {
  cache: "Resposta em cache (0 tokens)",
  local: "Busca local (0 tokens)",
  claude: "Analisado por IA",
};
const ORIGEM_VARIANTE: Record<ConsultaOrigem, "secondary" | "outline" | "success"> = {
  cache: "secondary",
  local: "outline",
  claude: "success",
};

function PaginaConsultaDocumentos() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/consulta-documentos" });
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const escritorioQuery = useQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const resumoDocsQuery = useQuery(documentosResumoQuery());

  const ordenados = useMemo(
    () => [...condominios].sort((a, b) => (a.nomeRelatorio || a.nome).localeCompare(b.nomeRelatorio || b.nome, "pt-BR")),
    [condominios],
  );

  const escopoId =
    busca.condoId === "*"
      ? "*"
      : busca.condoId && ordenados.some((c) => c.id === busca.condoId)
        ? busca.condoId
        : (ordenados[0]?.id ?? "*");

  const [documentoFiltroId, setDocumentoFiltroId] = useState<string>(busca.docId ?? "todos");
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<ConsultaResposta | null>(null);

  // Estado do gerador de Notificação / Multa (.DOCX)
  const [emitirNotificacao, setEmitirNotificacao] = useState(false);
  const [condoNotifId, setCondoNotifId] = useState<string>(escopoId !== "*" ? escopoId : (ordenados[0]?.id ?? ""));
  const [modalidade, setModalidade] = useState<ModalidadeNotificacao>("notificacao_multa");
  const [cidadeNotif, setCidadeNotif] = useState("Camboriú");
  const [dataEmissaoNotif, setDataEmissaoNotif] = useState(() => dataParaBR(new Date()));
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [unidade, setUnidade] = useState("");
  const [inquilinoNome, setInquilinoNome] = useState("");
  const [enquadramentoMulta, setEnquadramentoMulta] = useState("20% do salário-mínimo vigente");
  const [valorMultaStr, setValorMultaStr] = useState("303,60");
  const [paragrafoFato, setParagrafoFato] = useState("");
  const [paragrafoBaseLegal, setParagrafoBaseLegal] = useState("");
  const [paragrafoProvidencia, setParagrafoProvidencia] = useState("");
  const [cargoAssinatura, setCargoAssinatura] = useState("SÍNDICO");
  const [gerandoDocx, setGerandoDocx] = useState(false);

  useEffect(() => {
    setDocumentoFiltroId(busca.docId ?? "todos");
  }, [busca.docId, escopoId]);

  const docsDoCondominioQuery = useQuery(documentosDriveQuery(escopoId === "*" ? "" : escopoId));
  const historico = useQuery(consultaHistoricoQuery(escopoId));

  const condoNotif = useMemo(
    () => ordenados.find((c) => c.id === condoNotifId) ?? ordenados[0],
    [ordenados, condoNotifId],
  );

  // Sincroniza dados padrão do condomínio na Notificação quando troca de condomínio
  useEffect(() => {
    if (escopoId !== "*") {
      setCondoNotifId(escopoId);
    }
  }, [escopoId]);

  useEffect(() => {
    if (!condoNotif) return;
    setCidadeNotif(extrairCidadeDoEndereco(condoNotif.enderecoEdital));
    setParagrafoFato(montarParagrafoFatoPadrao(modalidade));
  }, [condoNotif, modalidade]);

  const valorMultaNumero = useMemo(() => {
    const limpo = valorMultaStr.replace(/\./g, "").replace(",", ".").trim();
    const n = Number(limpo);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [valorMultaStr]);

  // Atualiza automaticamente o 3º parágrafo quando muda a modalidade, valor ou enquadramento
  useEffect(() => {
    setParagrafoProvidencia(
      montarParagrafoProvidencia({
        modalidade,
        enquadramentoMulta,
        valorMulta: valorMultaNumero,
      }),
    );
  }, [modalidade, enquadramentoMulta, valorMultaNumero]);

  const perguntar = useMutation({
    mutationFn: (p: string) =>
      api.documentos.perguntar(
        escopoId,
        p,
        documentoFiltroId && documentoFiltroId !== "todos" ? documentoFiltroId : undefined,
      ),
    onSuccess: (r) => {
      setResposta(r);
      setParagrafoBaseLegal(
        `De acordo com as disposições do condomínio: ${r.texto.trim()}`,
      );
      const primeiraFonteCondo = r.fontes.find((f) => f.condoId)?.condoId;
      if (escopoId === "*" && primeiraFonteCondo && ordenados.some((c) => c.id === primeiraFonteCondo)) {
        setCondoNotifId(primeiraFonteCondo);
      }
      void historico.refetch();
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const opcoesEscopo = useMemo(() => {
    const mapa = resumoDocsQuery.data ?? {};
    const totalDocs = Object.values(mapa).reduce((acc, n) => acc + n, 0);
    const condosComDoc = Object.values(mapa).filter((n) => n > 0).length;
    const listaCondos = opcoesCondominio(ordenados, true).map((op) => {
      const qtd = mapa[op.value] ?? 0;
      return {
        ...op,
        detalhe: [op.detalhe, qtd > 0 ? `${qtd} doc(s) na base` : "Sem docs na base"].filter(Boolean).join(" • "),
      };
    });
    return [
      {
        value: "*",
        label: "🌐 Todos os condomínios com documentos na base",
        codigo: "TODOS",
        detalhe: `${condosComDoc} condomínio(s) com acervo • ${totalDocs} documento(s) indexado(s)`,
      },
      ...listaCondos,
    ];
  }, [ordenados, resumoDocsQuery.data]);

  const opcoesCondoNotif = useMemo(() => opcoesCondominio(ordenados, true), [ordenados]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const p = pergunta.trim();
    if (!p || perguntar.isPending) return;
    perguntar.mutate(p);
  }

  async function copiarResposta() {
    if (!resposta) return;
    try {
      await navigator.clipboard.writeText(resposta.texto);
      toast.success("Resposta copiada para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  async function gerarDocxNotificacao() {
    if (!condoNotif) {
      toast.error("Selecione o condomínio da notificação.");
      return;
    }
    if (!destinatarioNome.trim() || !unidade.trim()) {
      toast.error("Informe o nome do condômino/destinatário e a unidade.");
      return;
    }
    setGerandoDocx(true);
    try {
      const modInfo = MODALIDADES_NOTIFICACAO.find((m) => m.valor === modalidade);
      await baixarNotificacaoDocx({
        condominio: condoNotif,
        escritorio: escritorioQuery.data ?? null,
        dados: {
          modalidade,
          titulo: modInfo?.tituloPadrao ?? "NOTIFICAÇÃO",
          cidade: cidadeNotif.trim() || extrairCidadeDoEndereco(condoNotif.enderecoEdital),
          dataEmissao: dataEmissaoNotif.trim() || dataParaBR(new Date()),
          condomino: destinatarioNome.trim(),
          unidade: unidade.trim(),
          inquilino: inquilinoNome.trim(),
          paragrafoFato: paragrafoFato.trim(),
          paragrafoBaseLegal: paragrafoBaseLegal.trim(),
          paragrafoProvidencia: paragrafoProvidencia.trim(),
          enquadramentoMulta: enquadramentoMulta.trim(),
          valorMulta: valorMultaNumero,
          assinanteCargo: cargoAssinatura.trim().toUpperCase().includes("SÍNDIC") || cargoAssinatura.trim().toUpperCase().includes("SINDIC")
            ? "sindico_condominio"
            : "apenas_condominio",
        },
      });
      toast.success("Documento Word (.DOCX) gerado com sucesso!");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setGerandoDocx(false);
    }
  }

  if (ordenados.length === 0) {
    return (
      <>
        <PageHeader
          titulo="Consulta Inteligente"
          descricao="Pesquisa por IA em convenções, regimentos, atas, contratos e demais documentos."
        />
        <SectionCard titulo="Nenhum condomínio cadastrado">
          <p className="text-sm text-muted-foreground">Cadastre um condomínio para utilizar a Consulta Inteligente.</p>
        </SectionCard>
      </>
    );
  }

  const docsDisponiveis = docsDoCondominioQuery.data ?? [];

  return (
    <>
      <PageHeader
        titulo="Consulta Inteligente"
        descricao="Analise questionamentos recebidos por WhatsApp, e-mail ou telefone com base nos documentos de um condomínio específico ou de todos os condomínios cadastrados."
        acoes={
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/drive-documentos",
                search: escopoId !== "*" ? { condoId: escopoId } : {},
              })
            }
          >
            <FolderOpen className="size-4" />
            Abrir Drive de Documentos
          </Button>
        }
      />

      <SectionCard
        titulo="Escopo da Pesquisa"
        descricao="Escolha um condomínio específico ou pesquise simultaneamente em todos os condomínios que possuem documentos no Drive."
      >
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-7">
            <Field
              rotulo="Condomínio / Abrangência"
              dica="Clique e digite nome, código, CNPJ ou escolha Todos os condomínios."
            >
              <SelecaoBusca
                value={escopoId}
                onChange={(id) => navigate({ search: { condoId: id }, replace: true })}
                opcoes={opcoesEscopo}
                placeholder="Escolha o escopo da consulta"
                placeholderBusca="Pesquisar condomínio por nome, código ou CNPJ..."
              />
            </Field>
          </div>

          <div className="md:col-span-5">
            <Field
              rotulo="Filtrar por documento (opcional)"
              dica="Restrinja a análise a um único arquivo do Drive ou consulte todo o acervo."
            >
              <Select
                value={documentoFiltroId}
                onValueChange={(v) => setDocumentoFiltroId(v)}
                disabled={escopoId === "*" || docsDisponiveis.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os documentos do escopo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">
                    Todos os documentos ({docsDisponiveis.length})
                  </SelectItem>
                  {docsDisponiveis.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.arquivo} ({rotuloCategoriaDocumento(d.tipo)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        titulo="Questionamento / Consulta"
        descricao="Cole a dúvida recebida (WhatsApp, e-mail, ligação) ou faça uma pergunta direta sobre regras, prazos, multas, quórum, seguro, contratos ou atas."
      >
        <form onSubmit={enviar} className="space-y-3">
          <Textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            rows={4}
            placeholder="Ex.: Quais são as penalidades e multas previstas caso um animal de estimação suje as áreas comuns ou faça barulho excessivo? / Qual o prazo de convocação de assembleia?"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="submit" disabled={perguntar.isPending || !pergunta.trim()}>
              {perguntar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Consultar Base e Analisar
            </Button>
            <span className="text-xs text-muted-foreground">
              Economia inteligente de tokens: pré-filtragem local + cache automático de perguntas repetidas.
            </span>
          </div>
        </form>
      </SectionCard>

      {resposta && (
        <SectionCard
          titulo="Parecer / Base Legal Encontrada"
          acoes={
            <Button size="sm" variant="outline" onClick={() => void copiarResposta()}>
              <Copy className="size-3.5" />
              Copiar resposta
            </Button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={ORIGEM_VARIANTE[resposta.origem]}>{ORIGEM_ROTULO[resposta.origem]}</Badge>
            {resposta.semEvidencia && <Badge variant="warning">Sem evidência direta nos documentos</Badge>}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{resposta.texto}</p>
          </div>

          {resposta.fontes.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Documentos e Páginas Consultadas
              </p>
              <ul className="space-y-1.5 text-xs">
                {resposta.fontes.map((f, i) => (
                  <li
                    key={`${f.documentoId}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border bg-card px-3 py-1.5"
                  >
                    <div>
                      {f.condoNome && <strong className="mr-1.5 text-primary">[{f.condoNome}]</strong>}
                      <span className="font-medium">{f.arquivo}</span>{" "}
                      <span className="text-muted-foreground">
                        ({rotuloCategoriaDocumento(f.tipo)}) — pág.{" "}
                        {f.paginaInicial === f.paginaFinal
                          ? f.paginaInicial
                          : `${f.paginaInicial}–${f.paginaFinal}`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        navigate({
                          to: "/drive-documentos",
                          search: {
                            condoId: f.condoId || (escopoId !== "*" ? escopoId : undefined),
                            docId: f.documentoId,
                          },
                        })
                      }
                    >
                      <Eye className="mr-1 size-3.5" />
                      Ver PDF no Drive
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Flag para emitir Notificação / Multa em Word (.DOCX) */}
          <div className="mt-5 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <Checkbox
                checked={emitirNotificacao}
                onCheckedChange={(v) => setEmitirNotificacao(Boolean(v))}
              />
              <Sparkles className="size-4 text-primary" />
              Emitir Notificação / Multa em Word (.DOCX) a partir desta base legal
            </label>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              Gera o documento `.DOCX` formatado no padrão oficial do escritório (Times New Roman 12pt, cabeçalho do
              condomínio, valor por extenso e rodapé), pronto para edição ou envio.
            </p>

            {emitirNotificacao && (
              <div className="mt-4 space-y-4 border-t border-primary/20 pt-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field rotulo="Condomínio da Notificação">
                    <SelecaoBusca
                      value={condoNotifId}
                      onChange={setCondoNotifId}
                      opcoes={opcoesCondoNotif}
                      placeholder="Escolha o condomínio"
                      placeholderBusca="Buscar condomínio..."
                    />
                  </Field>

                  <Field rotulo="Modalidade do Documento">
                    <Select
                      value={modalidade}
                      onValueChange={(v) => setModalidade(v as ModalidadeNotificacao)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALIDADES_NOTIFICACAO.map((m) => (
                          <SelectItem key={m.valor} value={m.valor}>
                            {m.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field rotulo="Cidade e Data de Emissão (dd/mm/aaaa)" dica={`${cidadeNotif}, ${dataPorExtenso(dataEmissaoNotif)}.`}>
                    <div className="flex gap-2">
                      <Input
                        value={cidadeNotif}
                        onChange={(e) => setCidadeNotif(e.target.value)}
                        placeholder="Camboriú"
                      />
                      <Input
                        value={dataEmissaoNotif}
                        onChange={(e) => setDataEmissaoNotif(e.target.value)}
                        placeholder="30/10/2026"
                        className="w-32 shrink-0"
                      />
                    </div>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field rotulo="Condômino / Proprietário(a) *">
                    <Input
                      value={destinatarioNome}
                      onChange={(e) => setDestinatarioNome(e.target.value)}
                      placeholder="Ex.: APARECIDO GRANZOTTO"
                    />
                  </Field>

                  <Field rotulo="Unidade / Apartamento *">
                    <Input
                      value={unidade}
                      onChange={(e) => setUnidade(e.target.value)}
                      placeholder="Ex.: Apto 501"
                    />
                  </Field>

                  <Field rotulo="Inquilino(a) / Morador(a) (opcional)">
                    <Input
                      value={inquilinoNome}
                      onChange={(e) => setInquilinoNome(e.target.value)}
                      placeholder="Ex.: Pamela (deixe vazio se não houver)"
                    />
                  </Field>
                </div>

                {modalidade !== "notificacao" && (
                  <div className="grid gap-4 rounded-md border bg-background p-3 md:grid-cols-12">
                    <div className="md:col-span-7">
                      <Field
                        rotulo="Enquadramento da Multa na Convenção / Regimento"
                        dica="Ex.: 20% do salário-mínimo vigente, nos termos do Art. 21 da Convenção"
                      >
                        <Input
                          value={enquadramentoMulta}
                          onChange={(e) => setEnquadramentoMulta(e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="md:col-span-5">
                      <Field
                        rotulo="Valor da Multa (R$)"
                        dica={
                          valorMultaNumero
                            ? `Por extenso: (${valorPorExtensoBRL(valorMultaNumero)})`
                            : "Informe o valor numérico em reais"
                        }
                      >
                        <Input
                          value={valorMultaStr}
                          onChange={(e) => setValorMultaStr(e.target.value)}
                          placeholder="303,60"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Field rotulo="1º Parágrafo — Relato do Fato / Ocorrência">
                    <Textarea
                      rows={3}
                      value={paragrafoFato}
                      onChange={(e) => setParagrafoFato(e.target.value)}
                    />
                  </Field>

                  <Field rotulo="2º Parágrafo — Base Legal (preenchido a partir da resposta da IA, editável)">
                    <Textarea
                      rows={4}
                      value={paragrafoBaseLegal}
                      onChange={(e) => setParagrafoBaseLegal(e.target.value)}
                    />
                  </Field>

                  <Field rotulo="3º Parágrafo — Providência / Multa / Prazo de Recurso">
                    <Textarea
                      rows={3}
                      value={paragrafoProvidencia}
                      onChange={(e) => setParagrafoProvidencia(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
                  <Field rotulo="Cargo na Assinatura" className="w-56">
                    <Input
                      value={cargoAssinatura}
                      onChange={(e) => setCargoAssinatura(e.target.value)}
                      placeholder="SÍNDICO"
                    />
                  </Field>

                  <Button
                    type="button"
                    onClick={() => void gerarDocxNotificacao()}
                    disabled={gerandoDocx}
                  >
                    {gerandoDocx ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                    Baixar Notificação Editável (.DOCX)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard titulo="Histórico Recente de Consultas" descricao="Últimas perguntas realizadas neste escopo.">
        {historico.data && historico.data.length > 0 ? (
          <ul className="divide-y text-sm">
            {historico.data.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <button
                  type="button"
                  onClick={() => setPergunta(h.pergunta)}
                  className="min-w-0 flex-1 text-left hover:underline"
                  title="Clique para reutilizar esta pergunta"
                >
                  {h.condoNome && <strong className="mr-1.5 text-xs text-primary">[{h.condoNome}]</strong>}
                  {h.pergunta}
                </button>
                <Badge variant={ORIGEM_VARIANTE[h.origem]}>{ORIGEM_ROTULO[h.origem]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma pergunta realizada ainda para este escopo.</p>
        )}
      </SectionCard>
    </>
  );
}
