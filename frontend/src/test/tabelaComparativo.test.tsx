import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TabelaComparativo } from "@/components/previsto-realizado/TabelaComparativo";
import { tabelaComparativo } from "@/documentos/relatorioFinal";
import type { GrupoComparativo, ResultadoComparativo, Totais } from "@/domain/previstoRealizado";

function totais(previsto: number, realizado: number): Totais {
  const diferenca = realizado - previsto;
  return { previstoAnual: previsto, previstoMensal: previsto / 12, previsto, realizado, diferenca, pct: 0, situacao: "dentro" };
}

function comparativoFixture(): ResultadoComparativo {
  const grupo: GrupoComparativo = {
    nome: "Pessoal",
    linhas: [
      { grupo: "Pessoal", nome: "Salários", tipo: "rubrica", ...totais(10000, 9500) },
      { grupo: "Pessoal", nome: "Encargos sociais", tipo: "rubrica", ...totais(4000, 3800) },
    ],
    totais: totais(14000, 13300),
  };
  return {
    meses: [{ posicao: 1, mes: 1, ano: 2025, rotulo: "01/2025", relatorios: 1 }],
    mesAte: { posicao: 1, mes: 1, ano: 2025, rotulo: "01/2025", relatorios: 1 },
    grupos: [grupo],
    deduzidas: [],
    total: totais(14000, 13300),
    tolerancia: 5,
    relatoriosUsados: 1,
    avisos: [],
  };
}

describe("TabelaComparativo (tela)", () => {
  it("mostra as linhas por rubrica por padrão", () => {
    render(<TabelaComparativo r={comparativoFixture()} />);
    expect(screen.getByText("Salários")).toBeInTheDocument();
    expect(screen.getByText("Encargos sociais")).toBeInTheDocument();
    expect(screen.getByText("Total Pessoal")).toBeInTheDocument();
    expect(screen.getByText("Total geral")).toBeInTheDocument();
  });

  it("mostrarAnaliticas=false esconde as rubricas, mantendo os totais", () => {
    render(<TabelaComparativo r={comparativoFixture()} mostrarAnaliticas={false} />);
    expect(screen.queryByText("Salários")).not.toBeInTheDocument();
    expect(screen.queryByText("Encargos sociais")).not.toBeInTheDocument();
    expect(screen.getByText("Total Pessoal")).toBeInTheDocument();
    expect(screen.getByText("Total geral")).toBeInTheDocument();
  });
});

describe("tabelaComparativo (PDF/Word)", () => {
  it("inclui as linhas por rubrica por padrão", () => {
    const [bloco] = tabelaComparativo(comparativoFixture());
    const linhas = bloco?.tipo === "tabela" ? bloco.linhas : [];
    const nomes = linhas.map((l) => JSON.stringify(l.celulas[0]));
    expect(nomes.some((n) => n.includes("Salários"))).toBe(true);
    expect(nomes.some((n) => n.includes("Total Pessoal"))).toBe(true);
  });

  it("mostrarAnaliticas=false esconde as rubricas, mantendo grupo e totais", () => {
    const [bloco] = tabelaComparativo(comparativoFixture(), false);
    const linhas = bloco?.tipo === "tabela" ? bloco.linhas : [];
    const nomes = linhas.map((l) => JSON.stringify(l.celulas[0]));
    expect(nomes.some((n) => n.includes("Salários"))).toBe(false);
    expect(nomes.some((n) => n.includes("Encargos sociais"))).toBe(false);
    expect(nomes.some((n) => n.includes("Pessoal"))).toBe(true); // cabeçalho do grupo
    expect(nomes.some((n) => n.includes("Total Pessoal"))).toBe(true);
    expect(nomes.some((n) => n.includes("Total geral"))).toBe(true);
  });
});
