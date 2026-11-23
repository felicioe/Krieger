import { describe, expect, it, vi } from "vitest";
import { definirUsuario, garantirSessaoRecente, limparSessao } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Usuario } from "@/domain/types";

describe("correções da auditoria Impeccable 5 dimensões (22/11/2026)", () => {
  it("reutiliza a sessão em memória dentro do TTL sem disparar nova chamada HTTP (#386)", async () => {
    const euSpy = vi.spyOn(api.auth, "eu");
    const usuarioTeste: Usuario = {
      id: "u-ttl",
      login: "teste",
      nome: "Teste TTL",
      perfil: "admin",
      trocarSenha: false,
      permissoes: ["*"],
    };
    try {
      definirUsuario(usuarioTeste);
      const retornado = await garantirSessaoRecente(60_000);
      expect(retornado?.id).toBe("u-ttl");
      expect(euSpy).not.toHaveBeenCalled();
    } finally {
      limparSessao();
      euSpy.mockRestore();
    }
  });
});
