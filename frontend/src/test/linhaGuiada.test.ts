import { describe, expect, it } from "vitest";
import { guiar, larguraAproximada } from "@/lib/documento/guias";

describe("pontilhado condutor das linhas guiadas", () => {
  it("preenche o espaço livre com pontos até a largura pedida", () => {
    const linha = guiar("Sugestão de rateio mensal ordinário", 300, 10);
    expect(linha.startsWith("Sugestão de rateio mensal ordinário ")).toBe(true);
    expect(linha).toMatch(/\.{3,}$/);
    // O texto final não passa da largura disponível.
    expect(larguraAproximada(linha, 10)).toBeLessThanOrEqual(300);
  });

  it("rótulo curto recebe mais pontos que rótulo longo na mesma largura", () => {
    const pontos = (s: string) => (s.match(/\./g) ?? []).length;
    expect(pontos(guiar("Total", 300, 10))).toBeGreaterThan(
      pontos(guiar("Total de despesas consideradas ordinárias", 300, 10)),
    );
  });

  it("sem espaço, devolve o rótulo sem pontilhado em vez de encostar no valor", () => {
    const rotulo = "Total de despesas consideradas ordinárias";
    expect(guiar(rotulo, 10, 10)).toBe(rotulo);
  });

  it("não inventa pontilhado quando sobra menos de três pontos", () => {
    const rotulo = "Total";
    const largura = larguraAproximada(rotulo, 10) + 4 + 2 * 0.3 * 10; // só 2 pontos caberiam
    expect(guiar(rotulo, largura, 10)).toBe(rotulo);
  });

  it("a largura estimada cresce com o corpo e com o texto", () => {
    expect(larguraAproximada("Total", 12)).toBeGreaterThan(larguraAproximada("Total", 10));
    expect(larguraAproximada("Total das despesas", 10)).toBeGreaterThan(
      larguraAproximada("Total", 10),
    );
  });
});
