import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import {
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreVertical,
  Package,
  Plus,
  Printer,
  Search,
  Settings2,
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
import {
  extrairPastaDoDocumento,
  gerarSlugCategoria,
  obterCategoriasDrive,
  pastaPadraoOutros,
  resolverAlocacaoDocumentoDrive,
  rotuloCategoriaDocumento,
  type AlocacaoPastaDrive,
} from "@/domain/notificacao";
import { normalizarCondominio } from "@/domain/condominio";
import type {
  CategoriaPastaDrive,
  Condominio,
  ConfigEscritorio,
  DocumentoDrive,
  DocumentoDriveConteudo,
  TipoDocumentoConsulta,
} from "@/domain/types";
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
import { documentosDriveQuery, documentosResumoQuery, itemQuery, listaQuery } from "@/lib/queries";

type BuscaDrive = { condoId?: string; docId?: string };

export const Route = createFileRoute("/_authenticated/drive-documentos")({
  head: () =>
    cabecalho(
      "Drive de Documentos",
      "Repositório online de documentos dos condomínios com pastas/subpastas automáticas, cadastro de categorias e visualização PDF inline.",
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

type ItemUploadPendente = {
  arquivo: File;
  alocacao: AlocacaoPastaDrive;
};

type NoPasta = {
  caminho: string;
  nome: string;
  nivel: number;
  quantidade: number;
  padraoOutros: boolean;
};

function iconeFormato(formato?: string) {
  if (formato === "docx") return <FileSpreadsheet className="size-4 shrink-0 text-blue-600" />;
  if (formato === "jpg" || formato === "png" || formato === "webp") {
    return <FileImage className="size-4 shrink-0 text-amber-600" />;
  }
  return <FileText className="size-4 shrink-0 text-red-600" />;
}

function badgeRegraAlocacao(regra: AlocacaoPastaDrive["regra"]) {
  if (regra === "subpasta_origem") {
    return (
      <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
        Pasta/subpasta da origem
      </Badge>
    );
  }
  if (regra === "auto_nome") {
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        Auto-identificado pelo nome
      </Badge>
    );
  }
  if (regra === "manual") {
    return <Badge variant="secondary">Pasta escolhida</Badge>;
  }
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
      Não identificado → Outros Documentos
    </Badge>
  );
}

function PaginaDriveDocumentos() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/drive-documentos" });
  const qc = useQueryClient();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const escritorioQuery = useQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const resumoQuery = useQuery(documentosResumoQuery());

  const categoriasAtivas = useMemo(
    () => obterCategoriasDrive(escritorioQuery.data?.categoriasDrive),
    [escritorioQuery.data?.categoriasDrive],
  );
  const pastaOutros = useMemo(() => pastaPadraoOutros(categoriasAtivas), [categoriasAtivas]);

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

  // Navegação de pastas e filtros do Drive
  const [pastaAtiva, setPastaAtiva] = useState<string>("todas");
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroData, setFiltroData] = useState<string>("");

  // Upload e conversão
  const inputArquivosRef = useRef<HTMLInputElement | null>(null);
  const inputPastaRef = useRef<HTMLInputElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [itensPendentes, setItensPendentes] = useState<ItemUploadPendente[]>([]);
  const [modalConversaoAberto, setModalConversaoAberto] = useState(false);
  const [manterOriginal, setManterOriginal] = useState(true);
  const [pastaForcadaEnvio, setPastaForcadaEnvio] = useState<string>("automatico");
  const [dataDocumentoEnvio, setDataDocumentoEnvio] = useState<string>("");
  const [progressoEnvio, setProgressoEnvio] = useState<string | null>(null);

  // Visualizador inline PDF
  const [docVisualizando, setDocVisualizando] = useState<DocumentoDriveConteudo | null>(null);
  const [docMetadadosVisualizando, setDocMetadadosVisualizando] = useState<DocumentoDrive | null>(null);
  const [pdfUrlInline, setPdfUrlInline] = useState<string | null>(null);
  const [carregandoConteudoId, setCarregandoConteudoId] = useState<string | null>(null);

  // Menu de contexto (botão direito do mouse)
  const [menuContexto, setMenuContexto] = useState<MenuContextoEstado>(null);

  // Modal Renomear / Mover Pasta / Categoria
  const [docEditando, setDocEditando] = useState<DocumentoDrive | null>(null);
  const [novoNomeArquivo, setNovoNomeArquivo] = useState("");
  const [novaPastaDoc, setNovaPastaDoc] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<TipoDocumentoConsulta>("outro");
  const [novaDataDoc, setNovaDataDoc] = useState("");

  // Modal Cadastro e Manutenção de Categorias e Pastas
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [listaCategoriasEdicao, setListaCategoriasEdicao] = useState<CategoriaPastaDrive[]>([]);
  const [novoRotuloCat, setNovoRotuloCat] = useState("");
  const [novasPalavrasCat, setNovasPalavrasCat] = useState("");
  const [novaSubpastaCondominio, setNovaSubpastaCondominio] = useState("");

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

  useEffect(() => {
    const alvo = busca.docId ? documentos.find((d) => d.id === busca.docId) : undefined;
    if (alvo && docVisualizando?.id !== alvo.id) {
      void abrirVisualizadorInline(alvo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca.docId, documentos]);

  // Constrói a árvore hierárquica de Pastas e Subpastas do condomínio
  const arvorePastas = useMemo((): NoPasta[] => {
    const contagens = new Map<string, number>();
    const caminhos = new Set<string>();

    // 1. Todas as pastas vindas das Categorias cadastradas
    for (const cat of categoriasAtivas) {
      caminhos.add(cat.rotulo);
    }
    // 2. Pastas e subpastas salvas no condomínio
    for (const p of condoAtual?.pastasDrive ?? []) {
      const limpo = p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
      if (limpo) caminhos.add(limpo);
    }
    // 3. Pastas e subpastas extraídas dos documentos existentes no Drive
    for (const doc of documentos) {
      const pastaDoc = extrairPastaDoDocumento(doc, categoriasAtivas);
      caminhos.add(pastaDoc);
      // Soma contagem na própria pasta e nas pastas-mãe
      const partes = pastaDoc.split("/").filter(Boolean);
      let acumulado = "";
      for (const parte of partes) {
        acumulado = acumulado ? `${acumulado}/${parte}` : parte;
        caminhos.add(acumulado);
        contagens.set(acumulado, (contagens.get(acumulado) ?? 0) + 1);
      }
    }

    const todosCaminhos = Array.from(caminhos);
    const normais = todosCaminhos
      .filter((c) => c !== pastaOutros.rotulo)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    const nos: NoPasta[] = normais.map((caminho) => {
      const partes = caminho.split("/");
      return {
        caminho,
        nome: partes[partes.length - 1] ?? caminho,
        nivel: partes.length - 1,
        quantidade: contagens.get(caminho) ?? 0,
        padraoOutros: false,
      };
    });

    nos.push({
      caminho: pastaOutros.rotulo,
      nome: pastaOutros.rotulo,
      nivel: 0,
      quantidade: contagens.get(pastaOutros.rotulo) ?? 0,
      padraoOutros: true,
    });

    return nos;
  }, [categoriasAtivas, condoAtual?.pastasDrive, documentos, pastaOutros.rotulo]);

  const opcoesCondo = useMemo(() => {
    const mapaResumo = resumoQuery.data ?? {};
    return opcoesCondominio(ordenados, true).map((op) => {
      const qtd = mapaResumo[op.valor] ?? 0;
      return {
        ...op,
        detalhe: [op.detalhe, qtd > 0 ? `${qtd} doc(s) no Drive` : "Sem docs no Drive"].filter(Boolean).join(" • "),
      };
    });
  }, [ordenados, resumoQuery.data]);

  const documentosFiltrados = useMemo(() => {
    const t = termoBusca.trim().toLowerCase();
    return documentos.filter((doc) => {
      const pastaDoc = extrairPastaDoDocumento(doc, categoriasAtivas);
      if (pastaAtiva !== "todas") {
        const pertenceAPastaOuSubpasta =
          pastaDoc === pastaAtiva || pastaDoc.startsWith(`${pastaAtiva}/`);
        if (!pertenceAPastaOuSubpasta) return false;
      }
      if (filtroData && (!doc.dataDocumento || !doc.dataDocumento.startsWith(filtroData))) return false;
      if (!t) return true;
      const rotuloCat = rotuloCategoriaDocumento(doc.tipo, categoriasAtivas).toLowerCase();
      return (
        doc.nomeArquivo.toLowerCase().includes(t) ||
        pastaDoc.toLowerCase().includes(t) ||
        rotuloCat.includes(t) ||
        (doc.dataDocumento ?? "").includes(t) ||
        (doc.formatoOriginal ?? "pdf").toLowerCase().includes(t)
      );
    });
  }, [documentos, categoriasAtivas, pastaAtiva, filtroData, termoBusca]);

  // Recalcula a alocação dos itens pendentes caso o usuário mude a pasta forçada no modal de upload
  const itensPendentesCalculados = useMemo(() => {
    return itensPendentes.map((item) => {
      const relOrigem = (item.arquivo as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      return {
        arquivo: item.arquivo,
        alocacao: resolverAlocacaoDocumentoDrive({
          nomeArquivo: item.arquivo.name,
          caminhoRelativoOrigem: relOrigem,
          pastaManual: pastaForcadaEnvio !== "automatico" ? pastaForcadaEnvio : null,
          categorias: categoriasAtivas,
        }),
      };
    });
  }, [itensPendentes, pastaForcadaEnvio, categoriasAtivas]);

  async function executarEnvioArquivos() {
    if (!condoId || itensPendentesCalculados.length === 0) return;
    setProgressoEnvio(`Processando 1 de ${itensPendentesCalculados.length}...`);
    try {
      const novasPastasDetectadas = new Set<string>(condoAtual?.pastasDrive ?? []);

      for (let i = 0; i < itensPendentesCalculados.length; i++) {
        const { arquivo, alocacao } = itensPendentesCalculados[i]!;
        setProgressoEnvio(`Processando ${i + 1} de ${itensPendentesCalculados.length}: ${arquivo.name}...`);
        novasPastasDetectadas.add(alocacao.pasta);

        const reg = await processarArquivoParaRegistroDrive(arquivo, {
          condoId,
          tipo: alocacao.tipo,
          dataDocumento: dataDocumentoEnvio.trim() ? dataDocumentoEnvio.trim() : null,
          manterOriginal,
          caminhoRelativo: alocacao.caminhoRelativo,
        });
        await api.documentos.registrar(reg);
      }

      // Cadastra automaticamente as novas pastas/subpastas no condomínio se houver alguma nova
      if (condoAtual) {
        const anteriores = new Set(condoAtual.pastasDrive ?? []);
        const mudouPastas = Array.from(novasPastasDetectadas).some((p) => !anteriores.has(p));
        if (mudouPastas) {
          await api.salvar("condominios", {
            ...condoAtual,
            pastasDrive: Array.from(novasPastasDetectadas),
          });
          await qc.invalidateQueries({ queryKey: ["store", "condominios"] });
        }
      }

      toast.success(
        `${itensPendentesCalculados.length} documento(s) enviados e alocados nas respectivas pastas do Drive!`,
      );
      await qc.invalidateQueries({ queryKey: ["documentos"] });
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setProgressoEnvio(null);
      setItensPendentes([]);
      setModalConversaoAberto(false);
    }
  }

  function receberArquivosSelecionados(listaArquivos: FileList | File[]) {
    const validos = Array.from(listaArquivos).filter((f) => detectarFormatoArquivo(f.name) !== "outro");
    if (validos.length === 0) {
      toast.error("Selecione arquivos nos formatos PDF, DOCX, JPG, PNG ou WEBP.");
      return;
    }
    const iniciais: ItemUploadPendente[] = validos.map((arq) => {
      const relOrigem = (arq as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      return {
        arquivo: arq,
        alocacao: resolverAlocacaoDocumentoDrive({
          nomeArquivo: arq.name,
          caminhoRelativoOrigem: relOrigem,
          categorias: categoriasAtivas,
        }),
      };
    });
    setItensPendentes(iniciais);
    setPastaForcadaEnvio("automatico");
    setDataDocumentoEnvio("");
    setManterOriginal(validos.some(arquivoPrecisaPerguntaConversao));
    setModalConversaoAberto(true);
  }

  async function abrirVisualizadorInline(doc: DocumentoDrive) {
    setCarregandoConteudoId(doc.id);
    try {
      const conteudo = await api.documentos.conteudo(doc.id);
      if (pdfUrlInline) URL.revokeObjectURL(pdfUrlInline);
      if (conteudo.pdfDataUrl) {
        setPdfUrlInline(base64ParaBlobUrl(conteudo.pdfDataUrl, "application/pdf"));
      } else {
        setPdfUrlInline(null);
      }
      setDocMetadadosVisualizando(doc);
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
      if (!c.pdfDataUrl) {
        toast.error("Este documento foi indexado apenas como texto pelo agente local e não possui binário PDF salvo online.");
        return;
      }
      const nomePdf = c.nomeArquivo.toLowerCase().endsWith(".pdf") ? c.nomeArquivo : `${c.nomeArquivo}.pdf`;
      baixarBase64(c.pdfDataUrl, nomePdf, "application/pdf");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  async function acaoBaixarOriginal(doc: DocumentoDrive) {
    try {
      const c = docVisualizando?.id === doc.id ? docVisualizando : await api.documentos.conteudo(doc.id);
      if (!c.originalDataUrl) {
        toast.error("O arquivo original não foi mantido para este documento (apenas a versão PDF está disponível).");
        return;
      }
      baixarBase64(c.originalDataUrl, c.nomeArquivo, "application/octet-stream");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  async function acaoImprimirOnline(doc: DocumentoDrive) {
    try {
      const c = docVisualizando?.id === doc.id ? docVisualizando : await api.documentos.conteudo(doc.id);
      if (!c.pdfDataUrl) {
        toast.error("Binário PDF indisponível para impressão online.");
        return;
      }
      imprimirPdfBase64(c.pdfDataUrl);
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  function abrirModalEditar(doc: DocumentoDrive) {
    setDocEditando(doc);
    setNovoNomeArquivo(doc.nomeArquivo);
    setNovaPastaDoc(extrairPastaDoDocumento(doc, categoriasAtivas));
    setNovaCategoria(doc.tipo);
    setNovaDataDoc(doc.dataDocumento ?? "");
  }

  const salvarEdicaoDoc = useMutation({
    mutationFn: async () => {
      if (!docEditando) return;
      const nomeFinal = novoNomeArquivo.trim() || docEditando.nomeArquivo;
      const pastaFinal = novaPastaDoc.trim().replace(/^\/+|\/+$/g, "") || pastaOutros.rotulo;
      await api.documentos.atualizar({
        id: docEditando.id,
        nomeArquivo: nomeFinal,
        tipo: novaCategoria,
        caminhoRelativo: `${pastaFinal}/${nomeFinal}`,
        dataDocumento: novaDataDoc.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Documento e pasta atualizados.");
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
        setDocMetadadosVisualizando(null);
        if (pdfUrlInline) URL.revokeObjectURL(pdfUrlInline);
        setPdfUrlInline(null);
      }
      void qc.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  function abrirModalCategorias() {
    setListaCategoriasEdicao(categoriasAtivas.map((c) => ({ ...c, palavrasChave: [...c.palavrasChave] })));
    setNovoRotuloCat("");
    setNovasPalavrasCat("");
    setNovaSubpastaCondominio("");
    setModalCategoriasAberto(true);
  }

  function adicionarCategoriaNaLista() {
    const rotulo = novoRotuloCat.trim();
    if (!rotulo) {
      toast.error("Informe o nome da nova categoria/pasta.");
      return;
    }
    const valor = gerarSlugCategoria(rotulo);
    if (listaCategoriasEdicao.some((c) => c.valor === valor || c.rotulo.toLowerCase() === rotulo.toLowerCase())) {
      toast.error("Já existe uma categoria/pasta com este nome.");
      return;
    }
    const palavras = novasPalavrasCat
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const semOutros = listaCategoriasEdicao.filter((c) => !c.padraoOutros && c.valor !== "outro");
    const outros = pastaPadraoOutros(listaCategoriasEdicao);
    setListaCategoriasEdicao([...semOutros, { valor, rotulo, palavrasChave: palavras }, outros]);
    setNovoRotuloCat("");
    setNovasPalavrasCat("");
  }

  const salvarCadastroCategorias = useMutation({
    mutationFn: async () => {
      const atual: ConfigEscritorio = escritorioQuery.data ?? {
        id: "escritorio",
        nome: "Krieger Contabilidade Condominial",
        cidade: "Camboriú",
        rodape: "",
        assinatura: "",
        logo: "",
        logoRatio: null,
      };
      await api.salvar("config", {
        ...atual,
        id: "escritorio",
        categoriasDrive: obterCategoriasDrive(listaCategoriasEdicao),
      });
    },
    onSuccess: () => {
      toast.success("Cadastro de categorias e pastas salvo com sucesso!");
      setModalCategoriasAberto(false);
      void qc.invalidateQueries({ queryKey: ["store", "config"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const criarPastaNoCondominio = useMutation({
    mutationFn: async (caminhoPasta: string) => {
      if (!condoAtual) return;
      const limpo = caminhoPasta.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
      if (!limpo) return;
      const atuais = new Set(condoAtual.pastasDrive ?? []);
      atuais.add(limpo);
      await api.salvar("condominios", {
        ...condoAtual,
        pastasDrive: Array.from(atuais),
      });
    },
    onSuccess: () => {
      toast.success("Pasta/subpasta cadastrada neste condomínio.");
      setNovaSubpastaCondominio("");
      void qc.invalidateQueries({ queryKey: ["store", "condominios"] });
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
        descricao="Pastas e subpastas criadas automaticamente na importação, classificação inteligente e pasta padrão Outros Documentos."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={abrirModalCategorias}>
              <Settings2 className="size-4" />
              Categorias e Pastas ({categoriasAtivas.length})
            </Button>
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
            <Button variant="secondary" onClick={() => inputPastaRef.current?.click()} disabled={Boolean(progressoEnvio)}>
              <FolderOpen className="size-4" />
              Subir Pasta c/ Subpastas
            </Button>
            <Button onClick={() => inputArquivosRef.current?.click()} disabled={Boolean(progressoEnvio)}>
              {progressoEnvio ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Subir Arquivos
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
                  setDocMetadadosVisualizando(null);
                  setPastaAtiva("todas");
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
            <Upload className="mb-2 size-6 text-primary/80" />
            <p className="text-sm font-medium">
              {progressoEnvio ?? "Arraste arquivos aqui ou importe uma pasta inteira com subpastas"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ao subir uma pasta, as <strong>pastas e subpastas são cadastradas automaticamente</strong>. Arquivos fora de
              pasta não identificados vão automaticamente para <strong>{pastaOutros.rotulo}</strong>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => inputArquivosRef.current?.click()}>
                Selecionar arquivos avulsos
              </Button>
              <Button size="sm" variant="outline" onClick={() => inputPastaRef.current?.click()}>
                <FolderOpen className="size-3.5" />
                Subir pasta com subpastas
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Painel Principal: Árvore de Pastas/Subpastas à esquerda + Lista de Arquivos e PDF Inline à direita */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Coluna Esquerda: Estrutura de Pastas e Subpastas */}
        <div className="min-w-0 lg:col-span-3">
          <SectionCard
            titulo="Pastas e Categorias"
            acoes={
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={abrirModalCategorias}>
                <FolderPlus className="size-3.5" />
                Gerenciar
              </Button>
            }
          >
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setPastaAtiva("todas")}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  pastaAtiva === "todas"
                    ? "bg-primary/10 font-semibold text-primary"
                    : "hover:bg-muted/60"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FolderOpen className="size-4 shrink-0 text-primary" />
                  Todos os Arquivos
                </span>
                <Badge variant="secondary" className="ml-2 text-[11px]">
                  {documentos.length}
                </Badge>
              </button>

              {arvorePastas.map((no) => {
                const selecionada = pastaAtiva === no.caminho;
                return (
                  <button
                    key={no.caminho}
                    type="button"
                    onClick={() => setPastaAtiva(no.caminho)}
                    style={{ paddingLeft: `${10 + no.nivel * 16}px` }}
                    className={`flex w-full items-center justify-between rounded-md pr-2.5 py-1.5 text-left text-xs transition-colors ${
                      no.padraoOutros ? "mt-2 border-t border-dashed pt-2.5" : ""
                    } ${
                      selecionada
                        ? "bg-primary/10 font-semibold text-primary"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {no.nivel > 0 && <span className="text-muted-foreground">↳</span>}
                      {no.padraoOutros ? (
                        <Package className="size-3.5 shrink-0 text-amber-600" />
                      ) : (
                        <Folder className="size-3.5 shrink-0 text-sky-600" />
                      )}
                      <span className="truncate">{no.nome}</span>
                    </span>
                    <Badge
                      variant={no.padraoOutros ? "outline" : "secondary"}
                      className="ml-1.5 shrink-0 text-[10px]"
                    >
                      {no.quantidade}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Coluna Direita: Navegação Breadcrumb, Busca, Tabela e Visualizador PDF Inline */}
        <div className="min-w-0 lg:col-span-9">
          <SectionCard
            titulo={`Arquivos (${documentosFiltrados.length})`}
            descricao="Clique duas vezes na linha para abrir o PDF inline ou use o botão direito do mouse para todas as ações."
          >
            {/* Trilha de Navegação (Breadcrumb) */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <button
                type="button"
                onClick={() => setPastaAtiva("todas")}
                className="font-medium text-primary hover:underline"
              >
                🏠 {condoAtual?.nomeRelatorio || condoAtual?.nome}
              </button>
              <ChevronRight className="size-3.5 text-muted-foreground" />
              {pastaAtiva === "todas" ? (
                <span className="font-semibold">🌐 Todas as Pastas e Subpastas</span>
              ) : (
                pastaAtiva.split("/").map((parte, idx, arr) => {
                  const caminhoAteAqui = arr.slice(0, idx + 1).join("/");
                  const ultimo = idx === arr.length - 1;
                  return (
                    <span key={caminhoAteAqui} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPastaAtiva(caminhoAteAqui)}
                        className={ultimo ? "font-bold text-foreground" : "text-primary hover:underline"}
                      >
                        📁 {parte}
                      </button>
                      {!ultimo && <ChevronRight className="size-3.5 text-muted-foreground" />}
                    </span>
                  );
                })
              )}
            </div>

            {/* Barra de Pesquisa e Filtro de Data */}
            <div className="mb-4 grid gap-3 sm:grid-cols-12">
              <div className="relative sm:col-span-8">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Pesquisar por nome do arquivo, pasta/subpasta, data ou formato (PDF, DOCX, JPG)..."
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 sm:col-span-4">
                <Input
                  type="date"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                  aria-label="Filtrar por data do documento"
                />
                {(termoBusca || pastaAtiva !== "todas" || filtroData) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Limpar filtros"
                    onClick={() => {
                      setTermoBusca("");
                      setPastaAtiva("todas");
                      setFiltroData("");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Lista de Arquivos e Visualizador PDF Inline */}
            <div className={`grid gap-4 ${docVisualizando ? "xl:grid-cols-12" : ""}`}>
              <div className={`min-w-0 ${docVisualizando ? "xl:col-span-6" : ""}`}>
                {docsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Carregando documentos do Drive...
                  </div>
                ) : documentosFiltrados.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <FolderOpen className="mx-auto mb-2 size-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Nenhum documento nesta pasta/filtro</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suba arquivos avulsos ou importe uma pasta com subpastas acima.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5">Arquivo</th>
                          <th className="px-3 py-2.5">Pasta / Subpasta</th>
                          <th className="px-3 py-2.5">Formato</th>
                          <th className="px-3 py-2.5">Data / Págs</th>
                          <th className="px-3 py-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {documentosFiltrados.map((doc) => {
                          const selecionado = docVisualizando?.id === doc.id;
                          const fmt = (doc.formatoOriginal ?? "pdf").toUpperCase();
                          const pastaDoc = extrairPastaDoDocumento(doc, categoriasAtivas);
                          const ehOutros = pastaDoc === pastaOutros.rotulo;
                          return (
                            <tr
                              key={doc.id}
                              onContextMenu={(e) => abrirMenuDireito(e, doc)}
                              onDoubleClick={() => void abrirVisualizadorInline(doc)}
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
                                      onClick={() => void abrirVisualizadorInline(doc)}
                                      className="block truncate text-left hover:underline"
                                      title="Clique para visualizar o PDF inline"
                                    >
                                      {doc.nomeArquivo}
                                    </button>
                                    <span className="text-xs text-muted-foreground">
                                      {doc.tamanho ? formatarTamanhoBytes(doc.tamanho) : "Indexado"}
                                      {doc.temOriginal ? ` • Original (${fmt}) mantido` : ""}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => setPastaAtiva(pastaDoc)}
                                  className="inline-flex items-center gap-1 rounded border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted"
                                  title="Filtrar por esta pasta"
                                >
                                  {ehOutros ? (
                                    <Package className="size-3 text-amber-600" />
                                  ) : (
                                    <Folder className="size-3 text-sky-600" />
                                  )}
                                  <span>{pastaDoc}</span>
                                </button>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant="outline">
                                  {fmt === "PDF" ? "PDF" : `${fmt} → PDF`}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                <div>{doc.dataDocumento || "Sem data"}</div>
                                <div>{doc.paginas ?? 1} pág(s)</div>
                              </td>
                              <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Abrir PDF inline"
                                    onClick={() => void abrirVisualizadorInline(doc)}
                                  >
                                    {carregandoConteudoId === doc.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <Eye className="size-4" />
                                    )}
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost" aria-label={`Ações para ${doc.nomeArquivo}`}>
                                        <MoreVertical className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60">
                                      <DropdownMenuItem onClick={() => void abrirVisualizadorInline(doc)}>
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
                                        Renomear / Mover de Pasta
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
                <div className="flex min-w-0 flex-col rounded-lg border bg-card xl:col-span-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{docVisualizando.nomeArquivo}</p>
                      <p className="text-xs text-muted-foreground">
                        Visualização sempre em PDF inline •{" "}
                        {docMetadadosVisualizando
                          ? extrairPastaDoDocumento(docMetadadosVisualizando, categoriasAtivas)
                          : "PDF"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate({
                            to: "/consulta-documentos",
                            search: { condoId, docId: docVisualizando.id },
                          })
                        }
                      >
                        <Sparkles className="size-3.5 text-amber-500" />
                        Perguntar à IA
                      </Button>
                      {pdfUrlInline && docVisualizando.pdfDataUrl && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => docVisualizando.pdfDataUrl && imprimirPdfBase64(docVisualizando.pdfDataUrl)}
                          >
                            <Printer className="size-3.5" />
                            Imprimir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              docVisualizando.pdfDataUrl &&
                              baixarBase64(
                                docVisualizando.pdfDataUrl,
                                docVisualizando.nomeArquivo.toLowerCase().endsWith(".pdf")
                                  ? docVisualizando.nomeArquivo
                                  : `${docVisualizando.nomeArquivo}.pdf`,
                                "application/pdf",
                              )
                            }
                          >
                            <Download className="size-3.5" />
                            PDF
                          </Button>
                        </>
                      )}
                      {docVisualizando.originalDataUrl && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            baixarBase64(
                              docVisualizando.originalDataUrl!,
                              docVisualizando.nomeArquivo,
                              "application/octet-stream",
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
                          setDocMetadadosVisualizando(null);
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
                        title={`Visualização PDF de ${docVisualizando.nomeArquivo}`}
                        className="h-[540px] w-full rounded border bg-white"
                      />
                    ) : (
                      <div className="flex h-[540px] flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                        <FileText className="mb-2 size-8" />
                        <p>
                          Este documento foi sincronizado apenas com o texto extraído pelo agente local de pastas. Para
                          visualizar o PDF inline no navegador, envie o arquivo diretamente pelo botão{" "}
                          <strong>Subir Arquivos</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Menu de Contexto do Botão Direito do Mouse */}
      {menuContexto && (
        <div
          style={{ top: menuContexto.y, left: menuContexto.x }}
          className="fixed z-50 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="truncate border-b px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
            {menuContexto.doc.nomeArquivo}
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              const d = menuContexto.doc;
              setMenuContexto(null);
              void abrirVisualizadorInline(d);
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
            Renomear / Mover de Pasta
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

      {/* Modal de Prévia de Upload (Mostra Pastas/Subpastas criadas automaticamente e alocação em Outros Documentos) */}
      <Dialog open={modalConversaoAberto} onOpenChange={setModalConversaoAberto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar envio de {itensPendentesCalculados.length} documento(s) para o Drive</DialogTitle>
            <DialogDescription>
              Pastas e subpastas são cadastradas automaticamente. Arquivos fora de pasta não identificados são alocados
              em <strong>{pastaOutros.rotulo}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tabela de prévia da alocação automática de cada arquivo */}
            <div className="max-h-56 overflow-y-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b bg-muted text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-2">Arquivo</th>
                    <th className="px-2.5 py-2">Pasta / Subpasta de Destino</th>
                    <th className="px-2.5 py-2">Regra Aplicada</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itensPendentesCalculados.map((item, idx) => (
                    <tr key={`${item.arquivo.name}-${idx}`}>
                      <td className="px-2.5 py-1.5 font-medium">
                        <div className="truncate max-w-[200px]" title={item.arquivo.name}>
                          {item.arquivo.name}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatarTamanhoBytes(item.arquivo.size)}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-xs">
                        📁 {item.alocacao.pasta}
                      </td>
                      <td className="px-2.5 py-1.5">{badgeRegraAlocacao(item.alocacao.regra)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {itensPendentesCalculados.some((it) => arquivoPrecisaPerguntaConversao(it.arquivo)) && (
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
              <Field
                rotulo="Alocação de pasta para arquivos avulsos"
                dica="Deixe em Automático para usar a identificação inteligente + Outros Documentos."
              >
                <Select value={pastaForcadaEnvio} onValueChange={setPastaForcadaEnvio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatico">
                      ✨ Automático (Subpasta da origem → Auto pelo nome → {pastaOutros.rotulo})
                    </SelectItem>
                    {arvorePastas.map((no) => (
                      <SelectItem key={no.caminho} value={no.caminho}>
                        📁 Forçar pasta: {no.caminho}
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
            <Button onClick={() => void executarEnvioArquivos()} disabled={Boolean(progressoEnvio)}>
              {progressoEnvio ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {progressoEnvio ?? "Confirmar e Cadastrar no Drive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cadastro e Manutenção de Categorias / Pastas */}
      <Dialog open={modalCategoriasAberto} onOpenChange={setModalCategoriasAberto}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cadastro e Manutenção de Categorias e Pastas</DialogTitle>
            <DialogDescription>
              Cadastre novas categorias/pastas, edite nomes e palavras-chave de identificação automática, ou crie
              subpastas específicas para este condomínio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Criar nova categoria/pasta global */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nova Categoria / Pasta Principal (com auto-identificação)
              </p>
              <div className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Input
                    value={novoRotuloCat}
                    onChange={(e) => setNovoRotuloCat(e.target.value)}
                    placeholder="Nome (ex.: Obras e Reformas)"
                  />
                </div>
                <div className="sm:col-span-6">
                  <Input
                    value={novasPalavrasCat}
                    onChange={(e) => setNovasPalavrasCat(e.target.value)}
                    placeholder="Palavras-chave separadas por vírgula (ex.: obra, reforma, cronograma)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="button" className="w-full" onClick={adicionarCategoriaNaLista}>
                    <Plus className="size-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {/* Criar pasta ou subpasta específica neste condomínio */}
            <div className="rounded-lg border bg-card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Criar Pasta ou Subpasta neste Condomínio ({condoAtual?.nomeRelatorio || condoAtual?.nome})
              </p>
              <div className="flex gap-2">
                <Input
                  value={novaSubpastaCondominio}
                  onChange={(e) => setNovaSubpastaCondominio(e.target.value)}
                  placeholder="Ex.: Atas de Assembleia/2026 ou Jurídico/Processos"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!novaSubpastaCondominio.trim() || criarPastaNoCondominio.isPending}
                  onClick={() => criarPastaNoCondominio.mutate(novaSubpastaCondominio)}
                >
                  <FolderPlus className="size-4" />
                  Criar Subpasta
                </Button>
              </div>
            </div>

            {/* Tabela editável das categorias cadastradas */}
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b bg-muted text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nome da Categoria / Pasta</th>
                    <th className="px-3 py-2">Palavras-chave de Auto-Identificação (separadas por vírgula)</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {listaCategoriasEdicao.map((cat, idx) => {
                    const ehPadraoOutros = Boolean(cat.padraoOutros || cat.valor === "outro");
                    return (
                      <tr key={cat.valor}>
                        <td className="px-3 py-2">
                          <Input
                            value={cat.rotulo}
                            onChange={(e) => {
                              const valor = e.target.value;
                              setListaCategoriasEdicao((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, rotulo: valor } : item)),
                              );
                            }}
                            className="h-8 text-xs font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {ehPadraoOutros ? (
                            <span className="text-muted-foreground italic">
                              Recebe automaticamente documentos fora de pasta não identificados pelo sistema
                            </span>
                          ) : (
                            <Input
                              value={cat.palavrasChave.join(", ")}
                              onChange={(e) => {
                                const kws = e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                setListaCategoriasEdicao((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, palavrasChave: kws } : item)),
                                );
                              }}
                              placeholder="Palavras-chave separadas por vírgula"
                              className="h-8 text-xs"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {ehPadraoOutros ? (
                            <Badge variant="outline">Padrão</Badge>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive"
                              title="Remover categoria"
                              onClick={() =>
                                setListaCategoriasEdicao((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCategoriasAberto(false)}>
              Fechar
            </Button>
            <Button onClick={() => salvarCadastroCategorias.mutate()} disabled={salvarCadastroCategorias.isPending}>
              Salvar Cadastro de Categorias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Renomear / Mover de Pasta ou Categoria */}
      <Dialog open={Boolean(docEditando)} onOpenChange={(o) => !o && setDocEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear ou Mover de Pasta</DialogTitle>
            <DialogDescription>
              Atualize o nome do arquivo, a pasta/subpasta onde ele fica armazenado ou sua categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field rotulo="Nome do arquivo">
              <Input value={novoNomeArquivo} onChange={(e) => setNovoNomeArquivo(e.target.value)} />
            </Field>
            <Field
              rotulo="Pasta / Subpasta no Drive"
              dica="Você pode escolher uma existente abaixo ou digitar uma subpasta (ex.: Atas de Assembleia/2026)."
            >
              <Input
                value={novaPastaDoc}
                onChange={(e) => setNovaPastaDoc(e.target.value)}
                list="lista-pastas-drive"
                placeholder="Ex.: Convenção ou Atas de Assembleia/2026"
              />
            </Field>
            <datalist id="lista-pastas-drive">
              {arvorePastas.map((no) => (
                <option key={no.caminho} value={no.caminho} />
              ))}
            </datalist>
            <Field rotulo="Categoria">
              <Select value={novaCategoria} onValueChange={(v) => setNovaCategoria(v as TipoDocumentoConsulta)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriasAtivas.map((cat) => (
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
              importe uma pasta inteira com suas subpastas diretamente pelo navegador.
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
              <p className="text-xs font-semibold">Importar pasta com subpastas agora pelo navegador</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ao selecionar uma pasta do seu computador, todas as pastas e subpastas internas são criadas
                automaticamente no Drive e os arquivos soltos não identificados vão para{" "}
                <strong>{pastaOutros.rotulo}</strong>:
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
                Selecionar pasta local com subpastas...
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
