import { describe, expect, it } from "vitest";
import { aplicarVariacaoDoHistorico, calcularVariacao } from "./historicoRateio";
import type { HistoricoRateio } from "./types";

describe("aplicarVariacaoDoHistorico — cenário real da tela Previsão para relatórios", () => {
  const historico2025: HistoricoRateio = {
    id: "hr-2025",
    condoId: "condo-lago-negro",
    condoNome: "CONDOMINIO RURAL LAGO NEGRO",
    ano: 2025,
    rateioAtual: 321,
    rateioSugerido: 370,
    variacao: calcularVariacao(321, 370),
    rateioAprovado: 370,
    travadoEm: "2026-11-15T00:00:00.000Z",
    fonte: "calculo",
    exercicioId: "e-2025",
  };

  it("injeta variacao quando exercicio tem variacao=0 e variacaoMetodo=percentual (cenário padrão)", () => {
    const exercicio = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 0,
      rateioAtual: null,
      rateioAprovado: null,
    };
    const resultado = aplicarVariacaoDoHistorico(exercicio, [historico2025]);
    expect(resultado.variacao).toBe(15.26);
    expect(resultado.variacaoParam).toBe(15.26);
  });

  it("retorna params inalterados quando historicoRateios está vazio", () => {
    const exercicio = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 0,
    };
    const resultado = aplicarVariacaoDoHistorico(exercicio, []);
    // Se historicoRateios chegar vazio, a variação NÃO será injetada
    expect(resultado.variacao).toBe(0);
  });

  it("retorna params inalterados quando nao há linha do ano anterior", () => {
    const exercicio = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 0,
    };
    // Linha de 2024, não de 2025
    const historicoErrado: HistoricoRateio = { ...historico2025, ano: 2024 };
    const resultado = aplicarVariacaoDoHistorico(exercicio, [historicoErrado]);
    expect(resultado.variacao).toBe(0);
  });

  it("retorna params inalterados quando condoId não bate", () => {
    const exercicio = {
      condoId: "condo-lago-negro",
      ano: 2026,
      variacao: 0,
      variacaoMetodo: "percentual" as const,
      variacaoParam: 0,
    };
    const historicoOutroCondo: HistoricoRateio = { ...historico2025, condoId: "outro-condo" };
    const resultado = aplicarVariacaoDoHistorico(exercicio, [historicoOutroCondo]);
    expect(resultado.variacao).toBe(0);
  });
});