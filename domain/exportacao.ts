/**
 * Exportação de tabelas dos relatórios: colunas, CSV e texto de célula.
 *
 * Regras de CSV (as mesmas da previsão orçamentária, publicadas na 1.06): BOM UTF-8
 * para o Excel pt-BR, separador `;`, fim de linha CRLF e aspas duplicadas dentro de
 * campo entre aspas. Números saem com vírgula decimal e sem separador de milhar,
 * para o Excel somar sem conversão manual.
 *
 * Aqui só se monta texto — baixar arquivo é papel do frontend
 * (`frontend/src/lib/exportar.ts`), o que mantém esta parte testável sem navegador.
 */

export type ColunaExportacao<T> = {
  titulo: string;
  /** Valor cru da célula. Número vira célula numérica; texto vira texto. */
  valor: (linha: T) => string | number | null | undefined;
  /**
   * Texto exibido na impressão. Sem ele, o valor cru é formatado no padrão pt-BR —
   * o que basta para números e textos simples, mas não distingue `R$ 1.234,56` de
   * `1.234,56`.
   */
  texto?: (linha: T) => string;
  /** Alinhamento na impressão e no PDF. Padrão: esquerda. */
  alinhamento?: "esquerda" | "direita";
};

const BOM = "﻿";
const NUMERO = /^-?\d+(?:\.\d+)?$/;

function textoCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    return String(v).replace(".", ",");
  }
  return v;
}

function campoCsv(v: string | number | null | undefined): string {
  const s = textoCsv(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Converte um valor numérico em string no padrão pt-BR, mantendo o tipo. */
export function numeroParaCelula(v: string | number | null | undefined): string | number {
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  if (typeof v === "string" && NUMERO.test(v.trim())) return Number(v);
  return v ?? "";
}

function formatarNumero(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Texto de uma célula para impressão: formatação própria da coluna ou o valor cru. */
export function celulaTexto<T>(coluna: ColunaExportacao<T>, linha: T): string {
  if (coluna.texto) return coluna.texto(linha);
  const v = coluna.valor(linha);
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? formatarNumero(v) : v;
}

/** Conteúdo do CSV, sem tocar no navegador — base do download e dos testes. */
export function conteudoCsv<T>(colunas: ColunaExportacao<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => campoCsv(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => campoCsv(c.valor(l))).join(";"));
  return BOM + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}

/** Matriz de células para o XLSX: valor numérico continua número. */
export function matrizPlanilha<T>(
  colunas: ColunaExportacao<T>[],
  linhas: T[],
): (string | number)[][] {
  const cabecalho = colunas.map((c) => c.titulo);
  const corpo = linhas.map((l) =>
    colunas.map((c): string | number => {
      const bruto = c.texto ? c.texto(l) : c.valor(l);
      if (bruto === null || bruto === undefined || bruto === "") return "";
      if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : "";
      return /^-?\d+([.,]\d+)?$/.test(bruto) ? Number(bruto.replace(",", ".")) : bruto;
    }),
  );
  return [cabecalho, ...corpo];
}
