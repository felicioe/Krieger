/**
 * Download das planilhas exportadas (XLSX).
 *
 * A lógica pura — colunas, texto de célula, conteúdo do CSV — vive em
 * `domain/exportacao.ts` e é testada sem navegador. Aqui ficam só os efeitos:
 * Blob, link temporário e clique.
 */
import { conteudoCsv, matrizPlanilha, type ColunaExportacao } from "@/domain/exportacao";

export { celulaTexto, conteudoCsv, matrizPlanilha, numeroParaCelula } from "@/domain/exportacao";
export type { ColunaExportacao } from "@/domain/exportacao";

function nomeComExtensao(nome: string, extensao: string): string {
  const limpo = nome.replace(/[\\/:*?"<>|]+/g, "-").trim() || "relatorio";
  return `${limpo}.${extensao}`;
}

/** Baixa uma matriz em XLSX, preservando células numéricas e carregando o gerador sob demanda. */
export async function baixarMatrizXlsx(
  nome: string,
  nomeAba: string,
  matriz: (string | number)[][],
) {
  const { default: escreverXlsx } = await import("write-excel-file/browser");
  await escreverXlsx(
    matriz.map((linha) => linha.map((value) => ({ value }))),
    { sheet: nomeAba.slice(0, 31) },
  ).toFile(nomeComExtensao(nome, "xlsx"));
}

/** Baixa o XLSX; o pacote é carregado só aqui, fora do bundle inicial. */
export async function baixarXlsx<T>(
  nome: string,
  nomeAba: string,
  colunas: ColunaExportacao<T>[],
  linhas: T[],
) {
  await baixarMatrizXlsx(nome, nomeAba, matrizPlanilha(colunas, linhas));
}
