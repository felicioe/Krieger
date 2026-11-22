import { describe, expect, it } from "vitest";
import { rateioBaseDivergente, ultimoRateioAprovado } from "@/domain/historicoRateio";
import type { HistoricoRateio } from "@/domain/types";

const linha = (ano: number, rateioAprovado: number, condoId = "c1"): HistoricoRateio => ({
  id: `h${ano}${condoId}`,
  condoId,
  ano,
  rateioAtual: null,
  rateioSugerido: null,
  variacao: null,
  rateioAprovado,
  travadoEm: "",
  fonte: "calculo",
  exercicioId: null,
});

describe("rateio atual com o histórico como fonte (#308)", () => {
  const hist = [linha(2024, 400), linha(2025, 450), linha(2025, 999, "c2")];

  it("aponta o aprovado do ano anterior quando o rateio do exercício diverge", () => {
    expect(rateioBaseDivergente({ condoId: "c1", ano: 2026, rateioAtual: 430 }, hist)).toBe(450);
  });

  it("aponta o aprovado do ano anterior quando o exercício não tem rateio", () => {
    expect(rateioBaseDivergente({ condoId: "c1", ano: 2026, rateioAtual: null }, hist)).toBe(450);
  });

  it("não aponta nada quando os dois batem (diferença de centavo arredondado)", () => {
    expect(
      rateioBaseDivergente({ condoId: "c1", ano: 2026, rateioAtual: 450.001 }, hist),
    ).toBeNull();
  });

  it("não aponta nada sem histórico do ano anterior", () => {
    expect(rateioBaseDivergente({ condoId: "c1", ano: 2024, rateioAtual: 300 }, hist)).toBeNull();
  });

  it("último aprovado é o do ano mais recente do condomínio", () => {
    expect(ultimoRateioAprovado(hist, "c1")).toEqual({ ano: 2025, valor: 450 });
    expect(ultimoRateioAprovado(hist, "c3")).toBeNull();
  });
});
