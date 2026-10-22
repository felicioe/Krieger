import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import dados from "@/data/versoes.json";
import { RodapeLogin } from "@/components/login/RodapeLogin";

describe("versões (src/data/versoes.json)", () => {
  it("a versão atual é o texto 1.0, não um número", () => {
    expect(dados.versaoAtual).toBe("1.0");
    expect(typeof dados.versaoAtual).toBe("string");
  });

  it("todas as versões do histórico são texto", () => {
    for (const v of dados.versoes) expect(typeof v.versao).toBe("string");
  });

  it("a versão atual existe no histórico", () => {
    expect(dados.versoes.map((v) => v.versao)).toContain(dados.versaoAtual);
  });

  it("por ora o histórico tem só a 1.0 — Implantação do sistema", () => {
    expect(dados.versoes).toEqual([
      {
        versao: "1.0",
        titulo: "Implantação do sistema",
        alteracoes: ["Implantação inicial do Sistema Krieger."],
      },
    ]);
  });
});

function TelaLogin() {
  const [login, setLogin] = useState("");
  return (
    <>
      <label>
        Usuário
        <input value={login} onChange={(e) => setLogin(e.target.value)} />
      </label>
      <RodapeLogin />
    </>
  );
}

describe("rodapé do login", () => {
  it("mostra a autoria e a versão lida do arquivo de versões", () => {
    render(<TelaLogin />);
    const rodape = screen.getByRole("contentinfo");
    expect(within(rodape).getByText("Feito pela Therafinancial")).toBeInTheDocument();
    expect(within(rodape).getByText(`Versão ${dados.versaoAtual}`)).toBeInTheDocument();
    expect(within(rodape).queryByRole("link")).toBeNull();
  });

  it("abre o registro pelo teclado, fecha com Escape, devolve o foco e mantém o que foi digitado", async () => {
    const user = userEvent.setup();
    render(<TelaLogin />);
    await user.type(screen.getByLabelText("Usuário"), "maria");

    const botao = screen.getByRole("button", { name: "Registro de Alterações" });
    botao.focus();
    await user.keyboard("{Enter}");
    const janela = await screen.findByRole("dialog", { name: "Registro de Alterações" });
    expect(within(janela).getByText("Implantação inicial do Sistema Krieger.")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(botao).toHaveFocus();
    expect(screen.getByLabelText("Usuário")).toHaveValue("maria");
  });

  it("o botão Fechar também devolve o foco ao rodapé", async () => {
    const user = userEvent.setup();
    render(<TelaLogin />);
    const botao = screen.getByRole("button", { name: "Registro de Alterações" });
    await user.click(botao);
    const janela = await screen.findByRole("dialog");
    await user.click(within(janela).getAllByRole("button", { name: "Fechar" })[0]!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(botao).toHaveFocus();
  });
});
