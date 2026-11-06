import { render, screen, within } from "@testing-library/react";
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

// Pedido #81 substituiu o acesso ao Registro de Alterações pela tela de entrada (#77/#79):
// o login mostra só autoria e versão; o registro fica no menu da área logada
// (testado em menu-conta.test.tsx).
describe("rodapé do login", () => {
  it("mostra só a autoria e a versão lida do arquivo de versões", () => {
    render(<RodapeLogin />);
    const rodape = screen.getByRole("contentinfo");
    expect(within(rodape).getByText("Feito pela Therafinancial")).toBeInTheDocument();
    expect(within(rodape).getByText(`Versão ${dados.versaoAtual}`)).toBeInTheDocument();
    expect(within(rodape).queryByRole("link")).toBeNull();
    expect(within(rodape).queryByRole("button")).toBeNull();
  });
});
