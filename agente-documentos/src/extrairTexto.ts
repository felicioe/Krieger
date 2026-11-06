import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";

// Fontes "padrão" (Helvetica, Times etc.) que PDFs antigos costumam referenciar sem embutir —
// sem isso, pdfjs-dist não consegue medir/decodificar o texto dessas fontes corretamente.
const PASTA_FONTES_PADRAO = `${fileURLToPath(new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url))}/`;

export interface TextoExtraido {
  paginas: string[];
  viaOcr: boolean;
}

// Abaixo disso (média de caracteres úteis por página), o PDF provavelmente não tem camada de
// texto (digitalizado) — tenta OCR em vez de devolver quase nada.
const LIMIAR_CARACTERES_POR_PAGINA = 20;

async function carregarPdfjs() {
  // pdfjs-dist só publica ESM; import dinâmico evita problemas de interop CJS/ESM.
  return import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<any>;
}

/**
 * Extrai o texto de um PDF por página usando pdfjs-dist (biblioteca atual, não a versão antiga
 * embutida em pacotes como pdf-parse — que falha em PDFs com cross-reference comprimido, comuns
 * em PDFs gerados por ferramentas modernas). Se o resultado vier quase vazio, tenta OCR
 * (tesseract.js) sobre cada página renderizada como imagem — caminho mais lento, só usado quando
 * necessário.
 */
export async function extrairTexto(caminho: string): Promise<TextoExtraido> {
  const buffer = await readFile(caminho);
  const pdfjsLib = await carregarPdfjs();
  const documento = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: PASTA_FONTES_PADRAO,
  }).promise;

  const paginas: string[] = [];
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const conteudo = await pagina.getTextContent();
    paginas.push(conteudo.items.map((item: any) => item.str ?? "").join(" "));
  }

  const mediaPorPagina =
    paginas.length > 0 ? paginas.reduce((soma, t) => soma + t.trim().length, 0) / paginas.length : 0;
  if (mediaPorPagina >= LIMIAR_CARACTERES_POR_PAGINA) {
    return { paginas, viaOcr: false };
  }

  return { paginas: await extrairViaOcr(buffer), viaOcr: true };
}

/** Renderiza cada página como imagem (pdfjs-dist + @napi-rs/canvas, sem binário nativo externo) e reconhece com tesseract.js. */
async function extrairViaOcr(buffer: Buffer): Promise<string[]> {
  const pdfjsLib = await carregarPdfjs();
  const { createCanvas } = await import("@napi-rs/canvas");
  const documento = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: PASTA_FONTES_PADRAO,
  }).promise;
  const worker = await createWorker("por");
  const paginas: string[] = [];
  try {
    for (let i = 1; i <= documento.numPages; i++) {
      const pagina = await documento.getPage(i);
      const viewport = pagina.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const contexto = canvas.getContext("2d");
      await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
      const { data } = await worker.recognize(canvas.toBuffer("image/png"));
      paginas.push(data.text);
    }
  } finally {
    await worker.terminate();
  }
  return paginas;
}
