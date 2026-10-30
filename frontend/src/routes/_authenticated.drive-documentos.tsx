import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import {
  Download,
  Edit3,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderInput,
  FolderOpen,
  Loader2,
  MoreVertical,
  Plus,
  Printer,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { CATEGORIAS_DOCUMENTO, classificarDocumentoPorNome, rotuloCategoriaDocumento } from "@/domain/notificacao";
import { normalizarCondominio } from "@/domain/condominio";
import type { Condominio, DocumentoDrive, DocumentoDriveConteudo, TipoDocumentoConsulta } from "@/domain/types";
import { api, mensagemErro } from "@/lib/api";
import {
  arquivoPrecisaPerguntaConversao,
  baixarBase64,
  base64ParaBlobUrl,
  detectarFormatoArquivo,
  formatarTamanhoBytes,
  imprimirPdfBase64,
  processarArquivoParaRegistroDrive,
} from "@/lib/driveProcessador";
import { cabecalho } from "@/lib/head";
import { documentosDriveQuery, documentosResumoQuery, listaQuery } from "@/lib/queries";

type BuscaDrive = { condoId?: string; docId?: string };

export const Route = createFileRoute("/_authenticated/drive-documentos")({
  head: () =>
    cabecalho(
      "Drive de Documentos",
      "Repositório online de documentos dos condomínios com visualização PDF inline, conversão automática e busca rápida.",
    ),
  validateSearch: (s: Record<string, unknown>): BuscaDrive => {
    const condoId = typeof s["condoId"] === "string" && s["condoId"] ? s["condoId"] : undefined;
    const docId = typeof s["docId"] === "string" && s["docId"] ? s["docId"] : undefined;
    return { ...(condoId ? { condoId } : {}), ...(docId ? { docId } : {}) };
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
  component: PaginaDriveDocumentos,
});

type MenuContextoEstado = {
  x: number;
  y: number;
  doc: DocumentoDrive;
} | null;

function iconeFormato(formato?: string) {
  if (formato === "docx") return <FileSpreadsheet className="size-4 shrink-0 text-blue-600" />;
  if (formato === "jpg" || formato === "png" || formato === "webp") {
    return <FileImage className="size-4 shrink-0 text-amber-600" />;
  }
  return <FileText className="size-4 shrink-0 text-red-600" />;
}

function PaginaDriveDocumentos() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/drive-documentos" });
  const qc = useQueryClient();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const resumoQuery = useQuery(documentosResumoQuery());

  const ordenados = useMemo(
    () => [...condominios].sort((a, b) => (a.nomeRelatorio || a.nome).localeCompare(b.nomeRelatorio || b.nome, "pt-BR")),
    [condominios],
  );

  const condoId =
    busca.condoId && ordenados.some((c) => c.id === busca.condoId) ? busca.condoId : (ordenados[0]?.id ?? "");
  const condoAtual = useMemo(
    () => (condoId ? normalizarCondominio(ordenados.find((c) => c.id === condoId) ?? { id: condoId }) : null),
    [condoId, ordenados],
  );

  const docsQuery = useQuery(documentosDriveQuery(condoId));
  const documentos = docsQuery.data ?? [];

  // Filtros do Drive
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroData, setFiltroData] = useState<string>("");

  // Upload e conversão
  const inputArquivosRef = useRef<HTMLInputElement | null>(null);
  const inputPastaRef = useRef<HTMLInputElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [arquivosPendentes, setArquivosPendentes] = useState<File[]>([]);
  const [modalConversaoAberto, setModalConversaoAberto] = useState(false);
  const [manterOriginal, setManterOriginal] = useState(true);
  const [categoriaEnvio, setCategoriaEnvio] = useState<TipoDocumentoConsulta>("outro");
  const [dataDocumentoEnvio, setDataDocumentoEnvio] = useState<string>("");
  const [progressoEnvio, setProgressoEnvio] = useState<string | null>(null);

  // Visualizador inline PDF
  const [docVisualizando, setDocVisualizando] = useState<DocumentoDriveConteudo | null>(null);
  const [pdfUrlInline, setPdfUrlInline] = useState<string | null>(null);
  const [carregandoConteudoId, setCarregandoConteudoId] = useState<string | null>(null);

  // Menu de contexto (botão direito do mouse)
  const [menuContexto, setMenuContexto] = useState<MenuContextoEstado>(null);

  // Modal Renomear / Categoria
  const [docEditando, setDocEditando] = useState<DocumentoDrive | null>(null);
  const [novoNomeArquivo, setNovoNomeArquivo] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<TipoDocumentoConsulta>("outro");
  const [novaDataDoc, setNovaDataDoc] = useState("");

  // Modal Caminhos Locais
  const [modalCaminhosAberto, setModalCaminhosAberto] = useState(false);
  const [pastaPrincipal, setPastaPrincipal] = useState("");
  const [caminhosExtras, setCaminhosExtras] = useState<string[]>([]);
  const [novoCaminhoExtra, setNovoCaminhoExtra] = useState("");

  useEffect(() => {
    const fechar = () => setMenuContexto(null);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrlInline) URL.revokeObjectURL(pdfUrlInline);
    };
  }, [pdfUrlInline]);

  // Se veio docId na URL, abre automaticamente o visualizador inline
  useEffect(() => {
    if (busca.docId && documentos.some((d) => d.id === busca.docId) && docVisualizando?.id !== busca.docId) {
      void abrirVisualizadorInline(busca.docId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca.docId, documentos]);

  const opcoesCondo = useMemo(() => {
    const mapaResumo = resumoQuery.data ?? {};
    return opcoesCondominio(ordenados, true).map((op) => {
      const qtd = mapaResumo[op.value] ?? 0;
      return {
        ...op,
        detalhe: [op.detalhe, qtd > 0 ? `${qtd} doc(s) no Drive` : "Sem docs no Drive"].filter(Boolean).join(" • "),
      };
    });
  }, [ordenados, resumoQuery.data]);

  const documentosFiltrados = useMemo(() => {
    const t = termoBusca.trim().toLowerCase();
    return documentos.filter((doc) => {
      if (filtroCategoria !== "todas" && doc.tipo !== filtroCategoria) return false;
      if (filtroData && (!doc.dataDocumento || !doc.dataDocumento.startsWith(filtroData))) return false;
      if (!t) return true;
      const rotuloCat = rotuloCategoriaDocumento(doc.tipo).toLowerCase();
      return (
        doc.arquivo.toLowerCase().includes(t) ||
        (doc.nomeOriginal ?? "").toLowerCase().includes(t) ||
        rotuloCat.includes(t) ||
        (doc.dataDocumento ?? "").includes(t) ||
        (doc.formatoOriginal ?? "pdf").toLowerCase().includes(t)
      );
    });
  }, [documentos, termoBusca, filtroCategoria, filtroData]);

  async function executarEnvioArquivos(
    arquivos: File[],
    manterOrig: boolean,
    tipoEscolhido?: TipoDocumentoConsulta,
    dataEscolhida?: string,
  ) {
    if (!condoId || arquivos.length === 0) return;
    setProgressoEnvio(`Processando 1 de ${arquivos.length}...`);
    try {
      const registros = [];
      for (let i = 0; i < arquivos.length; i++) {
        const arq = arquivos[i]!;
        setProgressoEnvio(`Processando ${i + 1} de ${arquivos.length}: ${arq.name}...`);
        const tipoDoc = tipoEscolhido ?? classificarDocumentoPorNome(arq.name);
        const reg = await processarArquivoParaRegistroDrive(arq, {
          tipo: tipoDoc,
          dataDocumento: dataEscolhida?.trim() ? dataEscolhida.trim() : null,
          manterOriginal: manterOrig,
          caminhoRelativo: (arq as File & { webkitRelativePath?: string }).webkitRelativePath || arq.name,
        });
        registros.push(reg);
      }
      setProgressoEnvio("Salvando no Drive do condomínio...");
      const res = await api.documentos.registrar(condoId, registros, false);
      toast.success(`${registros.length} documento(s) armazenado(s) e indexado(s) no Drive (${res.inseridos} novo(s)).`);
      await qc.invalidateQueries({ queryKey: ["documentos"] });
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setProgressoEnvio(null);
      setArquivosPendentes([]);
      setModalConversaoAberto(false);
    }
  }

  function receberArquivosSelecionados(listaArquivos: FileList | File[]) {
    const validos = Array.from(listaArquivos).filter((f) => detectarFormatoArquivo(f.name) !== null);
    if (validos.length === 0) {
      toast.error("Selecione arquivos nos formatos PDF, DOCX, JPG, PNG ou WEBP.");
      return;
    }
    const primeiro = validos[0]!;
    setCategoriaEnvio(classificarDocumentoPorNome(primeiro.name));
    setDataDocumentoEnvio("");
    const algumPrecisaConversao = validos.some(arquivoPrecisaPerguntaConversao);
    if (algumPrecisaConversao) {
      setArquivosPendentes(validos);
      setManterOriginal(true);
      setModalConversaoAberto(true);
    } else {
      // Para PDFs, também abrimos o modal rápido ou enviamos direto
      setArquivosPendentes(validos);
      setManterOriginal(false);
      setModalConversaoAberto(true);
    }
  }

  async function abrirVisualizadorInline(id: string) {
    setCarregandoConteudoId(id);
    try {
      const conteudo = await api.documentos.conteudo(id);
      if (pdfUrlInline) URL.revokeObjectURL(pdfUrlInline);
      if (conteudo.pdfBase64) {
        setPdfUrlInline(base64ParaBlobUrl(conteudo.pdfBase64, "application/pdf"));
      } else {
        setPdfUrlInline(null);
      }
      setDocVisualizando(conteudo);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCarregandoConteudoId(null);
    }
  }

  async function acaoBaixarPdf(doc: DocumentoDrive) {
    try {
      const c = docVisualizando?.id === doc.id ? docVisualizando : await api.documentos.conteudo(doc.id);
      if (!c.pdfBase64) {
        toast.error("Este documento foi indexado apenas como texto pelo agente local e não possui binário PDF salvo online.");
        return;
      }
      const nomePdf = c.arquivo.toLowerCase().endsWith(".pdf") ? c.arquivo : `${c.arquivo}.pdf`;
      baixarBase64(c.pdfBase64, nomePdf, "application/pdf");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  async function acaoBaixarOriginal(doc: DocumentoDrive) {
    try {
      const c = docVisualizando?.id === doc.id ? docVisualizando : await api.documentos.conteudo(doc.id);
      if (!c.originalBase64) {
        toast.error("O arquivo original não foi mantido para este documento (apenas a versão PDF está disponível).");
        return;
      }
      baixarBase64(
        c.originalBase64,
        c.nomeOriginal || doc.arquivo,
        c.mimeOriginal || "application/octet-stream",
      );
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  async function acaoImprimirOnline(doc: DocumentoDrive) {
    try {
      const c = docVisualizando?.id === doc.id ? docVisualizando : await api.documentos.conteudo(doc.id);
      if (!c.pdfBase64) {
        toast.error("Binário PDF indisponível para impressão online.");
        return;
      }
      imprimirPdfBase64(c.pdfBase64);
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  function abrirModalEditar(doc: DocumentoDrive) {
    setDocEditando(doc);
    setNovoNomeArquivo(doc.arquivo);
    setNovaCategoria(doc.tipo);
    setNovaDataDoc(doc.dataDocumento ?? "");
  }

  const salvarEdicaoDoc = useMutation({
    mutationFn: async () => {
      if (!docEditando) return;
      await api.documentos.atualizar(docEditando.id, {
        arquivo: novoNomeArquivo.trim() || docEditando.arquivo,
        tipo: novaCategoria,
        dataDocumento: novaDataDoc.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Documento atualizado.");
      setDocEditando(null);
      void qc.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const excluirDoc = useMutation({
    mutationFn: (id: string) => api.documentos.excluir(id),
    onSuccess: (_, id) => {
      toast.success("Documento removido do Drive.");
      if (docVisualizando?.id === id) {
        setDocVisualizando(null);
        if (pdfUrlInline) URL.revokeObjectURL(pdfUrlInline);
        setPdfUrlInline(null);
      }
      void qc.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  function abrirModalCaminhos() {
    if (!condoAtual) return;
    setPastaPrincipal(condoAtual.pastaDocumentos ?? "");
    setCaminhosExtras(Array.isArray(condoAtual.caminhosDocumentos) ? [...condoAtual.caminhosDocumentos] : []);
    setNovoCaminhoExtra("");
    setModalCaminhosAberto(true);
  }

  const salvarCaminhosCondominio = useMutation({
    mutationFn: async () => {
      if (!condoAtual) return;
      const atualizado: Condominio = {
        ...condoAtual,
        pastaDocumentos: pastaPrincipal.trim(),
        caminhosDocumentos: caminhosExtras.map((c) => c.trim()).filter(Boolean),
      };
      await api.salvar("condominios", atualizado);
    },
    onSuccess: () => {
      toast.success("Caminhos locais de documentos salvos no condomínio.");
      setModalCaminhosAberto(false);
      void qc.invalidateQueries({ queryKey: ["store", "condominios"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  function abrirMenuDireito(e: MouseEvent, doc: DocumentoDrive) {
    e.preventDefault();
    setMenuContexto({
      x: Math.min(e.clientX, window.innerWidth - 260),
      y: Math.min(e.clientY, window.innerHeight - 310),
      doc,
    });
  }

  function aoSoltarArquivos(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      receberArquivosSelecionados(e.dataTransfer.files);
    }
  }

  if (ordenados.length === 0) {
    return (
      <>
        <PageHeader
          titulo="Drive de Documentos"
          descricao="Repositório online de documentos dos condomínios com visualização PDF inline e busca inteligente."
        />
        <SectionCard titulo="Nenhum condomínio cadastrado">
          <p className="text-sm text-muted-foreground">Cadastre um condomínio para organizar e enviar documentos.</p>
        </SectionCard>
      </>
    );
  }

  const totalCaminhosConfigurados =
    (condoAtual?.pastaDocumentos?.trim() ? 1 : 0) + (condoAtual?.caminhosDocumentos?.length ?? 0);

  return (
    <>
      <PageHeader
        titulo="Drive de Documentos"
        descricao="Suba qualquer documento (PDF, Word DOCX ou Imagens JPG/PNG), visualize sempre em PDF inline, baixe, imprima online ou consulte com IA."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={abrirModalCaminhos}>
              <FolderInput className="size-4" />
              Caminhos Locais ({totalCaminhosConfigurados})
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/consulta-documentos", search: { condoId } })}
            >
              <Sparkles className="size-4 text-amber-500" />
              Consulta Inteligente (IA)
            </Button>
            <Button onClick={() => inputArquivosRef.current?.click()} disabled={Boolean(progressoEnvio)}>
              {progressoEnvio ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Subir Documentos
            </Button>
          </div>
        }
      />

      <input
        ref={inputArquivosRef}
        type="file"
        multiple
        accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) receberArquivosSelecionados(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={inputPastaRef}
        type="file"
        multiple
        // @ts-expect-error atributo webkitdirectory suportado nos navegadores modernos
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) receberArquivosSelecionados(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Seleção de Condomínio + Área de Upload Drag-and-Drop */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionCard titulo="Condomínio Ativo">
            <Field
              rotulo="Condomínio"
              dica="Digite o nome, código ou CNPJ para trocar rapidamente de condomínio."
            >
              <SelecaoBusca
                value={condoId}
                onChange={(id) => {
                  setDocVisualizando(null);
                  navigate({ search: { condoId: id }, replace: true });
                }}
                opcoes={opcoesCondo}
                placeholder="Escolha o condomínio"
                placeholderBusca="Pesquisar condomínio por nome, código ou CNPJ..."
              />
            </Field>
            {condoAtual?.pastaDocumentos && (
              <p className="mt-2 truncate text-xs text-muted-foreground" title={condoAtual.pastaDocumentos}>
                📁 Pasta vinculada: <span className="font-mono">{condoAtual.pastaDocumentos}</span>
              </p>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-7">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltarArquivos}
            onClick={() => !progressoEnvio && inputArquivosRef.current?.click()}
            className={`flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
              arrastando
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <Upload className="mb-2 size-7 text-primary/80" />
            <p className="text-sm font-medium">
              {progressoEnvio ?? "Arraste e solte arquivos aqui ou clique para enviar ao Drive"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aceita <strong>PDF, Word (.DOCX) e Imagens (.JPG, .PNG, .WEBP)</strong> — qualquer tipo de documento
              (Convenção, Regimento, Atas, Contratos, Apólices, Laudos, Notificações, etc.)
            </p>
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => inputArquivosRef.current?.click()}>
                Selecionar arquivos
              </Button>
              <Button size="sm" variant="outline" onClick={() => inputPastaRef.current?.click()}>
                <FolderOpen className="size-3.5" />
                Importar pasta local inteira
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros do Drive */}
      <SectionCard
        titulo={`Arquivos do Condomínio (${documentosFiltrados.length})`}
        descricao="Dica: clique duas vezes para abrir o PDF inline ou clique com o botão direito do mouse sobre qualquer linha para ver todas as ações."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Pesquisar por nome do arquivo, categoria, data ou formato (PDF, DOCX, JPG)..."
              className="pl-9"
            />
          </div>
          <div className="sm:col-span-3">
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger aria-label="Filtrar por categoria">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIAS_DOCUMENTO.map((cat) => (
                  <SelectItem key={cat.valor} value={cat.valor}>
                    {cat.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <Input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              aria-label="Filtrar por data do documento"
            />
            {(termoBusca || filtroCategoria !== "todas" || filtroData) && (
              <Button
                variant="ghost"
                size="icon"
                title="Limpar filtros"
                onClick={() => {
                  setTermoBusca("");
                  setFiltroCategoria("todas");
                  setFiltroData("");
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Lista / Tabela e Visualizador Inline lado a lado quando aberto */}
        <div className={`grid gap-4 ${docVisualizando ? " lg:grid-cols-12" : ""}`}>
          <div className={docVisualizando ? "lg:col-span-6" : ""}>
            {docsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Carregando documentos do Drive...
              </div>
            ) : documentosFiltrados.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <FolderOpen className="mx-auto mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Nenhum documento encontrado neste filtro</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Suba arquivos PDF, DOCX ou JPG/PNG acima ou importe uma pasta local para iniciar o Drive deste condomínio.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Arquivo</th>
                      <th className="px-3 py-2.5">Categoria</th>
                      <th className="px-3 py-2.5">Formato</th>
                      <th className="px-3 py-2.5">Data / Págs</th>
                      <th className="px-3 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documentosFiltrados.map((doc) => {
                      const selecionado = docVisualizando?.id === doc.id;
                      const fmt = (doc.formatoOriginal ?? "pdf").toUpperCase();
                      return (
                        <tr
                          key={doc.id}
                          onContextMenu={(e) => abrirMenuDireito(e, doc)}
                          onDoubleClick={() => void abrirVisualizadorInline(doc.id)}
                          className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                            selecionado ? "bg-primary/5 font-medium" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {iconeFormato(doc.formatoOriginal)}
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => void abrirVisualizadorInline(doc.id)}
                                  className="block truncate text-left hover:underline"
                                  title="Clique para visualizar o PDF inline"
                                >
                                  {doc.arquivo}
                                </button>
                                <span className="text-xs text-muted-foreground">
                                  {doc.tamanhoBytes ? formatarTamanhoBytes(doc.tamanhoBytes) : "Indexado via Agente"}
                                  {doc.temOriginal ? ` • Original (${fmt}) preservado` : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="secondary">{rotuloCategoriaDocumento(doc.tipo)}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline">
                              {fmt === "PDF" ? "PDF" : `${fmt} → PDF`}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            <div>{doc.dataDocumento || "Sem data"}</div>
                            <div>{doc.paginas} pág(s)</div>
                          </td>
                          <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Abrir PDF inline"
                                onClick={() => void abrirVisualizadorInline(doc.id)}
                              >
                                {carregandoConteudoId === doc.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Eye className="size-4" />
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" aria-label={`Ações para ${doc.arquivo}`}>
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuItem onClick={() => void abrirVisualizadorInline(doc.id)}>
                                    <Eye className="mr-2 size-4" />
                                    Abrir / Visualizar PDF inline
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      navigate({
                                        to: "/consulta-documentos",
                                        search: { condoId, docId: doc.id },
                                      })
                                    }
                                  >
                                    <Sparkles className="mr-2 size-4 text-amber-500" />
                                    Perguntar à IA sobre este arquivo
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => void acaoImprimirOnline(doc)}>
                                    <Printer className="mr-2 size-4" />
                                    Imprimir online
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void acaoBaixarPdf(doc)}>
                                    <Download className="mr-2 size-4" />
                                    Baixar em PDF
                                  </DropdownMenuItem>
                                  {doc.temOriginal && (
                                    <DropdownMenuItem onClick={() => void acaoBaixarOriginal(doc)}>
                                      <Download className="mr-2 size-4 text-blue-600" />
                                      Baixar original ({(doc.formatoOriginal ?? "").toUpperCase()})
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => abrirModalEditar(doc)}>
                                    <Edit3 className="mr-2 size-4" />
                                    Renomear / Categoria
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => excluirDoc.mutate(doc.id)}
                                  >
                                    <Trash2 className="mr-2 size-4" />
                                    Excluir do Drive
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Painel de Visualização Inline em PDF */}
          {docVisualizando && (
            <div className="flex flex-col rounded-lg border bg-card lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{docVisualizando.arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    Visualização sempre em PDF inline • {rotuloCategoriaDocumento(docVisualizando.tipo)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate({
                        to: "/consulta-documentos",
                        search: { condoId: docVisualizando.condoId, docId: docVisualizando.id },
                      })
                    }
                  >
                    <Sparkles className="size-3.5 text-amber-500" />
                    Perguntar à IA
                  </Button>
                  {pdfUrlInline && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => docVisualizando.pdfBase64 && imprimirPdfBase64(docVisualizando.pdfBase64)}
                      >
                        <Printer className="size-3.5" />
                        Imprimir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          docVisualizando.pdfBase64 &&
                          baixarBase64(
                            docVisualizando.pdfBase64,
                            docVisualizando.arquivo.toLowerCase().endsWith(".pdf")
                              ? docVisualizando.arquivo
                              : `${docVisualizando.arquivo}.pdf`,
                            "application/pdf",
                          )
                        }
                      >
                        <Download className="size-3.5" />
                        PDF
                      </Button>
                    </>
                  )}
                  {docVisualizando.temOriginal && docVisualizando.originalBase64 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        baixarBase64(
                          docVisualizando.originalBase64!,
                          docVisualizando.nomeOriginal || docVisualizando.arquivo,
                          docVisualizando.mimeOriginal || "application/octet-stream",
                        )
                      }
                    >
                      <Download className="size-3.5" />
                      Original ({docVisualizando.formatoOriginal.toUpperCase()})
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setDocVisualizando(null);
                      if (pdfUrlInline) URL.revokeObjectURL(pdfUrlInline);
                      setPdfUrlInline(null);
                    }}
                    aria-label="Fechar visualização inline"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="min-h-[540px] flex-1 bg-muted/30 p-2">
                {pdfUrlInline ? (
                  <iframe
                    src={pdfUrlInline}
                    title={`Visualização PDF de ${docVisualizando.arquivo}`}
                    className="h-[540px] w-full rounded border bg-white"
                  />
                ) : (
                  <div className="flex h-[540px] flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    <FileText className="mb-2 size-8" />
                    <p>
                      Este documento foi sincronizado apenas com o texto extraído pelo agente local de pastas. Para
                      visualizar o PDF inline no navegador, envie o arquivo diretamente pelo botão{" "}
                      <strong>Subir Documentos</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Menu de Contexto do Botão Direito do Mouse */}
      {menuContexto && (
        <div
          style={{ top: menuContexto.y, left: menuContexto.x }}
          className="fixed z-50 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className=" truncate border-b px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
            {menuContexto.doc.arquivo}
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              void abrirVisualizadorInline(d.id);
            }}
          >
            <Eye className="size-4" />
            Abrir / Visualizar PDF inline
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              navigate({ to: "/consulta-documentos", search: { condoId, docId: d.id } });
            }}
          >
            <Sparkles className="size-4 text-amber-500" />
            Perguntar à IA sobre este arquivo
          </button>
          <div className="my-1 border-t" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              void acaoImprimirOnline(d);
            }}
          >
            <Printer className="size-4" />
            Imprimir online
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              void acaoBaixarPdf(d);
            }}
          >
            <Download className="size-4" />
            Baixar em PDF
          </button>
          {menuContexto.doc.temOriginal && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                const d = menuContexto.doc;
                setMenuContexto(null);
                void acaoBaixarOriginal(d);
              }}
            >
              <Download className="size-4 text-blue-600" />
              Baixar original ({(menuContexto.doc.formatoOriginal ?? "").toUpperCase()})
            </button>
          )}
          <div className="my-1 border-t" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              abrirModalEditar(d);
            }}
          >
            <Edit3 className="size-4" />
            Renomear / Alterar categoria
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              excluirDoc.mutate(d.id);
            }}
          >
            <Trash2 className="size-4" />
            Excluir do Drive
          </button>
        </div>
      )}

      {/* Modal de Upload + Opção de Conversão DOCX / JPG para PDF */}
      <Dialog open={modalConversaoAberto} onOpenChange={setModalConversaoAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar {arquivosPendentes.length} documento(s) para o Drive</DialogTitle>
            <DialogDescription>
              Defina a classificação e como os arquivos devem ser armazenados no repositório do condomínio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="max-h-28 overflow-y-auto rounded border bg-muted/40 p-2 text-xs">
              {arquivosPendentes.map((arq, idx) => (
                <div key={`${arq.name}-${idx}`} className="flex items-center justify-between py-0.5">
                  <span className="truncate font-medium">{arq.name}</span>
                  <span className="ml-2 shrink-0 text-muted-foreground">{formatarTamanhoBytes(arq.size)}</span>
                </div>
              ))}
            </div>

            {arquivosPendentes.some(arquivoPrecisaPerguntaConversao) && (
              <div className="space-y-2 rounded-lg border bg-amber-500/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Arquivo Word (.DOCX) ou Imagem (.JPG/.PNG) detectado
                </p>
                <p className="text-xs text-muted-foreground">
                  A visualização em tela será <strong>sempre em PDF inline</strong>. Como deseja armazenar o arquivo no Drive?
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded border bg-background p-2.5 text-xs">
                  <input
                    type="radio"
                    name="modoConversao"
                    checked={manterOriginal}
                    onChange={() => setManterOriginal(true)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold">
                      Converter para PDF e manter também o arquivo original (Recomendado)
                    </span>
                    <p className="text-muted-foreground">
                      Permite visualizar/imprimir em PDF inline e baixar tanto o PDF quanto o arquivo original (.DOCX / .JPG).
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded border bg-background p-2.5 text-xs">
                  <input
                    type="radio"
                    name="modoConversao"
                    checked={!manterOriginal}
                    onChange={() => setManterOriginal(false)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold">Converter e armazenar apenas em PDF</span>
                    <p className="text-muted-foreground">
                      Converte para PDF para leitura inline e download único em PDF.
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field rotulo="Categoria do documento">
                <Select
                  value={categoriaEnvio}
                  onValueChange={(v) => setCategoriaEnvio(v as TipoDocumentoConsulta)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DOCUMENTO.map((cat) => (
                      <SelectItem key={cat.valor} value={cat.valor}>
                        {cat.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field rotulo="Data do documento (opcional)">
                <Input
                  type="date"
                  value={dataDocumentoEnvio}
                  onChange={(e) => setDataDocumentoEnvio(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConversaoAberto(false)} disabled={Boolean(progressoEnvio)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                void executarEnvioArquivos(arquivosPendentes, manterOriginal, categoriaEnvio, dataDocumentoEnvio)
              }
              disabled={Boolean(progressoEnvio)}
            >
              {progressoEnvio ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {progressoEnvio ?? "Confirmar e Armazenar no Drive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Renomear / Alterar Categoria */}
      <Dialog open={Boolean(docEditando)} onOpenChange={(o) => !o && setDocEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear ou Classificar Documento</DialogTitle>
            <DialogDescription>Atualize o nome de exibição, categoria ou data de referência no Drive.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field rotulo="Nome do arquivo">
              <Input value={novoNomeArquivo} onChange={(e) => setNovoNomeArquivo(e.target.value)} />
            </Field>
            <Field rotulo="Categoria">
              <Select value={novaCategoria} onValueChange={(v) => setNovaCategoria(v as TipoDocumentoConsulta)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_DOCUMENTO.map((cat) => (
                    <SelectItem key={cat.valor} value={cat.valor}>
                      {cat.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field rotulo="Data do documento">
              <Input type="date" value={novaDataDoc} onChange={(e) => setNovaDataDoc(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={() => salvarEdicaoDoc.mutate()} disabled={salvarEdicaoDoc.isPending}>
              <Tag className="size-4" />
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Caminhos Locais de Documentos */}
      <Dialog open={modalCaminhosAberto} onOpenChange={setModalCaminhosAberto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Caminhos Locais de Documentos ({condoAtual?.nomeRelatorio || condoAtual?.nome})</DialogTitle>
            <DialogDescription>
              Informe o caminho principal ou outros caminhos locais/rede onde constam os documentos deste condomínio, ou
              importe os arquivos de uma pasta local diretamente pelo navegador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field
              rotulo="Caminho principal da pasta de documentos (Servidor / Computador)"
              dica="Ex.: C:\Users\Evandro\OneDrive\Desktop\Arquivos\Krieger\Condominios\Santa Cecilia"
            >
              <Input
                value={pastaPrincipal}
                onChange={(e) => setPastaPrincipal(e.target.value)}
                placeholder="C:\Caminho\Para\Documentos\Do\Condominio"
              />
            </Field>

            <div className="space-y-2">
              <p className="text-xs font-medium">Outros caminhos locais adicionais para análise</p>
              <div className="flex gap-2">
                <Input
                  value={novoCaminhoExtra}
                  onChange={(e) => setNovoCaminhoExtra(e.target.value)}
                  placeholder="Adicionar outro caminho local (ex.: D:\Atas_Antigas\Santa_Cecilia)..."
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const v = novoCaminhoExtra.trim();
                    if (!v) return;
                    setCaminhosExtras((prev) => [...prev, v]);
                    setNovoCaminhoExtra("");
                  }}
                >
                  <Plus className="size-4" />
                  Incluir
                </Button>
              </div>
              {caminhosExtras.length > 0 && (
                <ul className="divide-y rounded border text-xs">
                  {caminhosExtras.map((c, i) => (
                    <li key={`${c}-${i}`} className="flex items-center justify-between px-3 py-1.5">
                      <span className="truncate font-mono">{c}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => setCaminhosExtras((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-semibold">Importar arquivos de uma pasta local agora pelo navegador</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Você também pode escolher qualquer pasta do seu computador para subir e indexar todos os PDFs, DOCX e
                imagens dela diretamente para o Drive online:
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setModalCaminhosAberto(false);
                  inputPastaRef.current?.click();
                }}
              >
                <FolderOpen className="size-4" />
                Selecionar pasta local no computador...
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCaminhosAberto(false)}>
              Fechar
            </Button>
            <Button onClick={() => salvarCaminhosCondominio.mutate()} disabled={salvarCaminhosCondominio.isPending}>
              Salvar Caminhos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
