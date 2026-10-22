import type { ResultadoComparativo } from "@/domain/previstoRealizado";

/**
 * Sem nenhum relatório mensal no período comparado, o realizado é zero por falta de dado, não por
 * resultado: a tela, a prévia e o PDF/Word trocam a tabela e as barras por esta mensagem, em vez
 * de mostrar −100% em todas as rubricas e barras vazias. Com pelo menos um relatório, tudo aparece
 * normalmente — inclusive divergências reais de −100% numa rubrica sem despesa.
 */
export const semRealizado = (r: ResultadoComparativo) => r.relatoriosUsados === 0;

export const periodoComparacao = (r: ResultadoComparativo) => `${r.meses[0]?.rotulo ?? "—"} a ${r.mesAte.rotulo}`;

export const textoSemRealizado = (r: ResultadoComparativo) =>
  `Ainda não há relatório mensal importado ou lançado para o período de comparação (${periodoComparacao(r)}). A comparação aparece assim que o primeiro relatório mensal desse período entrar no sistema.`;
