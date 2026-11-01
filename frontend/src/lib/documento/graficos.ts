import { formatBRL, formatNumeroBR, formatValorCurto } from "@/lib/format";
import { svgParaPng } from "./imagens";
import type { Bloco } from "./tipos";

/**
 * Gráficos dos documentos, desenhados em SVG e rasterizados em PNG
 * (o mesmo arquivo de imagem vai para o PDF e para o Word).
 * Só desenham valores já calculados pelo domínio.
 * A altura de cada gráfico cresce com a quantidade de categorias, então
 * nenhum rótulo se sobrepõe nem é cortado, qualquer que seja o número de grupos.
 */

const FONTE = "Roboto, 'Helvetica Neue', Arial, sans-serif";
export const PALETA = [
  "#0b3a5e",
  "#8fa3c0",
  "#3e6a8f",
  "#c7a55b",
  "#5f8f7a",
  "#9a6b8f",
  "#b5c3d3",
  "#6b7a8a",
  "#8c5a3c",
  "#d9c48c",
];

export interface Grafico {
  svg: string;
  largura: number;
  altura: number;
}

/** Cor da categoria i: a paleta e, depois dela, cores geradas — nunca repete dentro do mesmo gráfico. */
export function corDocumento(i: number): string {
  if (i < PALETA.length) return PALETA[i]!;
  const k = i - PALETA.length;
  // Início, luminosidades e saturação escolhidos para a menor distância de cor entre as 24 primeiras ficar a maior possível.
  const h = (190 + k * 137.508) % 360;
  const l = [0.42, 0.72, 0.58][k % 3]!;
  return hslHex(h, 0.6, l);
}

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eixo = (v: number) =>
  Math.abs(v) >= 1000 ? `${formatNumeroBR(v / 1000, 0)} mil` : formatNumeroBR(v, 0);

/** Largura estimada do texto (Roboto/Helvetica): maiúsculas e números mais largos que minúsculas. */
export function larguraTexto(texto: string, fonte: number): number {
  let em = 0;
  for (const ch of texto) {
    if (ch === " ") em += 0.28;
    else if (/[MWÁÀÂÃÉÊÍÓÔÕÚÇA-LN-VX-Z0-9]/.test(ch)) em += /[MW]/.test(ch) ? 0.85 : 0.68;
    else if (/[iljtf.,·:;'|!]/.test(ch)) em += 0.3;
    else if (/[mw]/.test(ch)) em += 0.8;
    else em += 0.55;
  }
  return em * fonte;
}

/** Quebra o texto em linhas que cabem na largura; palavra maior que a largura fica sozinha na linha. */
export function quebrarTexto(
  texto: string,
  largura: number,
  fonte: number,
  maxLinhas = 3,
): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    if (!atual) atual = p;
    else if (larguraTexto(`${atual} ${p}`, fonte) <= largura) atual += ` ${p}`;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > maxLinhas) {
    let ultima = linhas.slice(maxLinhas - 1).join(" ");
    while (ultima.length > 1 && larguraTexto(`${ultima}…`, fonte) > largura)
      ultima = ultima.slice(0, -1);
    linhas.splice(maxLinhas - 1, linhas.length, `${ultima.trimEnd()}…`);
  }
  return linhas.length ? linhas : [""];
}

/** Fonte do rótulo: reduz só quando uma palavra sozinha não cabe na largura. */
function fonteQueCabe(texto: string, largura: number, fonte: number, minimo = 6.5): number {
  const maior = Math.max(0, ...texto.split(/\s+/).map((p) => larguraTexto(p, fonte)));
  return maior > largura
    ? Math.max(minimo, Math.floor(((fonte * largura) / maior) * 10) / 10)
    : fonte;
}

function passoBonito(max: number, divisoes: number) {
  if (max <= 0) return 1;
  const bruto = max / divisoes;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

export interface Serie {
  nome: string;
  cor: string;
  valores: number[];
}

function legendaSeries(series: Serie[], x0: number, partes: string[]) {
  let lx = x0;
  for (const s of series) {
    partes.push(`<rect x="${lx}" y="7" width="11" height="11" fill="${s.cor}" rx="2"/>`);
    partes.push(`<text x="${lx + 15}" y="16.5" font-size="10" fill="#1f2933">${esc(s.nome)}</text>`);
    lx += 15 + larguraTexto(s.nome, 10) + 18;
  }
}

/** Valor curto escrito na ponta da barra (o valor exato fica na tabela). */
const valorCurto = formatValorCurto;

/**
 * Barras horizontais agrupadas por categoria (ex.: previsto × realizado por grupo).
 * As categorias ficam à esquerda, com o nome quebrado em até 3 linhas; cada barra traz o
 * valor escrito na ponta, então uma barra zerada aparece como "0", não como um vazio.
 */
export function barrasSvg(categorias: string[], series: Serie[], largura = 480): Grafico {
  const FONTE_ROT = 8.5;
  const FONTE_VALOR = 7.5;
  const colRotulo = 150;
  const todos = series.flatMap((s) => s.valores);
  const colValor = Math.ceil(Math.max(0, ...todos.map((v) => larguraTexto(valorCurto(v), FONTE_VALOR)))) + 6;
  const m = { esq: colRotulo + 8, dir: Math.max(14, colValor + 4), topo: 30, base: 22 };
  const w = largura - m.esq - m.dir;
  const barra = 10;
  const rotulos = categorias.map((c) => {
    const fonte = fonteQueCabe(c, colRotulo, FONTE_ROT);
    return { fonte, linhas: quebrarTexto(c, colRotulo, fonte) };
  });
  const alturas = rotulos.map((r) =>
    Math.max(series.length * (barra + 1.5) + 10, r.linhas.length * (r.fonte + 1.5) + 8),
  );
  const h = alturas.reduce((s, a) => s + a, 0);
  const altura = Math.ceil(m.topo + h + m.base);

  const maxBruto = Math.max(0, ...todos);
  const minBruto = Math.min(0, ...todos);
  const passo = passoBonito(maxBruto - minBruto, 5);
  const max = Math.ceil(maxBruto / passo) * passo || passo;
  const min = Math.floor(minBruto / passo) * passo;
  const x = (v: number) => m.esq + ((v - min) / (max - min)) * w;
  const partes: string[] = [];

  for (let v = min; v <= max + passo / 2; v += passo) {
    partes.push(
      `<line x1="${x(v)}" x2="${x(v)}" y1="${m.topo}" y2="${m.topo + h}" stroke="#e3e8ee" stroke-width="0.7"/>`,
    );
    partes.push(
      `<text x="${x(v)}" y="${m.topo + h + 13}" text-anchor="middle" font-size="8.5" fill="#5f6b7a">${esc(eixo(v))}</text>`,
    );
  }
  let y0 = m.topo;
  categorias.forEach((_, i) => {
    const alt = alturas[i]!;
    const meio = y0 + alt / 2;
    const yb = meio - (series.length * (barra + 1.5)) / 2;
    series.forEach((s, k) => {
      const v = s.valores[i] ?? 0;
      const esq = Math.min(x(v), x(0));
      const larg = Math.abs(x(v) - x(0));
      const yk = yb + k * (barra + 1.5);
      partes.push(
        `<rect x="${esq}" y="${yk}" width="${Math.max(0.5, larg)}" height="${barra}" fill="${s.cor}" rx="1.5"/>`,
      );
      // Positivo: depois da ponta da barra. Negativo: à direita do eixo zero, para não invadir os nomes.
      partes.push(
        `<text x="${(v >= 0 ? x(v) : x(0)) + 3}" y="${yk + barra * 0.78}" font-size="${FONTE_VALOR}" fill="#1f2933">${esc(valorCurto(v))}</text>`,
      );
    });
    const { fonte, linhas } = rotulos[i]!;
    const passoLinha = fonte + 1.5;
    const primeira = meio - ((linhas.length - 1) * passoLinha) / 2 + fonte * 0.35;
    linhas.forEach((l, k) =>
      partes.push(
        `<text x="${colRotulo}" y="${primeira + k * passoLinha}" text-anchor="end" font-size="${fonte}" fill="#1f2933">${esc(l)}</text>`,
      ),
    );
    y0 += alt;
  });
  partes.push(
    `<line x1="${x(0)}" x2="${x(0)}" y1="${m.topo}" y2="${m.topo + h}" stroke="#5f6b7a" stroke-width="0.8"/>`,
  );
  legendaSeries(series, m.esq, partes);
  return envolver(largura, altura, partes);
}

/** Rosca com legenda (nome, valor e % do total); o nome quebra linha em vez de encostar no valor. */
export function pizzaSvg(fatias: { nome: string; valor: number }[], largura = 480): Grafico {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0);
  const FONTE_LEG = 9;
  const xLegenda = 105 + 95 + 30;
  const valores = fatias.map(
    (f) =>
      `${formatBRL(f.valor)} · ${total ? `${formatNumeroBR((Math.max(0, f.valor) / total) * 100, 1)}%` : ""}`,
  );
  const colValor = Math.max(0, ...valores.map((v) => larguraTexto(v, FONTE_LEG)));
  const colNome = largura - 8 - colValor - 10 - (xLegenda + 14);
  const itens = fatias.map((f) => quebrarTexto(f.nome, colNome, FONTE_LEG));
  const alturasItem = itens.map((l) => Math.max(16, l.length * 11 + 6));
  const alturaLegenda = alturasItem.reduce((s, a) => s + a, 0);
  const altura = Math.ceil(Math.max(230, alturaLegenda + 20));

  const cx = 105;
  const cy = altura / 2;
  const r = 95;
  const ri = r * 0.55;
  const partes: string[] = [];
  let ang = -Math.PI / 2;
  fatias.forEach((f, i) => {
    const cor = corDocumento(i);
    const frac = total ? Math.max(0, f.valor) / total : 0;
    if (frac >= 0.9999) {
      partes.push(
        `<circle cx="${cx}" cy="${cy}" r="${(r + ri) / 2}" fill="none" stroke="${cor}" stroke-width="${r - ri}"/>`,
      );
    } else if (frac > 0) {
      const a2 = ang + frac * 2 * Math.PI;
      const grande = frac > 0.5 ? 1 : 0;
      const p = (a: number, raio: number) =>
        `${cx + raio * Math.cos(a)} ${cy + raio * Math.sin(a)}`;
      partes.push(
        `<path d="M ${p(ang, r)} A ${r} ${r} 0 ${grande} 1 ${p(a2, r)} L ${p(a2, ri)} A ${ri} ${ri} 0 ${grande} 0 ${p(ang, ri)} Z" fill="${cor}" stroke="#ffffff" stroke-width="1.5"/>`,
      );
      ang = a2;
    }
  });
  let y = cy - alturaLegenda / 2;
  fatias.forEach((_, i) => {
    const linhas = itens[i]!;
    const alt = alturasItem[i]!;
    const base = y + alt / 2 - ((linhas.length - 1) * 11) / 2 + 3;
    partes.push(
      `<rect x="${xLegenda}" y="${base - 7}" width="9" height="9" fill="${corDocumento(i)}" rx="1.5"/>`,
    );
    linhas.forEach((l, k) =>
      partes.push(
        `<text x="${xLegenda + 14}" y="${base + 1 + k * 11}" font-size="${FONTE_LEG}" fill="#1f2933">${esc(l)}</text>`,
      ),
    );
    partes.push(
      `<text x="${largura - 8}" y="${base + 1}" font-size="${FONTE_LEG}" text-anchor="end" fill="#5f6b7a">${esc(valores[i]!)}</text>`,
    );
    y += alt;
  });
  return envolver(largura, altura, partes);
}

/**
 * Linhas de evolução ao longo de categorias ordenadas (ex.: receitas/despesas/saldo mês a mês).
 * Eixo Y compartilhado entre as séries; eixo X com uma categoria por ponto.
 * `semLegenda`: quando o nome da série já aparece como título fora da imagem (ex.: um
 * mini-gráfico por categoria), a legenda interna do SVG é dispensável — e arriscada, porque não
 * quebra linha dentro da largura fixa do gráfico e cortaria um nome de categoria longo sem deixar
 * como recuperar o texto depois de rasterizado.
 */
export function linhaSvg(categorias: string[], series: Serie[], largura = 480, semLegenda = false): Grafico {
  const FONTE_EIXO = 8;
  const todos = series.flatMap((s) => s.valores);
  const n = categorias.length;
  // Os rótulos das extremidades ficam centralizados exatamente na borda do gráfico (m.esq / largura-m.dir);
  // a margem de cada lado precisa caber a metade da largura do rótulo, senão ele é cortado na rasterização.
  const margemRotulo = (c: string | undefined) => (c ? larguraTexto(c, FONTE_EIXO) / 2 + 6 : 0);
  const m = {
    esq: Math.max(46, margemRotulo(categorias[0])),
    dir: Math.max(10, margemRotulo(categorias[n - 1])),
    topo: 30,
    base: 24,
  };
  const w = largura - m.esq - m.dir;
  const h = 190;
  const altura = Math.ceil(m.topo + h + m.base);

  const maxBruto = Math.max(0, ...todos);
  const minBruto = Math.min(0, ...todos);
  const passo = passoBonito(maxBruto - minBruto, 4);
  const max = Math.ceil(maxBruto / passo) * passo || passo;
  const min = Math.floor(minBruto / passo) * passo;
  const escalaY = (v: number) => m.topo + h - ((v - min) / (max - min || 1)) * h;
  const escalaX = (i: number) => (n <= 1 ? m.esq + w / 2 : m.esq + (i / (n - 1)) * w);

  const partes: string[] = [];
  for (let v = min; v <= max + passo / 2; v += passo) {
    partes.push(
      `<line x1="${m.esq}" x2="${m.esq + w}" y1="${escalaY(v)}" y2="${escalaY(v)}" stroke="#e3e8ee" stroke-width="0.7"/>`,
    );
    partes.push(
      `<text x="${m.esq - 6}" y="${escalaY(v) + 3}" text-anchor="end" font-size="${FONTE_EIXO}" fill="#5f6b7a">${esc(eixo(v))}</text>`,
    );
  }
  categorias.forEach((c, i) => {
    partes.push(
      `<text x="${escalaX(i)}" y="${m.topo + h + 15}" text-anchor="middle" font-size="${FONTE_EIXO}" fill="#5f6b7a">${esc(c)}</text>`,
    );
  });
  series.forEach((s) => {
    const pontos = s.valores.map((v, i) => `${escalaX(i)},${escalaY(v)}`).join(" ");
    partes.push(`<polyline points="${pontos}" fill="none" stroke="${s.cor}" stroke-width="1.8"/>`);
    s.valores.forEach((v, i) =>
      partes.push(`<circle cx="${escalaX(i)}" cy="${escalaY(v)}" r="2.4" fill="${s.cor}"/>`),
    );
  });
  if (!semLegenda) legendaSeries(series, m.esq, partes);
  return envolver(largura, altura, partes);
}

function envolver(largura: number, altura: number, partes: string[]): Grafico {
  return {
    largura,
    altura,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" font-family="${FONTE}">${partes.join("")}</svg>`,
  };
}

export const graficoPng = (svg: string, largura: number, altura: number) =>
  svgParaPng(svg, largura, altura);

/** Altura máxima de um gráfico na página (pt); acima disso a imagem é reduzida por igual, sem distorcer. */
const ALTURA_MAX = 640;

/** Bloco de imagem do gráfico, já rasterizado, no tamanho que cabe na página. */
export async function blocoGrafico(g: Grafico): Promise<Extract<Bloco, { tipo: "imagem" }>> {
  const escala = Math.min(1, ALTURA_MAX / g.altura);
  return {
    tipo: "imagem",
    dataUrl: await graficoPng(g.svg, g.largura, g.altura),
    largura: Math.round(g.largura * escala),
    altura: Math.round(g.altura * escala),
  };
}
