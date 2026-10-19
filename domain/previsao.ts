// Previsão orçamentária com linhas de ajuste (+ / −) — ver docs/ESPECIFICACAO-V2.md.
// Anual ajustado = base (despesas ordinárias ou soma das rubricas) − dedução + variação,
// mais a soma das linhas de ajuste "+" e menos as "−". Mensal, índice, fundo de reserva
// e valor por unidade partem do anual ajustado.
import type { Exercicio, AjustePrevisao } from './types';

export interface ResultadoPrevisao {
  base: number;
  ajustes: AjustePrevisao[];
  anualAjustado: number;
  mensal: number;
  valorPorUnidade: number | null;
}

export function calcularPrevisao(_exercicio: Exercicio): ResultadoPrevisao {
  throw new Error('não implementado');
}
