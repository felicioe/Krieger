import { describe, expect, it } from "vitest";
import { divergenciasCnpj, enderecoDaReceita, type DadosCnpjReceita } from "@/lib/receitaCnpj";

const base: DadosCnpjReceita = {
  razaoSocial: "CONDOMINIO URBAN CLASSIC",
  situacaoCadastral: "ATIVA",
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
      enderecoDaReceita({
        razaoSocial: null,
        situacaoCadastral: null,
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        municipio: "",
        uf: "",
        cep: "",
      }),
    ).toBe("");
  });
});

describe("divergenciasCnpj", () => {
  it("sem divergência quando o nome bate (ignorando acento/caixa) e a situação é ativa", () => {
    expect(divergenciasCnpj(base, "Condomínio Urban Classic")).toEqual([]);
  });

  it("tolera nome cadastrado mais curto/longo que a razão social (um contém o outro)", () => {
    expect(divergenciasCnpj(base, "Urban Classic")).toEqual([]);
    expect(divergenciasCnpj({ ...base, razaoSocial: "URBAN CLASSIC" }, "Condomínio Urban Classic")).toEqual([]);
  });

  it("avisa quando a razão social diverge de verdade", () => {
    const avisos = divergenciasCnpj(base, "Edifício Jardim das Acácias");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("CONDOMINIO URBAN CLASSIC");
  });

  it("avisa quando a situação cadastral não é ativa", () => {
    const avisos = divergenciasCnpj({ ...base, situacaoCadastral: "BAIXADA" }, "Condomínio Urban Classic");
    expect(avisos).toEqual(["situação cadastral na Receita: BAIXADA"]);
  });

  it("pode acumular os dois avisos ao mesmo tempo", () => {
    const avisos = divergenciasCnpj({ ...base, situacaoCadastral: "SUSPENSA" }, "Outro Nome Qualquer");
    expect(avisos).toHaveLength(2);
  });
});
