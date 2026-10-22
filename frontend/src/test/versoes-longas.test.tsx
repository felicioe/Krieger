import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Histórico fictício (só neste teste): muitas versões e textos longos, para conferir que
// tudo aparece e que a janela continua fechável pelo teclado.
const historico = vi.hoisted(() => {
  const longo = "Texto de alteração muito longo ".repeat(12).trim();
  const versoes = Array.from({ length: 30 }, (_, i) => ({
    versao: `1.${String(30 - i).padStart(2, "0")}`,
    titulo: `Título comprido da versão número ${30 - i} ${"com muitas palavras ".repeat(6).trim()}`,
    alteracoes: [
      longo,
      "Segunda alteração",
      "SemEspaçosNenhumParaQuebrarALinhaDeTextoMuitoMuitoLonga",
    ],
  }));
  return { versaoAtual: "1.30", versoes };
});
vi.mock("@/data/versoes.json", () => ({ default: historico }));

const { DialogoRegistroAlteracoes } = await import("@/components/versoes/RegistroAlteracoes");

function Abridor() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir registro
      </button>
      <DialogoRegistroAlteracoes aberto={aberto} aoMudar={setAberto} />
    </>
  );
}

describe("registro de alterações com muitas versões e textos longos", () => {
  it("lista todas as versões e fecha pelo teclado com o foco de volta", async () => {
    const user = userEvent.setup();
    render(<Abridor />);

    const botao = screen.getByRole("button", { name: "Abrir registro" });
    await user.click(botao);
    const janela = await screen.findByRole("dialog", { name: "Registro de Alterações" });
    const lista = within(janela).getByRole("list", { name: "Versões do Sistema Krieger" });
    expect(within(lista).getAllByRole("heading", { level: 3 })).toHaveLength(30);
    expect(
      within(lista)
        .getByText(/\(versão atual\)/)
        .closest("h3"),
    ).toHaveTextContent(/^Versão 1\.30 —/);
    // Ao abrir, o foco vai para a lista (as setas rolam o histórico).
    expect(lista).toHaveFocus();

    expect(within(janela).getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThanOrEqual(1);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(botao).toHaveFocus();
  });
});
