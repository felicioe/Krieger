import { describe, expect, it } from "vitest";
import { calcularPrevisao } from "./previsao";
import { demonstrativoVazio, recalcularDemonstrativo } from "./demonstrativo";

describe("variação de despesas sugeridas", () => {
  it("soma ou subtrai o valor em reais sem alterar o percentual", () => {
    const demonstrativo = recalcularDemonstrativo({ ...demonstrativoVazio("Teste"), despesas: { grupos: [{ nome: "Geral", itens: [{ nome: "Despesa", valor: 1000 }] }], subtotal: 0, saldoRestante: 0 } });
    const base = { variacao: 10, variacaoMetodo: "percentual" as const, variacaoParam: 10, arredondamento: "centavos" as const, deducaoRegex: "", rateioAtual: null, prev: { modo: "tradicional" as const, variacaoDespesas: { sinal: "+" as const, valor: 50 } } };
    expect(calcularPrevisao(demonstrativo, base, null).totalAnual).toBe(1150);
    expect(calcularPrevisao(demonstrativo, { ...base, prev: { ...base.prev, variacaoDespesas: { sinal: "-", valor: 50 } } }, null).totalAnual).toBe(1050);
  });
});
