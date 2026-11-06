/**
 * Cores das séries/categorias dos gráficos da tela.
 * As 10 primeiras são tokens do design system (--chart-1 … --chart-10 em styles.css);
 * a partir da 11ª a cor é gerada (ângulo áureo no matiz, três luminosidades), então
 * nenhuma categoria do mesmo gráfico repete a cor de outra, qualquer que seja a quantidade.
 */
export const TOTAL_TOKENS_GRAFICO = 10;

// Início do matiz, luminosidades e croma escolhidos para a menor distância de cor entre as 24 primeiras ficar a maior possível.
const LUMINOSIDADES = [0.66, 0.5, 0.8];

export function corDoGrafico(i: number): string {
  if (i < TOTAL_TOKENS_GRAFICO) return `var(--chart-${i + 1})`;
  const k = i - TOTAL_TOKENS_GRAFICO;
  const matiz = Math.round(((240 + k * 137.508) % 360) * 10) / 10;
  return `oklch(${LUMINOSIDADES[k % LUMINOSIDADES.length]} 0.12 ${matiz})`;
}
