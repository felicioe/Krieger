import { describe, expect, it } from "vitest";
import { previstoAprovadoDerivado, percentualExplicitoDoExercicio } from "./previstoAprovado";
import { percentualAprovadoDoHistorico } from "./historicoRateio";
import { demonstrativoVazio, recalcularDemonstrativo } from "./demonstrativo";
import type { Demonstrativo, HistoricoRateio } from "./types";

const demo = (grupos: Demonstrativo["despesas"]["grupos"]): Demonstrativo =>
  recalcularDemonstrativo({ ...demonstrativoVazio("T"), despesas: { grupos, subtotal: 0, saldoRestante: 0 } });

const linha = (ano: number, extra: Partial<HistoricoRateio>): HistoricoRateio => ({
  id: `h${ano}`, condoId: "c1", ano, rateioAtual: null, rateioSugerido: null, variacao: null, rateioAprovado: 370, travadoEm: "", fonte: "importacao", exercicioId: null, ...extra,
});

const base = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }]);

describe("previstoAprovadoDerivado", () => {
  it("exemplo da especificação: R$ 120.000 com 10% gera R$ 132.000", () => {
    const p = previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: base, historicoRateios: [linha(2025, { variacao: 10 })] });
    expect(p.situacao).toBe("ok");
    expect(p.totalPrevisto).toBe(132000);
    expect(p.origemPercentual).toBe("historico");
    expect(p.grupos[0]!.contas[0]).toMatchObject({ realizadoOrigem: 120000, previsto: 132000 });
  });

  it("total fecha pela soma das linhas arredondadas em centavos", () => {
    const b = demo([{ nome: "G", itens: [{ nome: "A", valor: 0.05 }, { nome: "B", valor: 0.05 }, { nome: "C", valor: 0.05 }] }]);
    const p = previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: b, historicoRateios: [linha(2025, { variacao: 10 })] });
    const soma = p.grupos[0]!.contas.reduce((s, c) => s + c.previsto, 0);
    expect(p.totalPrevisto).toBeCloseTo(soma, 2);
  });

  it("0% é válido e não vira pendência", () => {
    const p = previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: base, historicoRateios: [linha(2025, { variacao: 0 })] });
    expect(p.situacao).toBe("ok");
    expect(p.totalPrevisto).toBe(120000);
  });

  it("variação vazia no histórico é recalculada pelos rateios da própria linha (caso Lago Negro 321 → 370)", () => {
    expect(percentualAprovadoDoHistorico([linha(2025, { rateioAtual: 321 })], "c1", 2025)).toBe(15.26);
    expect(percentualAprovadoDoHistorico([linha(2025, { rateioSugerido: 321 })], "c1", 2025)).toBe(15.26);
    expect(percentualAprovadoDoHistorico([linha(2025, {})], "c1", 2025)).toBeNull();
    expect(percentualAprovadoDoHistorico([], "c1", 2025)).toBeNull();
  });

  it("sem base: sem previsão aprovada; sem percentual: pendente", () => {
    expect(previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: null }).situacao).toBe("sem_base");
    expect(previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: base }).situacao).toBe("sem_percentual");
  });

  it("percentual explícito do exercício ignora 0 (não informado) e o método em valor", () => {
    expect(percentualExplicitoDoExercicio({ variacao: 0, variacaoMetodo: "manual", variacaoParam: null })).toBeNull();
    expect(percentualExplicitoDoExercicio({ variacao: 0, variacaoMetodo: "percentual", variacaoParam: 8 })).toBe(8);
    expect(percentualExplicitoDoExercicio({ variacao: 0, variacaoMetodo: "valor", variacaoParam: 30000 })).toBeNull();
  });
});
