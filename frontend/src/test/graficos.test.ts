import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { corDoGrafico } from "@/components/app/coresGrafico";

vi.mock("@/lib/documento/imagens", () => ({
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));
const { barrasSvg, blocoGrafico, corDocumento, larguraTexto, linhaSvg, pizzaSvg, quebrarTexto } =
  await import("@/lib/documento/graficos");

const GRUPOS = [
  "DEPARTAMENTO PESSOAL",
  "ADMINISTRATIVAS E AFINS",
  "SERVIÇOS ESSENCIAIS",
  "SEGURO E JUDICIAL",
  "MANUTENÇÕES E TAXAS",
  "AQUISIÇÕES",
  "DESPESAS COM ÁREA DE LAZER",
  "DESPESAS DIVERSAS",
];
const grupos = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `${GRUPOS[i % GRUPOS.length]}${i >= GRUPOS.length ? ` ${i + 1}` : ""}`,
  );
const series = (n: number) => [
  {
    nome: "Previsto",
    cor: "#8fa3c0",
    valores: Array.from({ length: n }, (_, i) => 1000 * (i + 1)),
  },
  {
    nome: "Realizado",
    cor: "#0b3a5e",
    valores: Array.from({ length: n }, (_, i) => 1100 * (i + 1)),
  },
];

describe("cores dos gráficos", () => {
  it("na tela, as 10 primeiras categorias usam os tokens --chart-1 a --chart-10, e todos existem no tema", () => {
    const css = readFileSync("src/styles.css", "utf8");
    for (let i = 0; i < 10; i++) {
      expect(corDoGrafico(i)).toBe(`var(--chart-${i + 1})`);
      expect(css).toMatch(new RegExp(`--chart-${i + 1}:\\s*oklch`));
    }
  });

  it("na tela, nenhuma categoria repete a cor de outra, mesmo com 60 grupos", () => {
    const cores = Array.from({ length: 60 }, (_, i) => corDoGrafico(i));
    expect(new Set(cores).size).toBe(60);
  });

  it("no PDF/Word, nenhuma categoria repete a cor de outra, mesmo com 60 grupos", () => {
    const cores = Array.from({ length: 60 }, (_, i) => corDocumento(i));
    expect(new Set(cores).size).toBe(60);
    for (const c of cores) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("gráficos do PDF/Word com muitos grupos", () => {
  it("cada linha do nome do grupo cabe na coluna de rótulos (150 pt)", () => {
    for (const g of GRUPOS)
      for (const l of quebrarTexto(g, 150, 8.5))
        expect(larguraTexto(l, 8.5)).toBeLessThanOrEqual(150);
  });

  it("barras: a altura cresce com a quantidade de grupos, em vez de espremer os rótulos", () => {
    const quatro = barrasSvg(grupos(4), series(4));
    const oito = barrasSvg(grupos(8), series(8));
    const vinte = barrasSvg(grupos(20), series(20));
    expect(oito.altura).toBeGreaterThan(quatro.altura);
    expect(vinte.altura).toBeGreaterThan(oito.altura);
    expect(oito.svg).toContain("DEPARTAMENTO PESSOAL");
  });

  it("pizza: a legenda cresce com os grupos e cada um tem uma cor diferente", () => {
    const g = pizzaSvg(grupos(20).map((nome, i) => ({ nome, valor: 100 * (i + 1) })));
    expect(g.altura).toBeGreaterThan(230);
    const fills = [...g.svg.matchAll(/<rect [^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(fills).toHaveLength(20);
    expect(new Set(fills).size).toBe(20);
  });

  it("gráfico muito alto é reduzido por igual para caber na página", async () => {
    const g = barrasSvg(grupos(40), series(40));
    const b = await blocoGrafico(g);
    expect(b.altura).toBeLessThanOrEqual(640);
    expect(b.largura / b.altura).toBeCloseTo(g.largura / g.altura, 1);
  });
});

describe("gráfico de evolução mensal (linhaSvg)", () => {
  it("rótulo da última competência (ex.: 12/2026) não é cortado na borda direita", () => {
    const categorias = ["01/2026", "02/2026", "03/2026", "12/2026"];
    const g = linhaSvg(categorias, series(categorias.length));
    const m = g.svg.match(/<text x="([\d.]+)"[^>]*text-anchor="middle"[^>]*>12\/2026<\/text>/);
    expect(m).not.toBeNull();
    const cx = Number(m![1]);
    const meiaLargura = larguraTexto("12/2026", 8) / 2;
    expect(cx + meiaLargura).toBeLessThanOrEqual(g.largura);
  });

  it("rótulo da primeira competência não extrapola a borda esquerda", () => {
    const categorias = ["01/2026", "02/2026", "03/2026", "12/2026"];
    const g = linhaSvg(categorias, series(categorias.length));
    const m = g.svg.match(/<text x="([\d.]+)"[^>]*text-anchor="middle"[^>]*>01\/2026<\/text>/);
    expect(m).not.toBeNull();
    const cx = Number(m![1]);
    const meiaLargura = larguraTexto("01/2026", 8) / 2;
    expect(cx - meiaLargura).toBeGreaterThanOrEqual(0);
  });
});
