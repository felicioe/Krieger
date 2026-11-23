import { describe, expect, it } from "vitest";
import { aplicarRateioAprovadoDoHistorico, rateioAprovadoDoHistorico } from "@/domain/historicoRateio";
import type { HistoricoRateio } from "@/domain/types";

const linha = (ano: number, rateioAprovado: number): HistoricoRateio => ({
  id: `h${ano}`,
  condoId: "c1",
  ano,
  rateioAtual: null,
  rateioSugerido: null,
  variacao: null,
  rateioAprovado,
  travadoEm: "",
  fonte: "calculo",
  exercicioId: null,
});

describe("rateio aprovado com o histórico como fonte (#327)", () => {
  const hist = [linha(2025, 450)];

  it("com o rateio do ano travado no histórico, vale o do histórico", () => {
    const e = { condoId: "c1", ano: 2025, rateioAprovado: 430 };
    expect(rateioAprovadoDoHistorico(e, hist)).toBe(450);
    expect(aplicarRateioAprovadoDoHistorico(e, hist).rateioAprovado).toBe(450);
  });

  it("sem linha do histórico para o ano, vale o do exercício", () => {
    const e = { condoId: "c1", ano: 2026, rateioAprovado: 500 };
    expect(rateioAprovadoDoHistorico(e, hist)).toBeNull();
    expect(aplicarRateioAprovadoDoHistorico(e, hist).rateioAprovado).toBe(500);
  });

  it("exercício fechado não muda", () => {
    const e = { condoId: "c1", ano: 2025, rateioAprovado: 430, fechado: true };
    expect(aplicarRateioAprovadoDoHistorico(e, hist).rateioAprovado).toBe(430);
  });

  it("valor igual devolve o mesmo objeto", () => {
    const e = { condoId: "c1", ano: 2025, rateioAprovado: 450 };
    expect(aplicarRateioAprovadoDoHistorico(e, hist)).toBe(e);
  });
});
