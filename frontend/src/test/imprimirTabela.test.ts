import { afterEach, describe, expect, it, vi } from "vitest";
import { htmlTabelaImpressao, imprimirTabela } from "@/lib/imprimirTabela";

const tabela = {
  titulo: "Condomínio <teste> & Filhos",
  subtitulo: "01/01/2025 a 31/12/2025",
  cabecalhos: ["Conta", "Realizado"],
  linhas: [['<img src=x onerror="alert(1)">', "R$ 100,00"]],
  totais: ["Total", "R$ 100,00"],
};

afterEach(() => vi.restoreAllMocks());

describe("#229 impressão em janela própria", () => {
  it("mantém dados de cadastro como texto e inclui corpo, período e totais", () => {
    const html = htmlTabelaImpressao(tabela);
    expect(html).toContain("Condomínio &lt;teste&gt; &amp; Filhos");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(tabela.subtitulo);
    expect(html).toContain("<tfoot><tr><th>Total</th><th>R$ 100,00</th></tr></tfoot>");
    expect(html).not.toContain("<nav");
  });

  it("identifica popup bloqueado para a tela exibir recuperação", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(imprimirTabela(tabela)).toBe(false);
  });

  it("isola a origem, escreve o relatório e só imprime após o carregamento", () => {
    const eventos: string[] = [];
    let aoCarregar: (() => void) | undefined;
    const janela = {
      set opener(valor: unknown) {
        expect(valor).toBeNull();
        eventos.push("isolou");
      },
      document: {
        open: () => eventos.push("abriu documento"),
        write: (html: string) => {
          expect(html).toContain("&lt;teste&gt;");
          eventos.push("escreveu");
        },
        close: () => eventos.push("fechou documento"),
      },
      addEventListener: (_: string, fn: () => void) => {
        eventos.push("registrou");
        aoCarregar = fn;
      },
      focus: () => eventos.push("focou"),
      print: () => eventos.push("imprimiu"),
      close: vi.fn(),
    };
    const abrir = vi.spyOn(window, "open").mockReturnValue(janela as unknown as Window);
    expect(imprimirTabela(tabela)).toBe(true);
    // O listener de load so sobrevive se for registrado depois de document.open().
    expect(eventos.indexOf("registrou")).toBeGreaterThan(eventos.indexOf("abriu documento"));
    expect(eventos).toEqual([
      "isolou",
      "abriu documento",
      "registrou",
      "escreveu",
      "fechou documento",
    ]);
    expect(abrir.mock.calls[0]?.[2]).not.toContain("noopener");
    aoCarregar?.();
    expect(eventos.slice(-2)).toEqual(["focou", "imprimiu"]);
  });
});
