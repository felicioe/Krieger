import { formatBRL, formatNumeroBR } from "@/lib/format";
import { svgParaPng } from "./imagens";

/**
 * Gráficos dos documentos, desenhados em SVG e rasterizados em PNG
 * (o mesmo arquivo de imagem vai para o PDF e para o Word).
 * Só desenham valores já calculados pelo domínio.
 */

const FONTE = "Roboto, 'Helvetica Neue', Arial, sans-serif";
export const PALETA = ["#0b3a5e", "#8fa3c0", "#3e6a8f", "#c7a55b", "#5f8f7a", "#9a6b8f", "#b5c3d3", "#6b7a8a"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eixo = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumeroBR(v / 1000, 0)} mil` : formatNumeroBR(v, 0));

function passoBonito(max: number, divisoes: number) {
  if (max <= 0) return 1;
  const bruto = max / divisoes;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/** Quebra um rótulo em até duas linhas curtas. */
function linhasRotulo(texto: string, max = 16): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    if (!atual) atual = p;
    else if ((atual + " " + p).length <= max) atual += " " + p;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > 2) linhas.splice(1, linhas.length - 1, `${linhas.slice(1).join(" ").slice(0, max - 1)}…`);
  return linhas.map((l) => (l.length > max + 2 ? `${l.slice(0, max)}…` : l));
}

export interface Serie {
  nome: string;
  cor: string;
  valores: number[];
}

/** Barras agrupadas por categoria (ex.: previsto × realizado por grupo). */
export function barrasSvg(categorias: string[], series: Serie[], largura = 480, altura = 250): string {
  const m = { esq: 52, dir: 8, topo: 30, base: 38 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const todos = series.flatMap((s) => s.valores);
  const maxBruto = Math.max(0, ...todos);
  const minBruto = Math.min(0, ...todos);
  const passo = passoBonito(maxBruto - minBruto, 5);
  const max = Math.ceil(maxBruto / passo) * passo || passo;
  const min = Math.floor(minBruto / passo) * passo;
  const y = (v: number) => m.topo + h - ((v - min) / (max - min)) * h;
  const partes: string[] = [];

  for (let v = min; v <= max + passo / 2; v += passo) {
    partes.push(`<line x1="${m.esq}" x2="${m.esq + w}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e8ee" stroke-width="0.7"/>`);
    partes.push(`<text x="${m.esq - 6}" y="${y(v) + 3}" text-anchor="end" font-size="8.5" fill="#5f6b7a">${esc(eixo(v))}</text>`);
  }
  const grupo = w / Math.max(1, categorias.length);
  const barra = Math.min(26, (grupo * 0.7) / Math.max(1, series.length));
  categorias.forEach((cat, i) => {
    const x0 = m.esq + grupo * i + (grupo - barra * series.length) / 2;
    series.forEach((s, k) => {
      const v = s.valores[i] ?? 0;
      const topo = Math.min(y(v), y(0));
      const alt = Math.abs(y(v) - y(0));
      partes.push(`<rect x="${x0 + k * barra}" y="${topo}" width="${barra - 2}" height="${Math.max(0.5, alt)}" fill="${s.cor}" rx="1.5"/>`);
    });
    linhasRotulo(cat).forEach((l, k) =>
      partes.push(`<text x="${m.esq + grupo * i + grupo / 2}" y="${m.topo + h + 13 + k * 10}" text-anchor="middle" font-size="8.5" fill="#1f2933">${esc(l)}</text>`),
    );
  });
  partes.push(`<line x1="${m.esq}" x2="${m.esq + w}" y1="${y(0)}" y2="${y(0)}" stroke="#5f6b7a" stroke-width="0.8"/>`);
  let lx = m.esq;
  for (const s of series) {
    partes.push(`<rect x="${lx}" y="8" width="9" height="9" fill="${s.cor}" rx="1.5"/>`);
    partes.push(`<text x="${lx + 13}" y="16" font-size="9" fill="#1f2933">${esc(s.nome)}</text>`);
    lx += 13 + s.nome.length * 5.2 + 16;
  }
  return envolver(largura, altura, partes);
}

/** Rosca com legenda (nome, valor e % do total). */
export function pizzaSvg(fatias: { nome: string; valor: number }[], largura = 480, altura = 230): string {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0);
  const cx = 105;
  const cy = altura / 2;
  const r = Math.min(95, altura / 2 - 10);
  const ri = r * 0.55;
  const partes: string[] = [];
  let ang = -Math.PI / 2;
  fatias.forEach((f, i) => {
    const cor = PALETA[i % PALETA.length]!;
    const frac = total ? Math.max(0, f.valor) / total : 0;
    if (frac >= 0.9999) {
      partes.push(`<circle cx="${cx}" cy="${cy}" r="${(r + ri) / 2}" fill="none" stroke="${cor}" stroke-width="${r - ri}"/>`);
    } else if (frac > 0) {
      const a2 = ang + frac * 2 * Math.PI;
      const grande = frac > 0.5 ? 1 : 0;
      const p = (a: number, raio: number) => `${cx + raio * Math.cos(a)} ${cy + raio * Math.sin(a)}`;
      partes.push(
        `<path d="M ${p(ang, r)} A ${r} ${r} 0 ${grande} 1 ${p(a2, r)} L ${p(a2, ri)} A ${ri} ${ri} 0 ${grande} 0 ${p(ang, ri)} Z" fill="${cor}" stroke="#ffffff" stroke-width="1.5"/>`,
      );
      ang = a2;
    }
  });
  const x = cx + r + 30;
  const passo = Math.min(20, (altura - 20) / Math.max(1, fatias.length));
  const y0 = cy - (passo * fatias.length) / 2 + passo / 2;
  fatias.forEach((f, i) => {
    const y = y0 + i * passo;
    const pct = total ? `${formatNumeroBR((Math.max(0, f.valor) / total) * 100, 1)}%` : "";
    partes.push(`<rect x="${x}" y="${y - 7}" width="9" height="9" fill="${PALETA[i % PALETA.length]}" rx="1.5"/>`);
    partes.push(`<text x="${x + 14}" y="${y + 1}" font-size="9" fill="#1f2933">${esc(f.nome.length > 30 ? `${f.nome.slice(0, 29)}…` : f.nome)}</text>`);
    partes.push(`<text x="${largura - 8}" y="${y + 1}" font-size="9" text-anchor="end" fill="#5f6b7a">${esc(`${formatBRL(f.valor)} · ${pct}`)}</text>`);
  });
  return envolver(largura, altura, partes);
}

function envolver(largura: number, altura: number, partes: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" font-family="${FONTE}">${partes.join("")}</svg>`;
}

export const graficoPng = (svg: string, largura: number, altura: number) => svgParaPng(svg, largura, altura);
