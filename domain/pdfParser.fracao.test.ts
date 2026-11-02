import { describe, expect, it } from "vitest";
import { lerListagemFracao } from "./pdfParser";

describe("listagem de unidades e fração", () => {
  it("lê condomínio, unidades e fração prevista", () => {
    const r = lerListagemFracao(`Condomínio: (166) CONDOMÍNIO URBAN CLASSIC\n00101 PABLO LANGE ROLIM                 1,533500 0,000000 1,533500 1,533500\n00102 GIOVANI BIDINOTTO                 1,567000 0,000000 1,567000 1,567000\nTotal Unidades 62 Área Total Edifício: 99,999400`);
    expect(r.condominio).toContain("CONDOMÍNIO URBAN CLASSIC");
    expect(r.unidades).toHaveLength(2);
    expect(r.unidades[0]).toMatchObject({ unidade: "00101", fracaoTotal: 1.5335, fracaoPrevista: 1.5335 });
    expect(r.total).toBe(99.9994);
  });
});
