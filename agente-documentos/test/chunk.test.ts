import { describe, expect, it } from "vitest";
import { chunkPorPagina } from "../src/chunk.js";

describe("chunkPorPagina", () => {
  it("agrupa páginas curtas num só trecho", () => {
    const trechos = chunkPorPagina(["Página um.", "Página dois.", "Página três."]);
    expect(trechos).toHaveLength(1);
    expect(trechos[0]).toEqual({ paginaInicial: 1, paginaFinal: 3, texto: "Página um.\n\nPágina dois.\n\nPágina três." });
  });

  it("separa em vários trechos quando cada página sozinha já passa do tamanho alvo", () => {
    const trechos = chunkPorPagina(["a".repeat(70), "b".repeat(70), "c".repeat(70)], 60);
    expect(trechos).toHaveLength(3);
    expect(trechos[0]).toEqual({ paginaInicial: 1, paginaFinal: 1, texto: "a".repeat(70) });
    expect(trechos[2].paginaInicial).toBe(3);
  });

  it("agrupa páginas consecutivas até atingir o tamanho alvo, só então inicia um novo trecho", () => {
    const trechos = chunkPorPagina(["a".repeat(50), "b".repeat(50), "c".repeat(50)], 60);
    expect(trechos).toHaveLength(2);
    expect(trechos[0]).toEqual({ paginaInicial: 1, paginaFinal: 2, texto: `${"a".repeat(50)}\n\n${"b".repeat(50)}` });
    expect(trechos[1]).toEqual({ paginaInicial: 3, paginaFinal: 3, texto: "c".repeat(50) });
  });

  it("ignora páginas vazias sem gerar trecho em branco e sem quebrar a numeração", () => {
    const trechos = chunkPorPagina(["Texto da página 1.", "   ", "Texto da página 3."], 1000);
    expect(trechos).toHaveLength(1);
    expect(trechos[0].paginaInicial).toBe(1);
    expect(trechos[0].paginaFinal).toBe(3);
  });

  it("devolve lista vazia quando não há nenhuma página com texto", () => {
    expect(chunkPorPagina(["", "   ", ""])).toEqual([]);
  });
});
