import { centavos } from "./demonstrativo";
import { arredondarValor } from "./previsao";
import type {
  AjustePrevisao,
  Arredondamento,
  DivergenciaPrevisaoSugerida,
  PrevisaoSugeridaExercicio,
  TotaisPrevisaoSugeridaPdf,
} from "./types";
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

/** Totais que o PDF já traz prontos (lidos à parte das categorias) — frozen na importação, pra
 * comparar com o recalculado a qualquer momento depois, mesmo após editar deduções/variação. */
export function totaisPdfDoPv(pv: PrevisaoSugeridaLida): TotaisPrevisaoSugeridaPdf {
  return {
    totalDespesasAno: pv.totalDespesasAno,
    totalOrdinario: pv.totalOrdinario,
    rateioAnualSugerido: pv.rateioAnualSugerido,
    rateioMensalSugerido: pv.rateioMensalSugerido,
    indiceSugerido: pv.indiceSugerido,
  };
}

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
    totaisPdf: totaisPdfDoPv(pv),
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

/**
 * Compara os totais que o PDF do Systemar já traz prontos com o que o sistema recalcula a partir
 * das categorias/dedução/variação. Os dois deveriam bater sempre que os valores não tiverem sido
 * editados — se divergirem é sinal de erro de leitura (ex.: uma linha de subtotal foi reconhecida
 * como categoria de despesa, duplicando o total; caso real achado no Residencial Santa Cecília) ou
 * de uma edição manual das deduções/variação que afastou o resultado do que o PDF sugeria — o
 * chamador decide o que fazer com isso (ver `validarPrevisaoSugeridaDoPdf`, usado na importação, e a
 * tela de Previsão orçamentária, que usa esta função diretamente com os totais já salvos no
 * exercício, pra reavaliar a qualquer momento, mesmo depois de editar).
 */
export function compararComTotaisPdf(
  r: ResultadoPrevisaoSugerida,
  totaisPdf: TotaisPrevisaoSugeridaPdf | null | undefined,
): DivergenciaPrevisaoSugerida[] {
  if (!totaisPdf) return [];
  const divergencias: DivergenciaPrevisaoSugerida[] = [];
  const cmp = (campo: string, doPdf: number | null, calculado: number | null, tolerancia: number) => {
    if (doPdf !== null && calculado !== null && Math.abs(doPdf - calculado) > tolerancia) {
      divergencias.push({ campo, doPdf, calculado });
    }
  };
  cmp("Total das despesas do ano", totaisPdf.totalDespesasAno, r.totalDespesasAno, 0.02);
  cmp("Total ordinário", totaisPdf.totalOrdinario, r.totalOrdinario, 0.02);
  cmp("Sugestão de rateio anual ordinário", totaisPdf.rateioAnualSugerido, r.totalFinal, 0.02);
  cmp("Sugestão de rateio mensal ordinário", totaisPdf.rateioMensalSugerido, r.rateioMensalSugerido, 0.02);
  cmp("Índice sugerido para correção", totaisPdf.indiceSugerido, r.indiceSugerido, 0.05);
  return divergencias;
}

/** Mesma comparação, direto do que foi lido na importação (antes de ter um exercício salvo). */
export function validarPrevisaoSugeridaDoPdf(pv: PrevisaoSugeridaLida): DivergenciaPrevisaoSugerida[] {
  return compararComTotaisPdf(calcularPrevisaoSugerida(previsaoSugeridaDoPdf(pv)), totaisPdfDoPv(pv));
}

/** Identifica o conjunto de divergências atual, pra saber se uma decisão anterior
 * (`DecisaoDivergenciaPrevisaoSugerida`) ainda vale ou se os valores mudaram desde então (nova
 * edição de deduções/variação, por exemplo). */
export function chaveDivergencia(divergencias: DivergenciaPrevisaoSugerida[]): string {
  return divergencias
    .map((d) => `${d.campo}:${d.doPdf.toFixed(2)}:${d.calculado.toFixed(2)}`)
    .sort()
    .join("|");
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
