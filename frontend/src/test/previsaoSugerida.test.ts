import { describe, expect, it } from "vitest";
import { calcularPrevisaoSugerida, calcularPrevisaoSugeridaPorUnidade, previsaoSugeridaDoPdf } from "@/domain/previsaoSugerida";
import type { PrevisaoSugeridaLida } from "@/domain/pdfParser";

const lida: PrevisaoSugeridaLida = {
  rateioMensalAtual: 10000,
  categorias: [
    { nome: "Pessoal", anual: 120000, media: 10000 },
    { nome: "Consumo", anual: 24000, media: 2000 },
  ],
  totalDespesasAno: 144000,
  totalDespesasMedia: 12000,
  deducao: -12000,
  totalOrdinario: 132000,
  variacaoSugerida: 6000,
  rateioAnualSugerido: 138000,
  rateioMensalSugerido: 11500,
  indiceSugerido: 15,
};

describe("previsão orçamentária sugerida", () => {
  it("a dedução do PDF vira a linha editável “Parte água e gás” com sinal −", () => {
    const p = previsaoSugeridaDoPdf(lida);
    expect(p.deducoes).toEqual([{ id: "ded-agua-gas", descricao: "Parte água e gás", sinal: "-", valor: 12000 }]);
    expect(p.variacao).toEqual({ sinal: "+", valor: 6000 });
  });

  it("rateio mensal sugerido = (despesas ± deduções ± variação) ÷ 12, índice sobre o rateio atual", () => {
    const r = calcularPrevisaoSugerida(previsaoSugeridaDoPdf(lida));
    expect(r.totalOrdinario).toBe(132000);
    expect(r.totalFinal).toBe(138000);
    expect(r.rateioMensalSugerido).toBe(11500);
    expect(r.indiceSugerido).toBe(15);
  });

  it("deduções acrescentadas pelo usuário entram no total ordinário", () => {
    const p = previsaoSugeridaDoPdf(lida);
    p.deducoes.push({ id: "x", descricao: "Outra", sinal: "-", valor: 6000 });
    expect(calcularPrevisaoSugerida(p).totalOrdinario).toBe(126000);
  });

  it("quadro por unidade: cota + fundo de reserva, sem unidades fica vazio", () => {
    expect(calcularPrevisaoSugeridaPorUnidade(11500, 50, 10, "truncar")).toEqual({
      unidades: 50,
      cotaUnidade: 230,
      reservaUnidade: 23,
      valorUnidade: 253,
    });
    expect(calcularPrevisaoSugeridaPorUnidade(11500, null, 10, "truncar").valorUnidade).toBeNull();
  });
});
