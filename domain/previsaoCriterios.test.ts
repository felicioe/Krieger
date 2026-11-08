import { describe, expect, it } from "vitest";
import { criteriosDaPrevisao, rotuloArredondamento, rotuloModo, rotuloVariacao } from "./previsaoCriterios";

const base = {
  modo: "tradicional" as const,
  variacaoMetodo: "percentual" as const,
  variacaoPct: 8.5,
  variacaoValor: 9180,
  indicesUsados: [],
  arredondamento: "truncar" as const,
};

const valor = (linhas: { rotulo: string; valor: string }[], rotulo: string) =>
  linhas.find((l) => l.rotulo === rotulo)?.valor;

describe("critérios da previsão no relatório", () => {
  it("usa as mesmas palavras dos menus de manutenção", () => {
    expect(rotuloModo("tradicional")).toBe("Tradicional (por grupo)");
    expect(rotuloVariacao("mediaIndices")).toBe("Média dos índices");
    expect(rotuloArredondamento("truncar")).toBe("Truncar (sem centavos, para baixo)");
  });

  it("percentual fixo: mostra modo, método, variação e arredondamento", () => {
    const linhas = criteriosDaPrevisao(base);
    expect(linhas.map((l) => l.rotulo)).toEqual([
      "Modo da previsão",
      "Método da variação",
      "Variação aplicada",
      "Arredondamento do valor por unidade",
    ]);
    expect(valor(linhas, "Método da variação")).toBe("Percentual fixo");
    expect(valor(linhas, "Variação aplicada")).toBe("8,50% sobre a base líquida");
    expect(valor(linhas, "Arredondamento do valor por unidade")).toBe("Truncar (sem centavos, para baixo)");
  });

  it("média de índices: lista os índices usados, mais recentes primeiro", () => {
    const linhas = criteriosDaPrevisao({
      ...base,
      variacaoMetodo: "mediaIndices",
      variacaoPct: 5.5,
      indicesUsados: [
        { ano: 2025, pct: 5 },
        { ano: 2024, pct: 6 },
      ],
    });
    expect(valor(linhas, "Índices usados na média")).toBe("2025: 5,00% · 2024: 6,00%");
    expect(valor(linhas, "Variação aplicada")).toBe("5,50% sobre a base líquida");
  });

  it("média de índices sem nenhum índice informado: avisa em vez de mostrar vazio", () => {
    const linhas = criteriosDaPrevisao({ ...base, variacaoMetodo: "mediaIndices", variacaoPct: 0, indicesUsados: [] });
    expect(valor(linhas, "Índices usados na média")).toBe("nenhum índice informado");
  });

  it("método valor: a variação aparece em reais, não em percentual", () => {
    const linhas = criteriosDaPrevisao({ ...base, variacaoMetodo: "valor", variacaoPct: 0, variacaoValor: 14000 });
    expect(valor(linhas, "Variação aplicada")).toBe("R$ 14.000,00");
    expect(linhas.map((l) => l.rotulo)).not.toContain("Índices usados na média");
  });

  it("modo detalhado aparece como 'Detalhado (por despesa)'", () => {
    const linhas = criteriosDaPrevisao({ ...base, modo: "detalhado" });
    expect(valor(linhas, "Modo da previsão")).toBe("Detalhado (por despesa)");
  });
});
