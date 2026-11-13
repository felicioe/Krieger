/**
 * A folha "PREVISÃO ORÇAMENTÁRIA ORDINÁRIA SUGERIDA PARA O EXERCÍCIO DE AAAA/AAAA" do Systemar,
 * como o escritório a entrega: rateio atual → histórico de despesas por categoria → dedução →
 * total ordinário → variação → rateio anual e mensal sugeridos → índice.
 *
 * Fonte única dos textos e da ordem das linhas: o documento (PDF/Word) e a prévia na tela montam a
 * seção a partir daqui, para não divergirem. Nada é inventado além do que a folha traz — o cálculo
 * do Krieger continua existindo nos menus de manutenção, mas não é impresso nesta seção.
 */
import { formatBRL, formatNumeroBR, parseData } from "../lib/format";
import type { ResultadoPrevisaoSugerida } from "./previsaoSugerida";
import type { Exercicio, PrevisaoSugeridaExercicio } from "./types";

/** "2025/2026" a partir do período do exercício (ano fiscal cruzado), com o ano como reserva. */
export function exercicioPorExtenso(e: Pick<Exercicio, "ano" | "demonstrativo">): string {
  const ini = parseData(e.demonstrativo?.periodo?.ini);
  const fim = parseData(e.demonstrativo?.periodo?.fim);
  if (ini && fim && ini.getFullYear() !== fim.getFullYear()) {
    return `${ini.getFullYear()}/${fim.getFullYear()}`;
  }
  const ano = Number(e.ano);
  return Number.isFinite(ano) && ano > 0 ? String(ano) : "";
}

/** Ano do histórico ("despesas ocorridas em 2024/2025"): o período anterior ao exercício. */
export function periodoHistorico(e: Pick<Exercicio, "ano" | "demonstrativo">): string {
  const ini = parseData(e.demonstrativo?.periodo?.ini);
  const fim = parseData(e.demonstrativo?.periodo?.fim);
  if (ini && fim && ini.getFullYear() !== fim.getFullYear()) {
    return `${ini.getFullYear() - 1}/${fim.getFullYear() - 1}`;
  }
  const ano = Number(e.ano);
  return Number.isFinite(ano) && ano > 0 ? String(ano - 1) : "";
}

/** Linha da folha: rótulo, valor já formatado e se é total (negrito). */
export interface LinhaFolha {
  rotulo: string;
  valor: string;
  forte?: boolean;
  /** espaço extra antes da linha, separando os blocos da folha */
  espacoAntes?: number;
}

export interface FolhaPrevisao {
  titulo: string[];
  /** "Valor total do rateio ... atualmente" ou "Valor cobrado atualmente por unidade (N lotes)". */
  rateioAtual: LinhaFolha | null;
  /** Texto de abertura do histórico, quebrado como na folha. */
  aberturaHistorico: string[];
  /** Cabeçalho da tabela de categorias. */
  colunas: [string, string, string];
  categorias: { nome: string; anual: string; media: string }[];
  totalCategorias: { nome: string; anual: string; media: string };
  /** Dedução, total ordinário, variação, rateio anual, rateio mensal e índice. */
  fechamento: LinhaFolha[];
  /** "Rancho Queimado, 30 de novembro de 2025." */
  localData: string | null;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "30/11/2025" → "30 de novembro de 2025". */
function dataExtenso(dataBR: string | null | undefined): string | null {
  const d = parseData(dataBR);
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const sinal = (s: "+" | "-") => (s === "-" ? "(−)" : "(+)");

/**
 * Monta a folha a partir do que está salvo no exercício. `r` é o resultado recalculado (com o
 * arredondamento do condomínio); `p` são as linhas editáveis.
 */
export function montarFolhaPrevisao(
  e: Exercicio,
  p: PrevisaoSugeridaExercicio,
  r: ResultadoPrevisaoSugerida,
): FolhaPrevisao {
  const exercicio = exercicioPorExtenso(e);
  const historico = periodoHistorico(e);
  const cidade = (e.cidade || "").trim();
  const data = dataExtenso(e.dataEmissao);

  // Rateio atual: a folha traz uma das duas grandezas. O total mensal é o que permite o índice;
  // o valor por unidade é o que alguns condomínios usam, e vai com o número de lotes no rótulo.
  const rateioAtual: LinhaFolha | null =
    r.rateioMensalAtual != null
      ? {
          rotulo: "Valor total do rateio ordinário mensal utilizado atualmente para obter os valores cobrados de condomínio",
          valor: formatBRL(r.rateioMensalAtual),
        }
      : p.rateioUnidadeAtual != null
        ? {
            rotulo: `Valor cobrado atualmente por unidade${p.unidadesRateio ? ` (${p.unidadesRateio} lotes)` : ""}`,
            valor: formatBRL(p.rateioUnidadeAtual),
          }
        : null;

  const fechamento: LinhaFolha[] = [
    ...p.deducoes.map((d) => ({
      rotulo: `Despesas a deduzir${d.descricao ? ` (${d.descricao})` : ""}`,
      valor: formatBRL(Math.abs(d.valor) * (d.sinal === "-" ? -1 : 1)),
    })),
    { rotulo: "Total de despesas consideradas ordinárias", valor: formatBRL(r.totalOrdinario), forte: true },
    {
      rotulo: `Variação de despesas sugeridas para ${exercicio}`,
      valor: formatBRL(r.variacaoValor),
      espacoAntes: 4,
    },
    { rotulo: "Sugestão de rateio anual ordinário", valor: formatBRL(r.totalFinal) },
    { rotulo: "Sugestão de rateio mensal ordinário", valor: formatBRL(r.rateioMensalSugerido), forte: true },
    ...(r.indiceSugerido != null
      ? [{ rotulo: "Índice sugerido para correção do condomínio", valor: `${formatNumeroBR(r.indiceSugerido)}%` }]
      : []),
  ];

  return {
    titulo: ["PREVISÃO ORÇAMENTÁRIA ORDINÁRIA", `SUGERIDA PARA O EXERCÍCIO DE ${exercicio}.`],
    rateioAtual,
    aberturaHistorico: [
      `Dados históricos das despesas ocorridas em ${historico} que poderão`,
      `servir como base para a previsão das despesas ordinárias do exercício de ${exercicio}:`,
    ],
    colunas: ["efetivamente realizado", "no ano", "média mês"],
    categorias: p.categorias.map((c) => ({
      nome: c.nome,
      anual: formatBRL(c.anual),
      media: formatBRL(c.media),
    })),
    totalCategorias: {
      nome: "Total das despesas do período",
      anual: formatBRL(r.totalDespesasAno),
      media: formatBRL(r.totalDespesasMedia),
    },
    fechamento,
    localData: cidade && data ? `${cidade}, ${data}.` : data,
  };
}

/** Rótulo do sinal de uma dedução/variação, exportado para a tela usar o mesmo texto. */
export const sinalFolha = sinal;
