// Previsto × Realizado — ver docs/ESPECIFICACAO-V2.md.
// Por rubrica e grupo: previsto anual/mensal (exercício N, já com ajustes) × realizado
// (demonstrativo/mensais do exercício N+1, acumulado até o mês escolhido).
import type { Exercicio, Mensal } from './types';

export interface LinhaPrevistoRealizado {
  grupo: string;
  rubrica: string;
  previsto: number;
  realizado: number;
  diferencaValor: number;
  diferencaPct: number;
  situacao: 'dentro' | 'acima' | 'abaixo';
}

export function compararPrevistoRealizado(
  _exercicioPrevisto: Exercicio,
  _mensaisRealizados: Mensal[],
  _ateMes: number,
): LinhaPrevistoRealizado[] {
  throw new Error('não implementado');
}
