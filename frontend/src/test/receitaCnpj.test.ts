import { describe, expect, it } from "vitest";
import { enderecoDaReceita, type DadosCnpjReceita } from "@/lib/receitaCnpj";

const base: DadosCnpjReceita = {
  razaoSocial: "CONDOMINIO URBAN CLASSIC",
  logradouro: "ALMIRANTE TAMANDARE",
  numero: "300",
  complemento: "",
  bairro: "CENTRO",
  municipio: "ITAJAI",
  uf: "SC",
  cep: "88301430",
};

describe("enderecoDaReceita", () => {
  it("monta o endereço completo numa linha, com CEP formatado", () => {
    expect(enderecoDaReceita(base)).toBe("ALMIRANTE TAMANDARE, 300 - CENTRO - ITAJAI/SC - CEP 88301-430");
  });

  it("inclui o complemento quando existir", () => {
    expect(enderecoDaReceita({ ...base, complemento: "SALA 2" })).toBe(
      "ALMIRANTE TAMANDARE, 300 - SALA 2 - CENTRO - ITAJAI/SC - CEP 88301-430",
    );
  });

  it("omite partes vazias sem deixar separadores soltos", () => {
    expect(enderecoDaReceita({ ...base, bairro: "", cep: "" })).toBe("ALMIRANTE TAMANDARE, 300 - ITAJAI/SC");
  });

  it("devolve string vazia quando não há nenhum dado de endereço", () => {
    expect(
      enderecoDaReceita({ razaoSocial: null, logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "", cep: "" }),
    ).toBe("");
  });
});
