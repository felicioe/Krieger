import { describe, expect, it } from "vitest";
import { documentosObrigatoriosPadrao } from "./condominio";

describe("documentosObrigatoriosPadrao", () => {
  it("traz os 7 itens do checklist, todos pendentes e marcados pro relatório", () => {
    const itens = documentosObrigatoriosPadrao();
    expect(itens).toHaveLength(7);
    expect(itens.map((i) => i.nome)).toEqual([
      "Extintor",
      "Seguro",
      "Limpeza de Caixa D'Água",
      "Dedetização",
      "Alvará de Bombeiros",
      "Alvará Estrutural",
      "Elevador — contrato de manutenção em dia",
    ]);
    expect(itens.every((i) => i.status === "pendente" && i.noRelatorio === true)).toBe(true);
  });

  it('"Alvará Estrutural" vem com observação explicando a origem municipal; os demais vêm em branco', () => {
    const itens = documentosObrigatoriosPadrao();
    const alvara = itens.find((i) => i.nome === "Alvará Estrutural")!;
    expect(alvara.observacao).toContain("Balneário Camboriú");
    expect(itens.filter((i) => i.nome !== "Alvará Estrutural").every((i) => i.observacao === "")).toBe(true);
  });
});
