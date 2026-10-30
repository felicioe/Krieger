import type { DocumentoDriveRegistro, FormatoArquivoDrive, TipoDocumentoConsulta } from "@/domain/types";
import { classificarDocumentoPorNome } from "@/domain/notificacao";
import { salvarArquivo } from "./documento/baixar";
import { gerarPdf } from "./documento/pdf";

export function detectarFormatoArquivo(nomeArquivo: string): FormatoArquivoDrive {
  const ext = nomeArquivo.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  return "outro";
}

export function precisaPerguntarConversao(formato: FormatoArquivoDrive): boolean {
  return formato === "docx" || formato === "jpg" || formato === "png" || formato === "webp";
}

export function arquivoPrecisaPerguntaConversao(arquivo: File): boolean {
  return precisaPerguntarConversao(detectarFormatoArquivo(arquivo.name));
}

export function formatarTamanhoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function base64ParaBlob(base64OuDataUrl: string, mimePadrao = "application/pdf"): Blob {
  if (base64OuDataUrl.startsWith("data:")) {
    return dataUrlParaBlob(base64OuDataUrl);
  }
  const bin = atob(base64OuDataUrl);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimePadrao });
}

export function base64ParaBlobUrl(base64OuDataUrl: string, mimePadrao = "application/pdf"): string {
  return URL.createObjectURL(base64ParaBlob(base64OuDataUrl, mimePadrao));
}

export function baixarBase64(base64OuDataUrl: string, nomeArquivo: string, mimePadrao = "application/pdf"): void {
  const blob = base64ParaBlob(base64OuDataUrl, mimePadrao);
  salvarArquivo(blob, nomeArquivo);
}

export function imprimirPdfBase64(base64OuDataUrl: string): void {
  const url = base64ParaBlobUrl(base64OuDataUrl, "application/pdf");
  const w = window.open(url, "_blank");
  if (w) {
    w.addEventListener("load", () => {
      try {
        w.focus();
        w.print();
      } catch {
        // O navegador já exibe os controles nativos do PDF
      }
    });
  }
}

export async function calcularHashSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback determinístico para ambientes de teste sem SubtleCrypto
  const bytes = new Uint8Array(buffer);
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i]!;
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return (hex(h1) + hex(h2)).repeat(4).slice(0, 64);
}

export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(blob);
  });
}

export function dataUrlParaBlob(dataUrl: string): Blob {
  const [cabecalho = "", dados = ""] = dataUrl.split(",");
  const mimeMatch = cabecalho.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || "application/pdf";
  const bin = atob(dados);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Extrai os parágrafos de texto de um arquivo .DOCX diretamente no navegador
 * (lendo `word/document.xml` do arquivo ZIP com DecompressionStream).
 */
export async function extrairParagrafosDocx(buffer: ArrayBuffer): Promise<string[]> {
  try {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");
    let offset = 0;

    while (offset + 30 <= bytes.length) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const metodo = view.getUint16(offset + 8, true);
      const tamComp = view.getUint32(offset + 18, true);
      const tamNome = view.getUint16(offset + 26, true);
      const tamExtra = view.getUint16(offset + 28, true);
      const nome = decoder.decode(bytes.subarray(offset + 30, offset + 30 + tamNome));
      const inicioDados = offset + 30 + tamNome + tamExtra;
      const fimDados = inicioDados + tamComp;

      if (nome === "word/document.xml" && fimDados <= bytes.length) {
        const fatia = bytes.subarray(inicioDados, fimDados);
        let xml = "";
        if (metodo === 0) {
          xml = decoder.decode(fatia);
        } else if (metodo === 8 && typeof DecompressionStream !== "undefined") {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(fatia);
          writer.close();
          const descomprimido = await new Response(ds.readable).arrayBuffer();
          xml = decoder.decode(descomprimido);
        }
        if (xml) {
          const paragrafos: string[] = [];
          const regexP = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
          for (const mp of xml.matchAll(regexP)) {
            const trechoP = mp[1] ?? "";
            const textos: string[] = [];
            const regexT = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
            for (const mt of trechoP.matchAll(regexT)) {
              textos.push(
                (mt[1] ?? "")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')
                  .replace(/&apos;/g, "'"),
              );
            }
            const linha = textos.join("").trim();
            if (linha) paragrafos.push(linha);
          }
          if (paragrafos.length > 0) return paragrafos;
        }
        break;
      }
      if (tamComp === 0) break;
      offset = fimDados;
    }
  } catch {
    // Segue para fallback abaixo se o ZIP usar Data Descriptor
  }
  return [];
}

/** Extrai o texto página por página de um arquivo PDF usando pdfjs-dist. */
async function extrairPaginasPdf(buffer: ArrayBuffer): Promise<string[]> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const tarefa = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const doc = await tarefa.promise;
    try {
      const paginas: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const pagina = await doc.getPage(n);
        const conteudo = await pagina.getTextContent();
        const textoPagina = conteudo.items
          .map((it) => ("str" in it ? it.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        paginas.push(textoPagina);
      }
      return paginas;
    } finally {
      await tarefa.destroy();
    }
  } catch {
    return [];
  }
}

export interface ResultadoProcessamentoDrive {
  nomeArquivo: string;
  tipo: TipoDocumentoConsulta;
  formatoOriginal: FormatoArquivoDrive;
  hash: string;
  tamanho: number;
  paginas: number;
  pdfDataUrl: string;
  originalDataUrl: string | null;
  trechos: { paginaInicial: number; paginaFinal: number; texto: string }[];
}

/**
 * Processa qualquer arquivo enviado para o Drive do condomínio:
 * - Se for PDF: extrai texto por página e guarda o PDF para visualização inline.
 * - Se for DOCX: extrai o texto do Word, gera versão PDF para visualização inline
 *   e guarda também o DOCX original se `manterOriginal` for true.
 * - Se for Imagem (JPG/PNG/WEBP): converte para PDF A4 para visualização inline
 *   e guarda também a imagem original se `manterOriginal` for true.
 */
export async function processarArquivoParaDrive(opcoes: {
  arquivo: File;
  tipo?: TipoDocumentoConsulta;
  manterOriginal?: boolean;
  descricaoExtra?: string;
}): Promise<ResultadoProcessamentoDrive> {
  const { arquivo, manterOriginal = true, descricaoExtra = "" } = opcoes;
  const formato = detectarFormatoArquivo(arquivo.name);
  const tipo = opcoes.tipo ?? classificarDocumentoPorNome(arquivo.name);
  const buffer = await arquivo.arrayBuffer();
  const hash = await calcularHashSha256(buffer);
  const dataUrlBruto = await blobParaDataUrl(arquivo);

  if (formato === "pdf") {
    const paginasTexto = await extrairPaginasPdf(buffer);
    const trechos = paginasTexto
      .map((texto, idx) => ({
        paginaInicial: idx + 1,
        paginaFinal: idx + 1,
        texto: texto.trim(),
      }))
      .filter((t) => t.texto.length > 0);

    if (trechos.length === 0) {
      trechos.push({
        paginaInicial: 1,
        paginaFinal: Math.max(1, paginasTexto.length),
        texto: `Documento PDF: ${arquivo.name} (${tipo}). ${descricaoExtra}`.trim(),
      });
    }

    return {
      nomeArquivo: arquivo.name,
      tipo,
      formatoOriginal: "pdf",
      hash,
      tamanho: arquivo.size,
      paginas: Math.max(1, paginasTexto.length),
      pdfDataUrl: dataUrlBruto,
      originalDataUrl: null,
      trechos,
    };
  }

  if (formato === "docx") {
    const paragrafos = await extrairParagrafosDocx(buffer);
    const tituloBase = arquivo.name.replace(/\.docx?$/i, "");
    const blocos =
      paragrafos.length > 0
        ? paragrafos.map((p) => ({ tipo: "paragrafo" as const, texto: p, alinhamento: "justificado" as const }))
        : [{ tipo: "paragrafo" as const, texto: `Documento Word: ${arquivo.name}. ${descricaoExtra}`.trim() }];

    const pdfBlob = await gerarPdf({
      titulo: tituloBase,
      arquivo: tituloBase,
      timbre: null,
      blocos: [{ tipo: "titulo", texto: tituloBase, nivel: 1 }, ...blocos],
    });
    const pdfDataUrl = await blobParaDataUrl(pdfBlob);

    // Agrupa os parágrafos em páginas de ~2500 caracteres para indexação na IA
    const trechos: { paginaInicial: number; paginaFinal: number; texto: string }[] = [];
    let acumulador = "";
    let pagina = 1;
    for (const p of paragrafos) {
      if (acumulador.length + p.length > 2500 && acumulador.trim()) {
        trechos.push({ paginaInicial: pagina, paginaFinal: pagina, texto: acumulador.trim() });
        pagina += 1;
        acumulador = p + "\n";
      } else {
        acumulador += p + "\n";
      }
    }
    if (acumulador.trim()) {
      trechos.push({ paginaInicial: pagina, paginaFinal: pagina, texto: acumulador.trim() });
    }
    if (trechos.length === 0) {
      trechos.push({
        paginaInicial: 1,
        paginaFinal: 1,
        texto: `Documento Word: ${arquivo.name} (${tipo}). ${descricaoExtra}`.trim(),
      });
    }

    return {
      nomeArquivo: manterOriginal ? arquivo.name : `${tituloBase}.pdf`,
      tipo,
      formatoOriginal: manterOriginal ? "docx" : "pdf",
      hash,
      tamanho: manterOriginal ? arquivo.size : pdfBlob.size,
      paginas: trechos.length,
      pdfDataUrl,
      originalDataUrl: manterOriginal ? dataUrlBruto : null,
      trechos,
    };
  }

  if (formato === "jpg" || formato === "png" || formato === "webp") {
    const tituloBase = arquivo.name.replace(/\.(jpe?g|png|webp)$/i, "");
    const pdfBlob = await gerarPdf({
      titulo: tituloBase,
      arquivo: tituloBase,
      timbre: null,
      blocos: [
        { tipo: "titulo", texto: tituloBase, nivel: 2, alinhamento: "centro" },
        { tipo: "imagem", dataUrl: dataUrlBruto, largura: 460, altura: 640, alinhamento: "centro" },
        ...(descricaoExtra.trim()
          ? [{ tipo: "paragrafo" as const, texto: descricaoExtra.trim(), alinhamento: "esquerda" as const }]
          : []),
      ],
    });
    const pdfDataUrl = await blobParaDataUrl(pdfBlob);

    return {
      nomeArquivo: manterOriginal ? arquivo.name : `${tituloBase}.pdf`,
      tipo,
      formatoOriginal: manterOriginal ? formato : "pdf",
      hash,
      tamanho: manterOriginal ? arquivo.size : pdfBlob.size,
      paginas: 1,
      pdfDataUrl,
      originalDataUrl: manterOriginal ? dataUrlBruto : null,
      trechos: [
        {
          paginaInicial: 1,
          paginaFinal: 1,
          texto: `Imagem/Documento digitalizado: ${arquivo.name} (Categoria: ${tipo}). ${descricaoExtra}`.trim(),
        },
      ],
    };
  }

  // Outros formatos
  const tituloBase = arquivo.name;
  const pdfBlob = await gerarPdf({
    titulo: tituloBase,
    arquivo: tituloBase,
    timbre: null,
    blocos: [
      { tipo: "titulo", texto: tituloBase, nivel: 2 },
      { tipo: "paragrafo", texto: descricaoExtra.trim() || `Arquivo armazenado no Drive: ${arquivo.name}` },
    ],
  });
  const pdfDataUrl = await blobParaDataUrl(pdfBlob);

  return {
    nomeArquivo: arquivo.name,
    tipo,
    formatoOriginal: formato,
    hash,
    tamanho: arquivo.size,
    paginas: 1,
    pdfDataUrl,
    originalDataUrl: manterOriginal ? dataUrlBruto : null,
    trechos: [
      {
        paginaInicial: 1,
        paginaFinal: 1,
        texto: `Documento: ${arquivo.name} (${tipo}). ${descricaoExtra}`.trim(),
      },
    ],
  };
}

function extrairApenasBase64(dataUrlOuBase64: string | null): string | null {
  if (!dataUrlOuBase64) return null;
  const idx = dataUrlOuBase64.indexOf(",");
  return idx >= 0 ? dataUrlOuBase64.slice(idx + 1) : dataUrlOuBase64;
}

export async function processarArquivoParaRegistroDrive(
  arquivo: File,
  opcoes: {
    tipo?: TipoDocumentoConsulta;
    dataDocumento?: string | null;
    manterOriginal?: boolean;
    caminhoRelativo?: string;
  } = {},
): Promise<DocumentoDriveRegistro> {
  const r = await processarArquivoParaDrive({
    arquivo,
    tipo: opcoes.tipo,
    manterOriginal: opcoes.manterOriginal ?? true,
  });
  return {
    arquivo: r.nomeArquivo,
    caminhoRelativo: opcoes.caminhoRelativo || r.nomeArquivo,
    tipo: r.tipo,
    dataDocumento: opcoes.dataDocumento ?? null,
    hashArquivo: r.hash,
    paginas: r.trechos.map((t) => t.texto),
    formatoOriginal: r.formatoOriginal,
    pdfBase64: extrairApenasBase64(r.pdfDataUrl),
    originalBase64: extrairApenasBase64(r.originalDataUrl),
    mimeOriginal: arquivo.type || null,
    nomeOriginal: arquivo.name,
    tamanhoBytes: r.tamanho,
    origemEnvio: "upload",
  };
}
