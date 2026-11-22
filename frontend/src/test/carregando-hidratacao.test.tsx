import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { CarregandoAposMontar } from "@/components/app/Carregando";

describe("aviso de carregamento na hidratação (#353)", () => {
  it("não renderiza no HTML do servidor, igual ao pré-renderizado", () => {
    expect(renderToStaticMarkup(<CarregandoAposMontar />)).toBe("");
  });

  it("mostra o aviso depois da montagem no cliente, com o texto acessível", () => {
    render(<CarregandoAposMontar />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  });
});
