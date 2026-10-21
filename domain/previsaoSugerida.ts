import { centavos } from "./demonstrativo";
import { arredondarValor } from "./previsao";
import type { AjustePrevisao, Arredondamento, PrevisaoSugeridaExercicio } from "./types";
import type { PrevisaoSugeridaLida } from "./pdfParser";

/**
 * Previsão orçamentária sugerida (folha "Previsão orçamentária ordinária sugerida" do PDF do
 * Systemar) — menu próprio, separado da previsão calculada a partir do demonstrativo do exercício
 * (`domain/previsao.ts`). Fluxo: importar o PDF preenche `Exercicio.previsaoSugerida` (uma vez,
 * editável depois); o usuário ajusta as deduções/variação; o resultado consolida no relatório
 * final.
 *
 * Regra (descrita pelo escritório):
 *   total das despesas do ano = Σ categorias.anual
 *   total ordinário           = total das despesas do ano + Σ deduções (+ ou −)
 *   total final                = total ordinário + variação de despesas sugeridas (+ ou −)
 *   rateio mensal sugerido     = total final ÷ 12
 *   índice sugerido            = rateio mensal sugerido ÷ rateio mensal atual (ano anterior) − 1
 * "Por unidade" é um quadro à parte, só para comparar: divide o rateio mensal sugerido pelas
 * unidades do condomínio e soma o fundo de reserva (mesmo % usado em `domain/previsao.ts`).
 */

export interface ResultadoPrevisaoSugerida {
  totalDespesasAno: number;
  totalDespesasMedia: number;
  /** Soma das deduções, já com o sinal de cada uma aplicado. */
  deducoesTotal: number;
  totalOrdinario: number;
  /** Variação de despesas sugeridas, já com o sinal aplicado. */
  variacaoValor: number;
  totalFinal: number;
  rateioMensalSugerido: number;
  rateioMensalAtual: number | null;
  /** % — null quando falta o rateio mensal atual (ano anterior) para comparar. */
  indiceSugerido: number | null;
}

export interface ResultadoPrevisaoSugeridaPorUnidade {
  unidades: number | null;
  cotaUnidade: number | null;
  reservaUnidade: number | null;
  /** Já arredondado conforme o condomínio. */
  valorUnidade: number | null;
}

const assinado = (item: Pick<AjustePrevisao, "sinal" | "valor">): number => (item.sinal === "-" ? -Math.abs(item.valor) : Math.abs(item.valor));

/** Converte o que foi lido do PDF (`lerPrevisaoSugerida`) na estrutura editável, pronta pra salvar no exercício. */
export function previsaoSugeridaDoPdf(pv: PrevisaoSugeridaLida): PrevisaoSugeridaExercicio {
  const deducoes: AjustePrevisao[] = [];
  if (pv.deducao != null && pv.deducao !== 0) {
    deducoes.push({ id: "ded-agua-gas", descricao: "Parte água e gás", sinal: pv.deducao < 0 ? "-" : "+", valor: Math.abs(pv.deducao) });
  }
  return {
    rateioMensalAtual: pv.rateioMensalAtual,
    categorias: pv.categorias.map((c) => ({ ...c })),
    deducoes,
    variacao: { sinal: (pv.variacaoSugerida ?? 0) < 0 ? "-" : "+", valor: Math.abs(pv.variacaoSugerida ?? 0) },
  };
}

export function calcularPrevisaoSugerida(p: PrevisaoSugeridaExercicio): ResultadoPrevisaoSugerida {
  const totalDespesasAno = centavos(p.categorias.reduce((s, c) => s + c.anual, 0));
  const totalDespesasMedia = centavos(totalDespesasAno / 12);
  const deducoesTotal = centavos(p.deducoes.reduce((s, d) => s + assinado(d), 0));
  const totalOrdinario = centavos(totalDespesasAno + deducoesTotal);
  const variacaoValor = centavos(assinado(p.variacao));
  const totalFinal = centavos(totalOrdinario + variacaoValor);
  const rateioMensalSugerido = centavos(totalFinal / 12);
  const rateioMensalAtual = p.rateioMensalAtual;
  const indiceSugerido =
    rateioMensalAtual && rateioMensalAtual > 0 ? Math.round((rateioMensalSugerido / rateioMensalAtual - 1) * 1000000) / 10000 : null;
  return { totalDespesasAno, totalDespesasMedia, deducoesTotal, totalOrdinario, variacaoValor, totalFinal, rateioMensalSugerido, rateioMensalAtual, indiceSugerido };
}

/** Quadro "previsão por unidade" — só para comparar/validar, não altera o rateio mensal sugerido. */
export function calcularPrevisaoSugeridaPorUnidade(
  rateioMensalSugerido: number,
  unidades: number | null,
  fundoReservaPct: number,
  arredondamento: Arredondamento,
): ResultadoPrevisaoSugeridaPorUnidade {
  if (!unidades || unidades <= 0) return { unidades: null, cotaUnidade: null, reservaUnidade: null, valorUnidade: null };
  const cota = rateioMensalSugerido / unidades;
  const reserva = cota * (fundoReservaPct / 100);
  return {
    unidades,
    cotaUnidade: centavos(cota),
    reservaUnidade: centavos(reserva),
    valorUnidade: arredondarValor(cota + reserva, arredondamento),
  };
}
