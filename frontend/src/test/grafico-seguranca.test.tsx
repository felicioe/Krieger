import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GraficoPizza } from "@/components/relatorio/GraficoPizza";

describe("segurança dos gráficos", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterAll(() => vi.unstubAllGlobals());

  it("mantém nomes cadastrados como texto, sem inseri-los no CSS bruto", () => {
    const nome = '</style><img src="x" alt="conteúdo injetado">';

    const { container } = render(<GraficoPizza dados={[{ nome, valor: 100 }]} />);

    expect(screen.getByText(nome)).toBeVisible();
    expect(screen.queryByAltText("conteúdo injetado")).not.toBeInTheDocument();
    expect(container.querySelector("style")?.textContent).not.toContain(nome);
  });
});
