import { describe, expect, it } from "vitest";
import { mesesNoPeriodo } from "./demonstrativo";

describe("mesesNoPeriodo", () => {
  it("ano-calendário: 01/01 a 31/12 = 12 meses", () => {
    expect(mesesNoPeriodo("01/01/2025", "31/12/2025")).toBe(12);
  });

  it("período não-calendário: Novembro/25 a Outubro/26 = 12 meses (ex.: Urban)", () => {
    expect(mesesNoPeriodo("01/11/2025", "31/10/2026")).toBe(12);
  });

  it("período menor que 12 meses", () => {
    expect(mesesNoPeriodo("01/01/2025", "30/06/2025")).toBe(6);
  });

  it("período maior que 12 meses", () => {
    expect(mesesNoPeriodo("01/01/2025", "31/01/2026")).toBe(13);
  });

  it("data inválida ou vazia retorna null", () => {
    expect(mesesNoPeriodo("", "31/12/2025")).toBeNull();
    expect(mesesNoPeriodo("01/01/2025", "")).toBeNull();
    expect(mesesNoPeriodo("31/02/2025", "31/12/2025")).toBeNull();
  });
});
