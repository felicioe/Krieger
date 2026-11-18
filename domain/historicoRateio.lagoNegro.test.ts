import { describe, expect, it } from "vitest";
import { aplicarVariacaoDoHistorico, calcularVariacao } from "./historicoRateio";
import type { HistoricoRateio } from "./types";

describe("aplicarVariacaoDoHistorico — caso Lago Negro 2026", () => {
  const historico2025: HistoricoRateio = {
    id: "hr-2025",
    condoId: "condo-lago-negro",
    condoNome: "CONDOMINIO RURAL LAGO NEGRO",
    ano: 2025,
    rateioAtual: 321,
    rateioSugerido: 370,
    variacao: calcularVariacao(321, 370), // 15.26
    rateioAprovado: 370,
    travadoEm: "2026-11-15T00:00:00.000Z",
    fonte: "calculo",
    exercicioId: "e-2025",
  };

  it("injeta 15,26% quando exercício 2026 tem variacao=0 e metodo=percentual", () => {
    const exercicio2026 = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 0,
      rateioAtual: null,
      rateioAprovado: null,
    };

    const resultado = aplicarVariacaoDoHistorico(exercicio2026, [historico2025]);

    expect(resultado.variacao).toBe(15.26);
    expect(resultado.variacaoMetodo).toBe("percentual");
    expect(resultado.variacaoParam).toBe(15.26);
  });

  it("injeta 15,26% mesmo sem variacaoMetodo definido (fallback manual)", () => {
    const exercicio2026 = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoParam: 0,
      rateioAtual: null,
      rateioAprovado: null,
    };

    const resultado = aplicarVariacaoDoHistorico(exercicio2026, [historico2025]);

    expect(resultado.variacao).toBe(15.26);
    expect(resultado.variacaoMetodo).toBe("percentual");
    expect(resultado.variacaoParam).toBe(15.26);
  });

  it("não sobrescreve quando exercício já tem variação explícita diferente de zero", () => {
    const exercicio2026 = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 10,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 10,
      rateioAtual: null,
      rateioAprovado: null,
    };

    const resultado = aplicarVariacaoDoHistorico(exercicio2026, [historico2025]);

    expect(resultado.variacao).toBe(10);
    expect(resultado.variacaoParam).toBe(10);
  });

  it("recalcula variacao a partir dos rateios quando campo variacao da linha for null", () => {
    const historicoSemVariacao: HistoricoRateio = {
      ...historico2025,
      variacao: null,
    };

    const exercicio2026 = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 0,
      rateioAtual: null,
      rateioAprovado: null,
    };

    const resultado = aplicarVariacaoDoHistorico(exercicio2026, [historicoSemVariacao]);

    expect(resultado.variacao).toBe(15.26);
    expect(resultado.variacaoMetodo).toBe("percentual");
    expect(resultado.variacaoParam).toBe(15.26);
  });
});