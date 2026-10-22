import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

/**
 * Tabela mais larga que a tela: a área de rolagem precisa entrar no Tab para quem usa teclado
 * conseguir rolar para o lado (achado da varredura de acessibilidade em 390 px).
 */
function largura(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
}

function Tabela() {
  return (
    <>
      <button type="button">antes</button>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Conta corrente</TableCell>
            <TableCell>R$ 12.300,50</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}

describe("Tabela com rolagem lateral", () => {
  beforeEach(() => {
    class RO {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", RO);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mais larga que a área: Tab chega na área de rolagem", async () => {
    largura(600, 300);
    render(<Tabela />);
    const area = screen.getByRole("table").parentElement!;
    expect(area).toHaveAttribute("tabindex", "0");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "antes" }));
    await user.tab();
    expect(area).toHaveFocus();
  });

  it("cabe na área: não cria parada extra no Tab", () => {
    largura(300, 300);
    render(<Tabela />);
    expect(screen.getByRole("table").parentElement).not.toHaveAttribute("tabindex");
  });
});
