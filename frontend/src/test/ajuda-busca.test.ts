import { describe, expect, it } from "vitest";
import { ALIASES, ARTIGOS, CATEGORIAS, buscarArtigos } from "@/lib/ajuda-conteudo";

describe("Central de Ajuda", () => {
  it("busca ignora acento e caixa e exige todos os termos", () => {
    expect(buscarArtigos("PREVISAO reajuste").map((a) => a.id)).toContain("previsao-orcamentaria");
    expect(buscarArtigos("inadimplência").map((a) => a.id)).toContain("inadimplencia");
    expect(buscarArtigos("xyzinexistente")).toHaveLength(0);
  });

  it("mantém os ids usados pelos links ?secao= de outras telas e os aliases antigos", () => {
    const ids = new Set(ARTIGOS.map((a) => a.id));
    for (const id of ["importador", "prestacao-contas", "previsao-orcamentaria"])
      expect(ids).toContain(id);
    for (const destino of Object.values(ALIASES)) expect(ids).toContain(destino);
    expect(ids.size).toBe(ARTIGOS.length);
  });

  it("todo artigo pertence a uma categoria existente", () => {
    const cats = new Set(CATEGORIAS.map((c) => c.id));
    for (const a of ARTIGOS) expect(cats.has(a.categoria)).toBe(true);
  });
});
