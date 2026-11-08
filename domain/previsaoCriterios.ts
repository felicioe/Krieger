import { formatBRL, formatNumeroBR } from "../lib/format";
import type { ResultadoPrevisao } from "./previsao";
import type { Arredondamento, VariacaoMetodo } from "./types";

/**
 * Rótulos dos critérios da previsão orçamentária, num lugar só.
 *
 * A tela de manutenção (Previsão orçamentária) e as telas de cadastro escolhem o método, o
 * arredondamento e os índices da variação; o relatório final repete esses critérios junto dos
 * números. Se cada lugar tivesse o seu texto, o mesmo parâmetro apareceria com nomes diferentes
 * no PDF e na tela — por isso os rótulos moram aqui e todos importam daqui.
 */

export const MODOS_PREVISAO: { valor: ResultadoPrevisao["modo"]; rotulo: string }[] = [
  { valor: "tradicional", rotulo: "Tradicional (por grupo)" },
  { valor: "detalhado", rotulo: "Detalhado (por despesa)" },
];

export const VARIACAO_METODOS: { valor: VariacaoMetodo; rotulo: string }[] = [
  { valor: "manual", rotulo: "Manual" },
  { valor: "percentual", rotulo: "Percentual fixo" },
  { valor: "mediaIndices", rotulo: "Média dos índices" },
  { valor: "valor", rotulo: "Valor fixo (R$)" },
];

export const ARREDONDAMENTOS: { valor: Arredondamento; rotulo: string }[] = [
  { valor: "truncar", rotulo: "Truncar (sem centavos, para baixo)" },
  { valor: "arredondar", rotulo: "Arredondar (sem centavos)" },
  { valor: "centavos", rotulo: "Manter centavos" },
];

/** Rótulo curto do arredondamento, como rodapé do valor por unidade. */
export const ARREDONDAMENTO_CURTO: Record<Arredondamento, string> = {
  truncar: "truncado, sem centavos",
  arredondar: "arredondado, sem centavos",
  centavos: "com centavos",
};

export const rotuloModo = (m: ResultadoPrevisao["modo"]) =>
  MODOS_PREVISAO.find((o) => o.valor === m)?.rotulo ?? m;

export const rotuloVariacao = (m: VariacaoMetodo) =>
  VARIACAO_METODOS.find((o) => o.valor === m)?.rotulo ?? m;

export const rotuloArredondamento = (a: Arredondamento) =>
  ARREDONDAMENTOS.find((o) => o.valor === a)?.rotulo ?? a;

/**
 * Critérios que produziram a previsão, nas mesmas palavras da tela de manutenção — o relatório
 * mostra os parâmetros, não só os números, para que o valor impresso possa ser conferido contra
 * o que a tela calcula.
 */
export function criteriosDaPrevisao(
  r: Pick<ResultadoPrevisao, "modo" | "variacaoMetodo" | "variacaoPct" | "variacaoValor" | "indicesUsados" | "arredondamento">,
): { rotulo: string; valor: string }[] {
  const linhas = [
    { rotulo: "Modo da previsão", valor: rotuloModo(r.modo) },
    { rotulo: "Método da variação", valor: rotuloVariacao(r.variacaoMetodo) },
  ];

  if (r.variacaoMetodo === "mediaIndices") {
    const usados = r.indicesUsados
      .map((i) => `${i.ano ?? "—"}: ${formatNumeroBR(i.pct)}%`)
      .join(" · ");
    linhas.push({
      rotulo: "Índices usados na média",
      valor: usados || "nenhum índice informado",
    });
  }

  linhas.push({
    rotulo: "Variação aplicada",
    valor:
      r.variacaoMetodo === "valor"
        ? formatBRL(r.variacaoValor)
        : `${formatNumeroBR(r.variacaoPct)}% sobre a base líquida`,
  });
  linhas.push({
    rotulo: "Arredondamento do valor por unidade",
    valor: rotuloArredondamento(r.arredondamento),
  });

  return linhas;
}
