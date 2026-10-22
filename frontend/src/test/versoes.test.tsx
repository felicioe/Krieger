import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import dados from "@/data/versoes.json";
import { RodapeLogin } from "@/components/login/RodapeLogin";

// Regras que continuam valendo quando entrarem versões novas (1.01, 1.02…): nada aqui
// fixa o histórico em "só 1.0".
describe("versões (src/data/versoes.json)", () => {
  it("a versão atual é texto no formato maior.menor, não um número", () => {
    expect(typeof dados.versaoAtual).toBe("string");
    expect(dados.versaoAtual).toMatch(/^\d+\.\d+$/);
  });

  it("todas as versões do histórico são texto, no mesmo formato e sem repetição", () => {
    const versoes = dados.versoes.map((v) => v.versao);
    for (const v of versoes) {
      expect(typeof v).toBe("string");
      expect(v).toMatch(/^\d+\.\d+$/);
    }
    expect(new Set(versoes).size).toBe(versoes.length);
  });

  it("a versão atual existe no histórico", () => {
    expect(dados.versoes.map((v) => v.versao)).toContain(dados.versaoAtual);
  });

  it("toda versão tem título e ao menos uma alteração descrita", () => {
    for (const v of dados.versoes) {
      expect(v.titulo.trim()).not.toBe("");
      expect(v.alteracoes.length).toBeGreaterThan(0);
      for (const a of v.alteracoes) expect(a.trim()).not.toBe("");
    }
  });

  it("a 1.0 continua registrada como a implantação do sistema", () => {
    expect(dados.versoes.find((v) => v.versao === "1.0")).toEqual({
        versao: "1.0",
        titulo: "Implantação do sistema",
        alteracoes: ["Implantação inicial do Sistema Krieger."],
    });
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
