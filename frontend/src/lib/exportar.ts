/**
 * Download dos arquivos exportados (CSV e XLSX).
 *
 * A lógica pura — colunas, texto de célula, conteúdo do CSV — vive em
 * `domain/exportacao.ts` e é testada sem navegador. Aqui ficam só os efeitos:
 * Blob, link temporário e clique.
 */
import { conteudoCsv, matrizPlanilha, type ColunaExportacao } from "@/domain/exportacao";

export {
  celulaTexto,
  conteudoCsv,
  matrizPlanilha,
  numeroParaCelula,
} from "@/domain/exportacao";
export type { ColunaExportacao } from "@/domain/exportacao";

function nomeComExtensao(nome: string, extensao: string): string {
  const limpo = nome.replace(/[\\/:*?"<>|]+/g, "-").trim() || "relatorio";
  return `${limpo}.${extensao}`;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Baixa o CSV com BOM, `;` e CRLF — abre no Excel pt-BR sem ajuste. */
export function baixarCsv<T>(nome: string, colunas: ColunaExportacao<T>[], linhas: T[]) {
  const conteudo = `\ufeff${conteudoCsv(colunas, linhas)}`;
  baixar(new Blob([conteudo], { type: "text/csv;charset=utf-8" }), nomeComExtensao(nome, "csv"));
}

/** Baixa o XLSX; o pacote é carregado só aqui, fora do bundle inicial. */
export async function baixarXlsx<T>(
  nome: string,
  nomeAba: string,
  colunas: ColunaExportacao<T>[],
  linhas: T[],
) {
  const XLSX = await import("xlsx");
  const planilha = XLSX.utils.aoa_to_sheet(matrizPlanilha(colunas, linhas));
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, planilha, nomeAba.slice(0, 31));
  XLSX.writeFile(pasta, nomeComExtensao(nome, "xlsx"));
}
