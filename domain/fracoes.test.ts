import { describe, expect, it } from "vitest";
import { baseDoRateio, distribuirRateio } from "@/domain/fracoes";
import { arredondarValor } from "@/domain/previsao";
import type { Arredondamento, UnidadeCondominio } from "@/domain/types";

const fr = (unidade: string, fracaoPrevista: number): UnidadeCondominio => ({
  unidade,
  fracaoUnidade: 0,
  fracaoBox: 0,
  fracaoTotal: 0,
  fracaoPrevista,
});

function base(fracoes: UnidadeCondominio[]) {
  const b = baseDoRateio({ unidades: fracoes.length, fracaoUnidades: fracoes });
  if (b.tipo !== "fracao") throw new Error(`esperava fração: ${b.motivo}`);
  return b;
}

describe("base do rateio (#132)", () => {
  it("sem relação de frações, usa a quantidade de unidades e explica o motivo", () => {
    const b = baseDoRateio({ unidades: 10, fracaoUnidades: [] });
    expect(b).toMatchObject({ tipo: "unidades", unidades: 10 });
  });

  it("fração inválida ou soma zero voltam para a contagem, nunca misturam", () => {
    expect(baseDoRateio({ unidades: 2, fracaoUnidades: [fr("101", Number.NaN), fr("102", 0.5)] }).tipo).toBe("unidades");
    expect(baseDoRateio({ unidades: 2, fracaoUnidades: [fr("101", 0), fr("102", 0)] }).tipo).toBe("unidades");
  });

  it("soma 1 ou 100 não gera aviso; outra soma gera aviso e normaliza", () => {
    expect(base([fr("101", 0.4), fr("102", 0.6)]).aviso).toBeNull();
    expect(base([fr("101", 40), fr("102", 60)]).aviso).toBeNull();
    expect(base([fr("101", 0.4), fr("102", 0.5)]).aviso).toMatch(/não 1 nem 100%/);
  });
});

describe("distribuição por fração ideal (#132)", () => {
  const modos: Arredondamento[] = ["centavos", "arredondar", "truncar"];
  const fracoes = [fr("101", 0.123457), fr("102", 0.234567), fr("103", 0.3456), fr("104", 0.296376)];

  for (const modo of modos) {
    it(`soma das cotas fecha exatamente com o total arredondado (${modo})`, () => {
      const d = distribuirRateio(12345.6789, base(fracoes), modo);
      const soma = Math.round(d.cotas.reduce((s, c) => s + c.valor, 0) * 100) / 100;
      expect(soma).toBe(d.total);
      expect(d.total).toBe(arredondarValor(12345.6789, modo));
      expect(d.residuo).toBe(0);
    });
  }

  it("com frações iguais e total divisível, cada cota é igual ao cálculo por unidade de hoje", () => {
    const iguais = [fr("1", 0.25), fr("2", 0.25), fr("3", 0.25), fr("4", 0.25)];
    const d = distribuirRateio(1000, base(iguais), "centavos");
    expect(d.cotas.map((c) => c.valor)).toEqual([250, 250, 250, 250]);
  });

  it("a diferença de arredondamento vai primeiro para a maior fração", () => {
    const d = distribuirRateio(100, base([fr("101", 1), fr("102", 1), fr("103", 2)]), "arredondar");
    // exatos: 25, 25, 50 → sem diferença
    expect(d.cotas.map((c) => c.valor)).toEqual([25, 25, 50]);
    const e = distribuirRateio(101, base([fr("101", 1), fr("102", 1), fr("103", 1)]), "arredondar");
    // exatos 33,67 cada → arredondados 34, 34, 34 = 102; sobra −1, sai da primeira em ordem
    expect(e.cotas.reduce((s, c) => s + c.valor, 0)).toBe(101);
    expect(e.cotas.find((c) => c.unidade === "101")?.valor).toBe(33);
  });
});
