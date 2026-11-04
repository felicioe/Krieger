import { describe, expect, it } from "vitest";
import { condominioPadrao } from "./condominio";
import { exercicioPadrao } from "./exercicio";

describe("previsão por exercício", () => {
  it("começa sempre com percentual fixo próprio do exercício", () => {
    const condo = { id: "c1", ...condominioPadrao(), variacaoPadrao: 8.93, variacaoMetodo: "mediaIndices" as const, variacaoParam: 2 };
    const exercicio = exercicioPadrao(condo, 2026);
    expect(exercicio.variacaoMetodo).toBe("percentual");
    expect(exercicio.variacaoParam).toBe(0);
    expect(exercicio.variacao).toBe(0);
  });
});
