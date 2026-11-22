import { describe, expect, it } from "vitest";
import { montarDefinicao } from "@/lib/documento/pdf";
import type { Documento } from "@/lib/documento/tipos";

const doc: Documento = {
  titulo: "Teste",
  blocos: [
    {
      tipo: "linhaGuiada",
      itens: [
        { rotulo: "Sugestão de rateio mensal ordinário", valor: "R$ 49.244,00", forte: true },
        { rotulo: "Índice sugerido para correção do condomínio", valor: "8,93%" },
      ],
    },
  ],
} as Documento;

describe("linhaGuiada no PDF", () => {
  it("monta a definição com o pontilhado e o valor alinhado à direita", async () => {
    const def = await montarDefinicao(doc);
    const json = JSON.stringify(def);
    expect(json).toContain("Sugestão de rateio mensal ordinário");
    expect(json).toContain("R$ 49.244,00");
    expect(json).toContain('"alignment":"right"');
    // O pontilhado condutor entra no texto do rótulo.
    expect(json).toMatch(/Sugestão de rateio mensal ordinário \.{3,}/);
  });
});
