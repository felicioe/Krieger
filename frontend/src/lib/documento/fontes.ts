/**
 * Fonte dos documentos em PDF: a mesma família da interface (Source Sans 3).
 *
 * As faces vão embutidas no chunk tardio do pdfmake como base64 (import `?inline`),
 * então não há requisição de rede nem o VFS do Roboto (`vfs_fonts`, ~454 KB gzip).
 * O subset contém o latino completo e os sinais usados nos relatórios (R$, %, −, ×,
 * ·, ÷, travessões, aspas). Origem, comando de subsetação e licença SIL OFL:
 * `src/assets/fontes/README.md`.
 */
import regular from "@/assets/fontes/SourceSans3-Regular.ttf?inline";
import semibold from "@/assets/fontes/SourceSans3-SemiBold.ttf?inline";
import italic from "@/assets/fontes/SourceSans3-Italic.ttf?inline";

/** Nome da família registrada no pdfmake (usado em `defaultStyle`). */
export const FAMILIA = "SourceSans3";

/** O pdfmake espera base64 puro; o import `?inline` entrega data URL. */
const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

/** Nomes das faces no VFS do pdfmake. */
export const FACES = {
  normal: "SourceSans3-Regular.ttf",
  bold: "SourceSans3-SemiBold.ttf",
  italics: "SourceSans3-Italic.ttf",
} as const;

/** Conteúdo do VFS: as três faces usadas pelo documento. */
export function vfsFonte(): Record<string, string> {
  return {
    [FACES.normal]: base64(regular),
    [FACES.bold]: base64(semibold),
    [FACES.italics]: base64(italic),
  };
}

/**
 * Registro de fontes do pdfmake. `bolditalics` reaproveita a face itálica: nenhum
 * documento usa negrito em itálico hoje, e substituir uma face inteira por causa
 * disso custaria mais ~60 KB no pacote.
 */
export const FONTES = {
  [FAMILIA]: {
    normal: FACES.normal,
    bold: FACES.bold,
    italics: FACES.italics,
    bolditalics: FACES.italics,
  },
};
