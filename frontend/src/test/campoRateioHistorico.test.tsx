import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampoRateioHistorico } from "@/components/app/CampoRateioHistorico";

describe("campo de rateio com o histórico como fonte (#327)", () => {
  it("com valor no histórico, é só leitura e explica a origem", () => {
    render(
      <CampoRateioHistorico
        rotulo="Rateio aprovado"
        valor={430}
        onChange={() => {}}
        doHistorico={{ valor: 450, dica: "Travado no histórico de rateios para 2025." }}
      />,
    );
    const campo = screen.getByLabelText(/Rateio aprovado/);
    expect(campo).toBeDisabled();
    expect(campo).toHaveValue("450,00");
    expect(screen.getByText(/Travado no histórico de rateios/)).toBeInTheDocument();
  });

  it("sem histórico, é editável e mostra o valor do exercício", () => {
    render(
      <CampoRateioHistorico
        rotulo="Rateio aprovado"
        valor={500}
        onChange={() => {}}
        doHistorico={null}
      />,
    );
    const campo = screen.getByLabelText(/Rateio aprovado/);
    expect(campo).not.toBeDisabled();
    expect(campo).toHaveValue("500,00");
  });
});
