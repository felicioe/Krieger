import { describe, expect, it } from "vitest";
import { condominioPadrao } from "./condominio";
import { exercicioPadrao } from "./exercicio";
import { inicializarIndicesImportados, validarIndicesCondominio } from "./indicesCondominio";

describe("Índices exclusivos por condomínio", () => {
  const c = { ...condominioPadrao(), id: "condo-ficticio" };
  const e = { ...exercicioPadrao(c, 2026), id: "ex-ficticio" };
  e.consid.indices = [{ ano: 2024, pct: 4 }, { ano: 2025, pct: 6 }];
  it("preenche a primeira importação sem compartilhar com outro condomínio", () => {
    expect(inicializarIndicesImportados(c, e).indices).toEqual(e.consid.indices.map((i) => ({ ...i, noRelatorio: true })));
    expect(inicializarIndicesImportados({ ...c, id: "outro" }, e).indices).toEqual([]);
  });
  it("mantém a inclusão manual e não ressuscita índices excluídos", () => {
    const manual = { ...c, indices: [{ ano: 2025, pct: 8 }], indicesInicializados: true };
    expect(inicializarIndicesImportados(manual, e)).toBe(manual);
    expect(inicializarIndicesImportados({ ...manual, indices: [] }, e).indices).toEqual([]);
  });
  it("preserva o cadastro legado e valida duplicações e campos vazios", () => {
    expect(inicializarIndicesImportados({ ...c, indices: [{ ano: 2023, pct: 9 }] }, e).indices[0]?.pct).toBe(9);
    expect(() => validarIndicesCondominio([{ ano: 2025, pct: 3 }, { ano: 2025, pct: 4 }])).toThrow(/mesmo ano/);
    expect(() => validarIndicesCondominio([{ ano: 2025, pct: null }])).toThrow(/válidos/);
  });
  it("aceita zero e percentual negativo, preservando visibilidade", () => {
    expect(validarIndicesCondominio([{ ano: 2025, pct: 0, noRelatorio: false }, { ano: 2024, pct: -2 }])).toEqual([
      { ano: 2024, pct: -2, noRelatorio: true }, { ano: 2025, pct: 0, noRelatorio: false },
    ]);
  });
});
