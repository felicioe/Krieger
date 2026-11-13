/**
 * Pontilhado condutor das linhas "rótulo ......... valor" (folha da previsão orçamentária do
 * Systemar). Fonte única para PDF e Word: os dois medem o rótulo com a mesma tabela de larguras e
 * preenchem o resto com pontos, então o documento sai igual nos dois formatos.
 */

/**
 * Largura estimada de um texto em pt, para a família do documento (Source Sans 3 / Liberation
 * Sans). Mesma tabela de `larguraTexto` dos gráficos: maiúsculas e dígitos mais largos que
 * minúsculas. Não precisa ser exata — só estável entre PDF e Word.
 */
export function larguraAproximada(texto: string, corpo: number): number {
  let em = 0;
  for (const ch of texto) {
    if (ch === " ") em += 0.28;
    else if (/[MWÁÀÂÃÉÊÍÓÔÕÚÇA-LN-VX-Z0-9]/.test(ch)) em += /[MW]/.test(ch) ? 0.85 : 0.68;
    else if (/[iljtf.,·:;'|!]/.test(ch)) em += 0.3;
    else if (/[mw]/.test(ch)) em += 0.8;
    else em += 0.55;
  }
  return em * corpo;
}

/** Largura de um ponto final no corpo dado (o "." é estreito: 0.3 em). */
const LARGURA_PONTO = 0.3;
/** Folga mínima entre o último ponto e o valor, em pt. */
const FOLGA = 4;

/**
 * Devolve o rótulo seguido de pontos até preencher `largura` pt. Quando o rótulo já ocupa quase
 * tudo, devolve só o rótulo (sem pontilhado) em vez de encostar no valor.
 */
export function guiar(rotulo: string, largura: number, corpo: number): string {
  const usado = larguraAproximada(rotulo, corpo);
  const livre = largura - usado - FOLGA;
  if (livre <= 0) return rotulo;
  const pontos = Math.floor(livre / (LARGURA_PONTO * corpo));
  if (pontos < 3) return rotulo;
  return `${rotulo} ${".".repeat(pontos)}`;
}
