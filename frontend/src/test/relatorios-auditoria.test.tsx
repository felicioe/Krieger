import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import { TabelaMensal } from "@/components/previsto-realizado/TabelaMensal";
import { TabelaLinhas } from "@/components/previsao/PainelPrevisao";
import { calcularPrevisao } from "@/domain/previsao";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import type { ResultadoMensalDetalhado, CelulaMensal } from "@/domain/previstoRealizadoMensal";

vi.mock("@/components/app/LinkPermitido", () => ({
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

function celula(previsto: number, realizado: number): CelulaMensal {
  return {
    previsto,
    realizado,
    diferenca: realizado - previsto,
    horizontal: previsto ? ((realizado - previsto) / previsto) * 100 : null,
    verticalPrevisto: 100,
    verticalRealizado: realizado ? 100 : null,
  };
}
function resultado(carga: number[]): ResultadoMensalDetalhado {
  const mensal = carga.map(() => celula(100, 0));
  const total = celula(100 * carga.length, 0);
  return {
    meses: carga.map((relatorios, i) => ({ posicao: i + 1, rotulo: `0${i + 1}/2025`, relatorios })),
    linhas: [{ grupo: "Pessoal", mensal, total }],
    total,
    avisos: [],
    relatoriosUsados: carga.reduce((soma, n) => soma + n, 0),
  };
}

describe("#229 cobertura do relatório mensal", () => {
  it("sem nenhuma carga mostra o próximo passo, sem tabela ou variação artificial", () => {
    render(<TabelaMensal resultado={resultado([0, 0])} orcado horizontal vertical={false} />);
    expect(screen.getByRole("heading", { name: "Sem realizado no período" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ir ao Importador" })).toHaveAttribute(
      "href",
      "/importador",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/100,00%/)).not.toBeInTheDocument();
  });

  it("distingue mês ausente de mês com relatório e despesa efetivamente zerada", () => {
    render(<TabelaMensal resultado={resultado([1, 0])} orcado horizontal vertical={false} />);
    const linha = screen.getByRole("rowheader", { name: "Pessoal" }).closest("tr")!;
    expect(within(linha).getAllByText("-100,00%")).toHaveLength(1);
    expect(within(linha).getByText("Sem dados")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("O realizado acumulado é parcial");
    expect(screen.getByRole("table")).toHaveAccessibleName(/realizado parcial/);
  });

  it("com a carga completa preserva a divergência real de menos cem por cento", () => {
    render(<TabelaMensal resultado={resultado([1, 1])} orcado horizontal vertical={false} />);
    const linha = screen.getByRole("rowheader", { name: "Pessoal" }).closest("tr")!;
    expect(within(linha).getAllByText("-100,00%")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("2 relatórios mensais considerados.", { exact: false })).toBeVisible();
  });
});

describe("#229 reconciliação da previsão", () => {
  it("totaliza a média dos grupos após deduções sem apresentá-la como anual ajustado", () => {
    const demonstrativo = {
      ...demonstrativoVazio("Demonstração"),
      periodo: { ini: "01/01/2025", fim: "31/12/2025" },
      despesas: {
        grupos: [
          { nome: "Pessoal", itens: [{ nome: "Salários", valor: 1200 }] },
          { nome: "Obras", itens: [{ nome: "Pintura", valor: 240 }] },
        ],
        subtotal: 1440,
        saldoRestante: 0,
      },
    };
    const r = calcularPrevisao(
      demonstrativo,
      {
        variacao: 0,
        variacaoMetodo: "percentual",
        variacaoParam: 0,
        deducaoRegex: "Pintura",
        arredondamento: "centavos",
        rateioAtual: null,
        prev: {
          modo: "tradicional",
          ajustes: [{ id: "a1", descricao: "Contrato novo", sinal: "+", valor: 120 }],
        },
      },
      10,
    );
    render(<TabelaLinhas r={r} />);
    const total = screen.getByText("Total dos grupos").closest("tr")!;
    expect(within(total).getByText("R$ 1.440,00")).toBeVisible();
    expect(within(total).getByText("R$ 100,00")).toBeVisible();
    expect(screen.queryByText("Anual ajustado")).not.toBeInTheDocument();
    expect(r.totalAnual).toBe(1320);
  });
});
