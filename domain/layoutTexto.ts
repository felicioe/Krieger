/**
 * Reconstrói o texto de um PDF com o layout visual em espaços (aproximando `pdftotext -layout`)
 * a partir dos itens de texto posicionados que o pdf.js devolve. Função pura: quem chama faz a
 * extração dos itens; o resultado alimenta `lerRelatorio` (domain/pdfParser.ts), que casa cada
 * número com a coluna de mês mais próxima pela posição do caractere final na linha.
 */

export interface ItemTexto {
  str: string;
  /** Canto inferior esquerdo, em pontos (coordenadas do PDF: y cresce para cima). */
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Tokens alinhados à direita nas colunas (valores, competências, Total, Média): posicionados pelo fim. */
const ALINHADO_DIREITA = /^(?:-?\d{1,3}(?:\.\d{3})*,\d{2}|\d{2}\/\d{4}|Total|M[ée]dia)$/;

interface Palavra {
  s: string;
  x: number;
  fim: number;
}

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

/** Quebra um item em palavras, estimando a posição de cada uma pela largura média do caractere do item. */
function palavras(it: ItemTexto): Palavra[] {
  const n = it.str.length;
  if (!n || !(it.largura > 0)) return [];
  const passo = it.largura / n;
  return [...it.str.matchAll(/\S+/g)].map((m) => {
    const ini = it.x + (m.index ?? 0) * passo;
    return { s: m[0], x: ini, fim: ini + m[0].length * passo };
  });
}

/** Uma página por elemento; páginas separadas por "\f" e linhas por "\n". */
export function textoComLayout(paginas: ItemTexto[][]): string {
  const validos = paginas.flat().filter((i) => i.str.trim() && i.largura > 0);
  const cw = mediana(validos.map((i) => i.largura / i.str.length)) || 5;
  const xMin = validos.length ? Math.min(...validos.map((i) => i.x)) : 0;
  const tol = Math.max(1, mediana(validos.map((i) => i.altura)) * 0.5);

  return paginas
    .map((itens) => {
      const ordenados = itens.filter((i) => i.str.trim() && i.largura > 0).sort((a, b) => b.y - a.y || a.x - b.x);
      const linhas: ItemTexto[][] = [];
      let yLinha = Number.NaN;
      for (const it of ordenados) {
        if (!linhas.length || Math.abs(it.y - yLinha) > tol) {
          linhas.push([it]);
          yLinha = it.y;
        } else linhas[linhas.length - 1]!.push(it);
      }
      return linhas
        .map((itensLinha) => {
          const ps = itensLinha.flatMap(palavras).sort((a, b) => a.x - b.x);
          let linha = "";
          let fimAnterior = Number.NEGATIVE_INFINITY;
          for (const p of ps) {
            const lacuna = p.x - fimAnterior;
            let col: number;
            if (ALINHADO_DIREITA.test(p.s)) {
              col = Math.round((p.fim - xMin) / cw) - p.s.length;
            } else if (linha && lacuna < cw * 0.25) {
              col = linha.length; // pedaços da mesma palavra
            } else if (linha && lacuna < cw * 1.5) {
              col = linha.length + 1; // espaço comum entre palavras
            } else {
              col = Math.round((p.x - xMin) / cw);
            }
            if (linha) col = Math.max(col, linha.length + (lacuna < cw * 0.25 ? 0 : 1));
            linha = linha.padEnd(Math.max(col, 0)) + p.s;
            fimAnterior = p.fim;
          }
          return linha;
        })
        .join("\n");
    })
    .join("\f");
}
