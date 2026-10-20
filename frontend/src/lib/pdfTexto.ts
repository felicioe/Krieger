import { textoComLayout, type ItemTexto } from "@/domain/layoutTexto";

/**
 * Extrai do PDF (no navegador, com pdf.js) o texto com o layout em espaços que o leitor
 * do Systemar espera. A biblioteca é carregada só quando o usuário importa um arquivo.
 */
export async function extrairTextoPdf(arquivo: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tarefa = pdfjs.getDocument({ data: dados });
  const doc = await tarefa.promise;
  try {
    const paginas: ItemTexto[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      const itens: ItemTexto[] = [];
      for (const it of conteudo.items) {
        if (!("str" in it)) continue;
        const t = it.transform as number[];
        itens.push({
          str: it.str,
          x: t[4] ?? 0,
          y: t[5] ?? 0,
          largura: it.width,
          altura: it.height || Math.hypot(t[2] ?? 0, t[3] ?? 0),
        });
      }
      paginas.push(itens);
    }
    return textoComLayout(paginas);
  } finally {
    await tarefa.destroy();
  }
}
