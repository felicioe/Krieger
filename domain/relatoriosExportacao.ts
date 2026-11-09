/**
 * Colunas de saída dos relatórios comparativos — CSV, XLSX, impressão e PDF.
 *
 * Fonte única: a tela, a planilha e o papel saem daqui, para nunca divergirem na
 * ordem nem no conjunto de colunas. Só apresentação; nenhum cálculo de negócio.
 */
import { formatBRL, formatNumeroBR } from "../lib/format";
import type { ColunaExportacao } from "./exportacao";
import type { ResultadoComparativo, Situacao } from "./previstoRealizado";
import type { CelulaMensal, ResultadoMensalDetalhado } from "./previstoRealizadoMensal";

const pctTexto = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${formatNumeroBR(n)}%`);

function rotuloSituacao(s: Situacao | null): string {
  if (s === "dentro") return "Dentro";
  if (s === "acima") return "Acima";
  if (s === "abaixo") return "Abaixo";
  return "";
}

// ---------------- Previsto × Realizado (acumulado do exercício) ----------------

export type NivelComparativo = "rubrica" | "ajuste" | "subtotal" | "total";

export type LinhaComparativoExport = {
  grupo: string;
  conta: string;
  nivel: NivelComparativo;
  previstoAnual: number;
  previstoAte: number;
  realizadoAte: number;
  diferenca: number;
  pct: number | null;
  situacao: string;
};

/**
 * Uma linha por conta (quando `analiticas`), mais o subtotal de cada grupo e o
 * total geral — a mesma hierarquia da tabela da tela, para a planilha e o papel
 * não perderem nem inventarem linhas.
 */
export function linhasComparativoExport(c: ResultadoComparativo, analiticas = true): LinhaComparativoExport[] {
  const linhas: LinhaComparativoExport[] = [];
  for (const g of c.grupos) {
    if (analiticas) {
      for (const l of g.linhas) {
        const marca = l.tipo === "ajuste" ? ` (ajuste ${l.sinal === "-" ? "−" : "+"})` : "";
        linhas.push({
          grupo: g.nome,
          conta: `${l.nome || "Sem nome"}${marca}`,
          nivel: l.tipo,
          previstoAnual: l.previstoAnual,
          previstoAte: l.previsto,
          realizadoAte: l.realizado,
          diferenca: l.diferenca,
          pct: l.pct,
          situacao: rotuloSituacao(l.situacao),
        });
      }
    }
    linhas.push({
      grupo: g.nome,
      conta: `Total ${g.nome || "sem grupo"}`,
      nivel: "subtotal",
      previstoAnual: g.totais.previstoAnual,
      previstoAte: g.totais.previsto,
      realizadoAte: g.totais.realizado,
      diferenca: g.totais.diferenca,
      pct: g.totais.pct,
      situacao: rotuloSituacao(g.totais.situacao),
    });
  }
  linhas.push({
    grupo: "",
    conta: "Total geral",
    nivel: "total",
    previstoAnual: c.total.previstoAnual,
    previstoAte: c.total.previsto,
    realizadoAte: c.total.realizado,
    diferenca: c.total.diferenca,
    pct: c.total.pct,
    situacao: rotuloSituacao(c.total.situacao),
  });
  return linhas;
}

export function colunasComparativoExport(): ColunaExportacao<LinhaComparativoExport>[] {
  return [
    { titulo: "Grupo", valor: (l) => l.grupo, texto: (l) => l.grupo },
    { titulo: "Rubrica", valor: (l) => l.conta, texto: (l) => l.conta },
    { titulo: "Previsto anual", valor: (l) => l.previstoAnual, texto: (l) => formatBRL(l.previstoAnual), alinhamento: "direita" },
    { titulo: "Previsto até", valor: (l) => l.previstoAte, texto: (l) => formatBRL(l.previstoAte), alinhamento: "direita" },
    { titulo: "Realizado até", valor: (l) => l.realizadoAte, texto: (l) => formatBRL(l.realizadoAte), alinhamento: "direita" },
    { titulo: "Diferença", valor: (l) => l.diferenca, texto: (l) => formatBRL(l.diferenca), alinhamento: "direita" },
    { titulo: "%", valor: (l) => l.pct, texto: (l) => pctTexto(l.pct), alinhamento: "direita" },
    { titulo: "Situação", valor: (l) => l.situacao, texto: (l) => l.situacao },
  ];
}

// ---------------- Previsto × Realizado mensal ----------------

export type OpcoesMensalExport = { orcado: boolean; horizontal: boolean; vertical: boolean };

export type LinhaMensalExport = { rubrica: string; celulas: CelulaMensal[]; total: CelulaMensal };

export function linhasMensalExport(r: ResultadoMensalDetalhado): LinhaMensalExport[] {
  return [
    ...r.linhas.map((l) => ({ rubrica: l.grupo || "Sem grupo", celulas: l.mensal, total: l.total })),
    { rubrica: "Total", celulas: r.meses.map((_, i) => somaColunaMensal(r, i)), total: r.total },
  ];
}

/** Soma da coluna de um mês: o previsto e o realizado por grupo, fechados como o total geral. */
function somaColunaMensal(r: ResultadoMensalDetalhado, i: number): CelulaMensal {
  const previsto = r.linhas.reduce((s, l) => s + (l.mensal[i]?.previsto ?? 0), 0);
  const realizado = r.linhas.reduce((s, l) => s + (l.mensal[i]?.realizado ?? 0), 0);
  const diferenca = realizado - previsto;
  return {
    previsto,
    realizado,
    diferenca,
    horizontal: previsto === 0 ? null : Math.round((diferenca / Math.abs(previsto)) * 10000) / 100,
    verticalPrevisto: null,
    verticalRealizado: null,
  };
}

export function colunasMensalExport(
  r: ResultadoMensalDetalhado,
  o: OpcoesMensalExport,
): ColunaExportacao<LinhaMensalExport>[] {
  const colunas: ColunaExportacao<LinhaMensalExport>[] = [
    { titulo: "Rubrica", valor: (l) => l.rubrica, texto: (l) => l.rubrica },
  ];
  const celula = (l: LinhaMensalExport, i: number) => l.celulas[i] as CelulaMensal;

  r.meses.forEach((mes, i) => {
    const semDados = mes.relatorios === 0;
    if (o.orcado) {
      colunas.push({
        titulo: `${mes.rotulo} previsto`,
        valor: (l) => celula(l, i).previsto,
        texto: (l) => formatBRL(celula(l, i).previsto),
        alinhamento: "direita",
      });
    }
    colunas.push({
      titulo: `${mes.rotulo} realizado`,
      valor: (l) => (semDados ? "" : celula(l, i).realizado),
      texto: (l) => (semDados ? "Sem dados" : formatBRL(celula(l, i).realizado)),
      alinhamento: "direita",
    });
    if (o.horizontal) {
      colunas.push({
        titulo: `${mes.rotulo} H %`,
        valor: (l) => celula(l, i).horizontal,
        texto: (l) => (semDados ? "—" : pctTexto(celula(l, i).horizontal)),
        alinhamento: "direita",
      });
    }
    if (o.vertical) {
      colunas.push({
        titulo: `${mes.rotulo} V prev.`,
        valor: (l) => celula(l, i).verticalPrevisto,
        texto: (l) => pctTexto(celula(l, i).verticalPrevisto),
        alinhamento: "direita",
      });
      colunas.push({
        titulo: `${mes.rotulo} V real.`,
        valor: (l) => (semDados ? "" : celula(l, i).verticalRealizado),
        texto: (l) => (semDados ? "—" : pctTexto(celula(l, i).verticalRealizado)),
        alinhamento: "direita",
      });
    }
  });

  if (o.orcado) {
    colunas.push({ titulo: "Total previsto", valor: (l) => l.total.previsto, texto: (l) => formatBRL(l.total.previsto), alinhamento: "direita" });
  }
  colunas.push({ titulo: "Total realizado", valor: (l) => l.total.realizado, texto: (l) => formatBRL(l.total.realizado), alinhamento: "direita" });
  colunas.push({ titulo: "Diferença", valor: (l) => l.total.diferenca, texto: (l) => formatBRL(l.total.diferenca), alinhamento: "direita" });
  if (o.horizontal) {
    colunas.push({ titulo: "Total H %", valor: (l) => l.total.horizontal, texto: (l) => pctTexto(l.total.horizontal), alinhamento: "direita" });
  }
  return colunas;
}
