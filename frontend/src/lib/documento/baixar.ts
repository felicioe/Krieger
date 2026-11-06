import type { Documento } from "./tipos";

export type Formato = "pdf" | "docx";

export const ROTULO_FORMATO: Record<Formato, string> = { pdf: "PDF", docx: "Word" };

/** Gera o arquivo no formato pedido e inicia o download. As bibliotecas só carregam aqui. */
export async function baixarDocumento(doc: Documento, formato: Formato): Promise<void> {
  const blob =
    formato === "pdf"
      ? await (await import("./pdf")).gerarPdf(doc)
      : await (await import("./word")).gerarWord(doc);
  salvarArquivo(blob, `${doc.arquivo}.${formato}`);
}

export function salvarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Nome de arquivo sem acentos nem espaços: "Edital Jardim 2026" → "edital-jardim-2026". */
export function nomeDeArquivo(...partes: (string | number | null | undefined)[]): string {
  return (
    partes
      .filter((p) => p !== null && p !== undefined && String(p).trim() !== "")
      .join("-")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "documento"
  );
}
