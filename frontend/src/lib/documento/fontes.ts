/**
 * Fontes dos documentos em PDF.
 *
 * Duas famílias, escolhidas por documento (`Documento.fonte`):
 * - `Source Sans 3` (padrão da interface): edital, relatórios, previsto × realizado.
 * - `Liberation Sans` (Arial-compatível, métricas iguais à Arial): modelos de ata de cartório.
 *
 * As faces vão embutidas no chunk tardio do pdfmake como base64 (import `?inline`),
 * então não há requisição de rede nem o VFS do Roboto (`vfs_fonts`, ~454 KB gzip).
 * Os subsets contêm o latino completo e os sinais usados nos relatórios (R$, %, −, ×,
 * ·, ÷, travessões, aspas). Origem, comando de subsetação e licenças: `src/assets/fontes/README.md`.
 */
import ssRegular from "@/assets/fontes/SourceSans3-Regular.ttf?inline";
import ssSemibold from "@/assets/fontes/SourceSans3-SemiBold.ttf?inline";
import ssItalic from "@/assets/fontes/SourceSans3-Italic.ttf?inline";

/** Nome da família registrada no pdfmake (usado em `defaultStyle`). */
export const FAMILIA = "SourceSans3";

/**
 * Família dos documentos de cartório. Liberation Sans é metricamente compatível com
 * a Arial: o mesmo texto ocupa a mesma largura, então a ata gerada aqui abre igual
 * no Word/PDF de quem não tem a fonte instalada.
 */
export const FAMILIA_DOCUMENTO = "LiberationSans";

/** O pdfmake espera base64 puro; o import `?inline` entrega data URL. */
const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

/** Nomes das faces no VFS do pdfmake (Source Sans 3). */
export const FACES = {
  normal: "SourceSans3-Regular.ttf",
  bold: "SourceSans3-SemiBold.ttf",
  italics: "SourceSans3-Italic.ttf",
} as const;

/** Nomes das faces no VFS do pdfmake (Liberation Sans). */
export const FACES_DOCUMENTO = {
  normal: "LiberationSans-Regular.ttf",
  bold: "LiberationSans-Bold.ttf",
  italics: "LiberationSans-Italic.ttf",
  bolditalics: "LiberationSans-BoldItalic.ttf",
} as const;

/** Conteúdo do VFS: as três faces da Source Sans 3 usadas pelos documentos padrão. */
export function vfsFonte(): Record<string, string> {
  return {
    [FACES.normal]: base64(ssRegular),
    [FACES.bold]: base64(ssSemibold),
    [FACES.italics]: base64(ssItalic),
  };
}

/**
 * Conteúdo do VFS da Liberation Sans. As quatro faces entram em imports dinâmicos:
 * o chunk delas só é baixado quando o documento pede `fonte: "documento"` — edital
 * e relatórios não pagam esses bytes.
 */
export async function vfsFonteDocumento(): Promise<Record<string, string>> {
  const [r, b, i, bi] = await Promise.all([
    import("@/assets/fontes/LiberationSans-Regular.ttf?inline"),
    import("@/assets/fontes/LiberationSans-Bold.ttf?inline"),
    import("@/assets/fontes/LiberationSans-Italic.ttf?inline"),
    import("@/assets/fontes/LiberationSans-BoldItalic.ttf?inline"),
  ]);
  return {
    [FACES_DOCUMENTO.normal]: base64(r.default),
    [FACES_DOCUMENTO.bold]: base64(b.default),
    [FACES_DOCUMENTO.italics]: base64(i.default),
    [FACES_DOCUMENTO.bolditalics]: base64(bi.default),
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

/** Registro da família Liberation Sans para documentos de cartório. */
export const FONTES_DOCUMENTO = {
  [FAMILIA_DOCUMENTO]: {
    normal: FACES_DOCUMENTO.normal,
    bold: FACES_DOCUMENTO.bold,
    italics: FACES_DOCUMENTO.italics,
    bolditalics: FACES_DOCUMENTO.bolditalics,
  },
};