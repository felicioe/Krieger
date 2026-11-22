import { describe, expect, it } from "vitest";
import { podeAcessarRota } from "@/lib/permissoes";
import type { Usuario } from "@/domain/types";

const usuario: Usuario = {
  id: "teste",
  login: "teste",
  nome: "Teste",
  perfil: "user",
  trocarSenha: false,
  permissoes: ["previsao_orcamentaria.visualizar"],
};
describe("Permissões de navegação", () => {
  it("permite somente a tela concedida e mantém acesso à conta", () => {
    expect(podeAcessarRota(usuario, "/previsao-orcamentaria?exercicio=teste")).toBe(true);
    expect(podeAcessarRota(usuario, "/prestacao-contas/teste")).toBe(false);
    expect(podeAcessarRota(usuario, "/minha-senha")).toBe(true);
  });
  it("protege rotas auxiliares e administração", () => {
    for (const rota of [
      "/relatorio-final/teste",
      "/importacoes/teste",
      "/importador-condominios",
      "/usuarios",
      "/limpeza-dados",
    ])
      expect(podeAcessarRota(usuario, rota)).toBe(false);
    expect(podeAcessarRota({ ...usuario, perfil: "admin", permissoes: [] }, "/usuarios")).toBe(
      true,
    );
  });
  it("relatórios em /relatorios seguem a permissão do módulo, mesmo digitando o endereço", () => {
    expect(podeAcessarRota(usuario, "/relatorios/orcado-realizado-mensal")).toBe(false);
    expect(podeAcessarRota(usuario, "/relatorios/inadimplencia")).toBe(false);
    const comRelatorios = {
      ...usuario,
      permissoes: ["previsto_realizado.visualizar", "relatorio_mensal.visualizar"],
    };
    expect(podeAcessarRota(comRelatorios, "/relatorios/orcado-realizado-mensal")).toBe(true);
    expect(podeAcessarRota(comRelatorios, "/relatorios/inadimplencia")).toBe(true);
  });

  it("nega navegação sem sessão", () => {
    expect(podeAcessarRota(null, "/painel")).toBe(false);
  });
});
