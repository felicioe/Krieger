import { describe, expect, it } from "vitest";
import { ITENS_MENU } from "@/components/app/AppSidebar";
import { podeAcessarRota, rotasPermissoes } from "@/lib/permissoes";
import { temPermissao } from "@/lib/auth";
import type { Usuario } from "@/domain/types";

const base: Usuario = {
  id: "u1",
  login: "teste",
  nome: "Teste",
  perfil: "user",
  trocarSenha: false,
  permissoes: [],
} as Usuario;

const com = (permissoes: string[], perfil: Usuario["perfil"] = "user"): Usuario => ({
  ...base,
  perfil,
  permissoes,
});

// Cada item do menu precisa de uma permissão que a matriz conhece e que abre exatamente a tela dele.
describe("menu x permissões", () => {
  const itens = ITENS_MENU.filter((i) => i.permissao && !i.apenasAdmin);

  it("há itens com permissão para verificar", () => {
    expect(itens.length).toBeGreaterThan(10);
  });

  it.each(itens.map((i) => [i.titulo, i.to, i.permissao] as const))(
    "%s (%s) abre só com %s",
    (_titulo, to, permissao) => {
      const modulo = permissao!.split(".")[0];
      expect(rotasPermissoes.some(([, m]) => m === modulo)).toBe(true);
      expect(podeAcessarRota(com([permissao!]), to)).toBe(true);
      expect(podeAcessarRota(com([]), to)).toBe(false);
    },
  );
});

describe("aba Configuração do cadastro", () => {
  it("depende da permissão condominios.configurar, não do perfil", () => {
    expect(temPermissao(com([], "adm"), "condominios.configurar")).toBe(false);
    expect(temPermissao(com(["condominios.configurar"], "adm"), "condominios.configurar")).toBe(
      true,
    );
    expect(temPermissao(com([], "user"), "condominios.configurar")).toBe(false);
    expect(temPermissao(com([], "admin"), "condominios.configurar")).toBe(true);
  });
});
