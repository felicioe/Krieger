import { describe, expect, it } from "vitest";
import {
  cidadeDoCondominio,
  documentosObrigatoriosPadrao,
  filtrarDocumentosPorCidade,
} from "./condominio";

describe("documentosObrigatoriosPadrao", () => {
  it("sem cidade (cadastro), traz os 7 itens do checklist, todos pendentes e sem observação", () => {
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
    expect(
      itens.every((i) => i.status === "pendente" && i.noRelatorio === true),
    ).toBe(true);
    expect(itens.every((i) => i.observacao === "")).toBe(true);
  });

  it("em Balneário Camboriú mantém o Alvará Estrutural", () => {
    const itens = documentosObrigatoriosPadrao("Balneário Camboriú");
    expect(itens).toHaveLength(7);
    expect(itens.map((i) => i.nome)).toContain("Alvará Estrutural");
  });

  it('"Camboriú" e outras cidades não recebem o Alvará Estrutural', () => {
    expect(
      documentosObrigatoriosPadrao("Camboriú").map((i) => i.nome),
    ).not.toContain("Alvará Estrutural");
    expect(
      documentosObrigatoriosPadrao("Itajaí").map((i) => i.nome),
    ).not.toContain("Alvará Estrutural");
  });
});

describe("cidadeDoCondominio", () => {
  it("extrai a cidade do endereço do edital", () => {
    expect(
      cidadeDoCondominio({
        enderecoEdital: "Avenida Atlântica, 2070, Balneário Camboriú - SC",
      }),
    ).toBe("Balneário Camboriú");
    expect(cidadeDoCondominio({ enderecoEdital: "" })).toBe("");
    expect(cidadeDoCondominio(null)).toBe("");
  });
});

describe("filtrarDocumentosPorCidade", () => {
  const comAlvara = [
    { nome: "Extintor" },
    { nome: "Alvará Estrutural" },
    { nome: "Alvará de Bombeiros" },
  ];

  it("mantém o Alvará Estrutural em Balneário Camboriú", () => {
    expect(filtrarDocumentosPorCidade(comAlvara, "Balneário Camboriú")).toEqual(
      comAlvara,
    );
  });

  it("remove o Alvará Estrutural (mesmo gravado) nas outras cidades", () => {
    expect(
      filtrarDocumentosPorCidade(comAlvara, "Camboriú").map((d) => d.nome),
    ).toEqual(["Extintor", "Alvará de Bombeiros"]);
  });
});
