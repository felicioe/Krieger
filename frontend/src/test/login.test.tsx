import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Usuario } from "@/domain/types";

// Só simulações: nenhuma credencial real nem chamada ao servidor.
const entrar = vi.fn<(login: string, senha: string) => Promise<Usuario>>();
vi.mock("@/lib/api", async (original) => {
  const real = await original<typeof import("@/lib/api")>();
  return {
    ...real,
    api: {
      ...real.api,
      auth: { ...real.api.auth, entrar: (l: string, s: string) => entrar(l, s) },
    },
  };
});

const { FormEntrar } = await import("@/components/login/FormEntrar");

const usuarioFicticio = { id: "u-teste", login: "teste", nome: "Teste" } as unknown as Usuario;

function montar() {
  const aoEntrar = vi.fn();
  const user = userEvent.setup();
  render(<FormEntrar aoEntrar={aoEntrar} />);
  return {
    aoEntrar,
    user,
    usuario: screen.getByLabelText(/Usuário/),
    senha: screen.getByLabelText(/^Senha/),
    botaoEntrar: screen.getByRole("button", { name: "Entrar" }),
  };
}

beforeEach(() => {
  entrar.mockReset();
});

describe("login: campo de senha com Mostrar/Ocultar", () => {
  it("começa oculta e mantém o preenchimento automático", () => {
    const { usuario, senha } = montar();
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveAttribute("autocomplete", "current-password");
    expect(usuario).toHaveAttribute("autocomplete", "username");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveAttribute("type", "button");
  });

  it("mostra e oculta sem apagar o valor, sem tirar o foco do campo e sem enviar", async () => {
    const { user, senha, aoEntrar } = montar();
    await user.type(senha, "segredo");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");
    expect(senha).toHaveValue("segredo");
    expect(senha).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveValue("segredo");
    expect(entrar).not.toHaveBeenCalled();
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  it("pelo teclado (Enter e Espaço no botão) alterna sem enviar o formulário", async () => {
    const { user, usuario, senha } = montar();
    await user.type(usuario, "maria");
    await user.type(senha, "segredo");
    await user.tab();
    const botao = screen.getByRole("button", { name: "Mostrar senha" });
    expect(botao).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(senha).toHaveAttribute("type", "text");
    await user.keyboard(" ");
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveValue("segredo");
    expect(entrar).not.toHaveBeenCalled();
  });
});

describe("login: obrigatoriedade e erros", () => {
  it("usuário e senha são obrigatórios para a tecnologia assistiva", () => {
    const { usuario, senha } = montar();
    expect(usuario).toHaveAttribute("aria-required", "true");
    expect(senha).toHaveAttribute("aria-required", "true");
  });

  it("enviar vazio não chama o servidor, marca o usuário e leva o foco a ele", async () => {
    const { user, usuario, senha, botaoEntrar } = montar();
    await user.click(botaoEntrar);
    expect(entrar).not.toHaveBeenCalled();
    expect(usuario).toHaveAttribute("aria-invalid", "true");
    expect(usuario).toHaveAccessibleDescription("Informe o usuário.");
    expect(senha).toHaveAttribute("aria-invalid", "true");
    expect(usuario).toHaveFocus();
  });

  it("só a senha vazia: marca a senha e leva o foco a ela", async () => {
    const { user, usuario, senha, botaoEntrar } = montar();
    await user.type(usuario, "maria");
    await user.click(botaoEntrar);
    expect(entrar).not.toHaveBeenCalled();
    expect(usuario).not.toHaveAttribute("aria-invalid");
    expect(senha).toHaveAccessibleDescription("Informe a senha.");
    expect(senha).toHaveFocus();
  });

  it("enquanto envia, o botão fica desabilitado e um segundo Enter não envia de novo", async () => {
    let concluir!: (u: Usuario) => void;
    entrar.mockImplementation(() => new Promise((ok) => (concluir = ok)));
    const { user, usuario, senha, aoEntrar } = montar();
    await user.type(usuario, "  Maria ");
    await user.type(senha, "segredo{Enter}");
    const ocupado = screen.getByRole("button", { name: "Entrando…" });
    expect(ocupado).toBeDisabled();
    await user.type(senha, "{Enter}");
    expect(entrar).toHaveBeenCalledTimes(1);
    expect(entrar).toHaveBeenCalledWith("maria", "segredo");
    concluir(usuarioFicticio);
    await waitFor(() => expect(aoEntrar).toHaveBeenCalledWith(usuarioFicticio));
  });

  it("falha: alerta com a mensagem, senha apagada, usuário mantido e foco na senha", async () => {
    entrar.mockRejectedValue(new Error("Usuário ou senha inválidos."));
    const { user, usuario, senha, aoEntrar } = montar();
    await user.type(usuario, "maria");
    await user.type(senha, "errada{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário ou senha inválidos.");
    expect(senha).toHaveValue("");
    expect(usuario).toHaveValue("maria");
    await waitFor(() => expect(senha).toHaveFocus());
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(aoEntrar).not.toHaveBeenCalled();
  });
});
