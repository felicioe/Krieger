/**
 * Textos de tela em português natural: singular/plural e "hoje"/"ontem"/"amanhã",
 * no lugar de "dia(s)" ou "há 0 dias". Só apresentação — as contagens vêm prontas.
 */

/** "1 condomínio", "2 condomínios", "0 condomínios". */
export function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Só a palavra, sem o número: palavra(1, "foi", "foram"). */
export function palavra(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/** Tempo passado desde algo: "hoje", "ontem", "há 5 dias". */
export function haDias(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

/** Prazo relativo a hoje: "Vence hoje", "Vence amanhã", "Em 5 dias", "Venceu ontem", "Vencido há 3 dias". */
export function prazoDias(dias: number): string {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  if (dias === -1) return "Venceu ontem";
  if (dias < 0) return `Vencido há ${-dias} dias`;
  return `Em ${dias} dias`;
}
