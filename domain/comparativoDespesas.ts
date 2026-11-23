import { formatBRL, formatNumeroBR } from "../lib/format";
import { centavos } from "./demonstrativo";
import type { ColunaExportacao } from "./exportacao";
import { chaveRotulo } from "./previstoRealizado";
import type { Exercicio } from "./types";

/**
 * Comparativo de despesas entre exercícios (#252).
 *
 * Uma linha por grupo de despesa (ou por rubrica, no modo analítico), com o total de cada exercício
 * do período e a variação entre o primeiro e o último. Grupo que não existe num exercício fica sem
 * valor (`null`), nunca zero. Os totais por exercício são a soma das linhas, então fecham com a
 * prestação de contas.
 */

export type OrdemComparativo = "variacao" | "valor";

export interface LinhaComparativoDespesas {
  grupo: string;
  /** Preenchido no modo analítico. */
  rubrica?: string;
  /** Um valor por exercício, na ordem de `anos`; `null` quando o grupo não existe no exercício. */
  valores: (number | null)[];
  variacao: number | null;
  variacaoPct: number | null;
}

export interface ResultadoComparativoDespesas {
  anos: number[];
  linhas: LinhaComparativoDespesas[];
  /** Total de despesas de cada exercício (soma das linhas). */
  totais: number[];
  variacaoTotal: number | null;
  variacaoTotalPct: number | null;
}

const pct = (antes: number | null, depois: number | null) =>
  antes === null || depois === null || antes === 0
    ? null
    : Math.round((depois / Math.abs(antes) - 1) * 10000) / 100;

export function comparativoDespesas(
  exercicios: Pick<Exercicio, "ano" | "demonstrativo">[],
  opcoes: { analitico?: boolean; ordem?: OrdemComparativo } = {},
): ResultadoComparativoDespesas {
  const ordenados = [...exercicios].sort((a, b) => Number(a.ano) - Number(b.ano));
  const anos = ordenados.map((e) => Number(e.ano));
  // chave → nome exibido + valor por exercício
  const mapa = new Map<string, { grupo: string; rubrica?: string; valores: (number | null)[] }>();

  ordenados.forEach((e, i) => {
    for (const g of e.demonstrativo?.despesas?.grupos ?? []) {
      const itens = opcoes.analitico ? (g.itens ?? []) : [null];
      for (const item of itens) {
        const k = item ? `${chaveRotulo(g.nome)}|${chaveRotulo(item.nome)}` : chaveRotulo(g.nome);
        const valor = item
          ? Number(item.valor) || 0
          : (g.itens ?? []).reduce((s, it) => s + (Number(it.valor) || 0), 0);
        const linha = mapa.get(k) ?? {
          grupo: g.nome,
          ...(item ? { rubrica: item.nome } : {}),
          valores: Array<number | null>(ordenados.length).fill(null),
        };
        linha.valores[i] = centavos((linha.valores[i] ?? 0) + valor);
        mapa.set(k, linha);
      }
    }
  });

  const linhas: LinhaComparativoDespesas[] = [...mapa.values()].map((l) => {
    const primeiro = l.valores[0] ?? null;
    const ultimo = l.valores.at(-1) ?? null;
    return {
      ...l,
      variacao:
        ordenados.length > 1 && primeiro !== null && ultimo !== null
          ? centavos(ultimo - primeiro)
          : null,
      variacaoPct: ordenados.length > 1 ? pct(primeiro, ultimo) : null,
    };
  });

  const ordem = opcoes.ordem ?? "variacao";
  linhas.sort((a, b) => {
    const va = ordem === "variacao" ? a.variacao : (a.valores.at(-1) ?? null);
    const vb = ordem === "variacao" ? b.variacao : (b.valores.at(-1) ?? null);
    if (va === null && vb === null) return a.grupo.localeCompare(b.grupo, "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || a.grupo.localeCompare(b.grupo, "pt-BR");
  });

  const totais = anos.map((_, i) => centavos(linhas.reduce((s, l) => s + (l.valores[i] ?? 0), 0)));
  const primeiroTotal = totais[0] ?? null;
  const ultimoTotal = totais.at(-1) ?? null;
  return {
    anos,
    linhas,
    totais,
    variacaoTotal:
      anos.length > 1 && primeiroTotal !== null && ultimoTotal !== null
        ? centavos(ultimoTotal - primeiroTotal)
        : null,
    variacaoTotalPct: anos.length > 1 ? pct(primeiroTotal, ultimoTotal) : null,
  };
}

const pctTexto = (n: number | null) => (n === null ? "—" : `${formatNumeroBR(n, 2)}%`);

/** Colunas comuns a tela, CSV, XLSX, impressão e PDF (#252). */
export function colunasComparativoDespesas(
  r: ResultadoComparativoDespesas,
  analitico = false,
): ColunaExportacao<LinhaComparativoDespesas>[] {
  return [
    { titulo: "Grupo", valor: (l) => l.grupo },
    ...(analitico ? [{ titulo: "Rubrica", valor: (l: LinhaComparativoDespesas) => l.rubrica ?? "" }] : []),
    ...r.anos.map((ano, i) => ({
      titulo: String(ano),
      valor: (l: LinhaComparativoDespesas) => l.valores[i] ?? null,
      texto: (l: LinhaComparativoDespesas) => (l.valores[i] === null ? "" : formatBRL(l.valores[i])),
      alinhamento: "direita" as const,
    })),
    {
      titulo: "Variação (R$)",
      valor: (l) => l.variacao,
      texto: (l) => (l.variacao === null ? "—" : formatBRL(l.variacao)),
      alinhamento: "direita",
    },
    {
      titulo: "Variação (%)",
      valor: (l) => l.variacaoPct,
      texto: (l) => pctTexto(l.variacaoPct),
      alinhamento: "direita",
    },
  ];
}

/** Rodapé com o total de cada exercício, já formatado, uma posição por coluna. */
export function rodapeComparativoDespesas(
  r: ResultadoComparativoDespesas,
  analitico = false,
): string[] {
  return [
    "Total",
    ...(analitico ? [""] : []),
    ...r.totais.map((t) => formatBRL(t)),
    r.variacaoTotal === null ? "—" : formatBRL(r.variacaoTotal),
    pctTexto(r.variacaoTotalPct),
  ];
}
