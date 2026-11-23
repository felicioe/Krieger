import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DistribuicaoFracao } from "@/components/previsao/DistribuicaoFracao";
import type { ResultadoPrevisao } from "@/domain/previsao";

const resultado = {
  totalAnual: 12000,
  mesesAnalisados: 12,
  fundoReservaPct: 10,
} as ResultadoPrevisao;
const fracao = (unidade: string, fracaoPrevista: number) => ({
  unidade,
  fracaoUnidade: 0,
  fracaoBox: 0,
  fracaoTotal: 0,
  fracaoPrevista,
});

describe("rateio por fração ideal na previsão (#132)", () => {
  it("sem frações, informa que a base é a quantidade de unidades", () => {
    render(
      <DistribuicaoFracao
        resultado={resultado}
        condominio={{ unidades: 10, fracaoUnidades: [] }}
        arredondamento="centavos"
      />,
    );
    expect(screen.getByText(/quantidade de unidades/)).toBeInTheDocument();
  });

  it("com frações, mostra o total e as cotas de cada unidade", async () => {
    render(
      <DistribuicaoFracao
        resultado={resultado}
        condominio={{ unidades: 2, fracaoUnidades: [fracao("101", 0.4), fracao("102", 0.6)] }}
        arredondamento="centavos"
      />,
    );
    expect(screen.getByText("Rateio por fração ideal")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Ver cotas por unidade" }));
    expect(screen.getByRole("cell", { name: "101" })).toBeInTheDocument();
    expect(screen.getAllByText("R$ 1.100,00").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 440,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 660,00")).toBeInTheDocument();
  });
});
