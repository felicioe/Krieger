import { describe, expect, it } from "vitest";
import {
  aplicarRateioBase,
  calcularVariacao,
  historicoDoAno,
  historicoDoExercicio,
  historicoOrdenado,
  rateioBaseDoAno,
  variacaoDoAno,
} from "./historicoRateio";
import type { HistoricoRateio } from "./types";

const linha = (ano: number, aprovado: number, atual: number | null = null): HistoricoRateio => ({
  id: `hr-${ano}`,
  condoId: "c1",
  condoNome: "Urban Classic",
  ano,
  rateioAtual: atual,
  rateioSugerido: aprovado,
  variacao: calcularVariacao(atual, aprovado),
  rateioAprovado: aprovado,
  travadoEm: "2026-11-15T00:00:00.000Z",
  fonte: "calculo",
  exercicioId: `e-${ano}`,
});

describe("calcularVariacao", () => {
  it("calcula a variação percentual do atual sobre o anterior", () => {
    expect(calcularVariacao(321, 370)).toBe(15.26);
    expect(calcularVariacao(100, 100)).toBe(0);
    expect(calcularVariacao(100, 80)).toBe(-20);
  });

  it("devolve null quando falta um dos lados ou o anterior é zero", () => {
    expect(calcularVariacao(null, 370)).toBeNull();
    expect(calcularVariacao(321, null)).toBeNull();
    expect(calcularVariacao(0, 370)).toBeNull();
  });
});

describe("historicoDoExercicio", () => {
  it("monta a linha com o rateio aprovado e a variação sobre o atual", () => {
    const l = historicoDoExercicio(
      {
        id: "e-2025",
        condoId: "c1",
        condoNome: "Urban Classic",
        ano: 2025,
        rateioAtual: 321,
        rateioAprovado: 370,
      },
      370,
      "calculo",
      "2026-11-15T00:00:00.000Z",
    );
    expect(l.rateioAprovado).toBe(370);
    expect(l.rateioAtual).toBe(321);
    expect(l.variacao).toBe(15.26);
    expect(l.fonte).toBe("calculo");
    expect(l.exercicioId).toBe("e-2025");
  });

  it("usa o sugerido quando o aprovado ainda não foi informado", () => {
    const l = historicoDoExercicio(
      { id: "e", condoId: "c1", condoNome: "X", ano: 2026, rateioAtual: 370, rateioAprovado: null },
      400,
      "importacao",
      "2026-11-15T00:00:00.000Z",
    );
    expect(l.rateioAprovado).toBe(400);
    expect(l.variacao).toBe(8.11);
  });
});

describe("rateioBaseDoAno", () => {
  const linhas = [linha(2024, 321), linha(2025, 370, 321)];

  it("usa o aprovado do ano anterior como base", () => {
    expect(rateioBaseDoAno(linhas, "c1", 2026)).toBe(370);
    expect(rateioBaseDoAno(linhas, "c1", 2025)).toBe(321);
  });

  it("devolve null quando não há ano anterior travado", () => {
    expect(rateioBaseDoAno(linhas, "c1", 2024)).toBeNull();
    expect(rateioBaseDoAno(linhas, "outro", 2026)).toBeNull();
  });
});

describe("variacaoDoAno", () => {
  const linhas = [linha(2025, 370, 321)];

  it("usa o valor travado do próprio ano quando existe", () => {
    expect(variacaoDoAno([...linhas, linha(2026, 400, 370)], "c1", 2026, 999)).toBe(8.11);
  });

  it("cai no sugerido quando o ano ainda não foi travado", () => {
    expect(variacaoDoAno(linhas, "c1", 2026, 400)).toBe(8.11);
  });

  it("devolve null sem base do ano anterior", () => {
    expect(variacaoDoAno(linhas, "c1", 2025, 400)).toBeNull();
  });
});

describe("aplicarRateioBase", () => {
  const linhas = [linha(2025, 370, 321)];

  it("preenche o rateio atual vazio com o aprovado do ano anterior", () => {
    const e = { condoId: "c1", ano: 2026, rateioAtual: null };
    expect(aplicarRateioBase(e, linhas).rateioAtual).toBe(370);
  });

  it("não sobrescreve um rateio atual já informado", () => {
    const e = { condoId: "c1", ano: 2026, rateioAtual: 500 };
    expect(aplicarRateioBase(e, linhas).rateioAtual).toBe(500);
  });
});

describe("historicoOrdenado e historicoDoAno", () => {
  const linhas = [linha(2026, 400, 370), linha(2024, 321), linha(2025, 370, 321)];

  it("ordena do mais antigo para o mais recente", () => {
    expect(historicoOrdenado(linhas, "c1").map((l) => l.ano)).toEqual([2024, 2025, 2026]);
  });

  it("acha a linha do ano pedido", () => {
    expect(historicoDoAno(linhas, "c1", 2025)?.rateioAprovado).toBe(370);
    expect(historicoDoAno(linhas, "c1", 2030)).toBeNull();
  });
});
