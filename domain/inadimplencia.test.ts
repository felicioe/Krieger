import { describe, expect, it } from "vitest";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { evolucaoInadimplencia, mesesEntre } from "@/domain/inadimplencia";
import type { Mensal } from "@/domain/types";

function mensal(mes: number, ano: number, valor: number, unidades: number, receitas: number, condoId = "c1"): Mensal {
  const mm = String(mes).padStart(2, "0");
  const d = demonstrativoVazio("Teste");
  return {
    id: `m${ano}${mm}${condoId}`,
    condoId,
    condoNome: "Teste",
    demonstrativo: {
      ...d,
      periodo: { ini: `01/${mm}/${ano}`, fim: `28/${mm}/${ano}` },
      totais: { ...d.totais, receitas },
    },
    origem: [],
    receber: { unidades, valor },
    notas: [],
  };
}

describe("evolução da inadimplência (#251)", () => {
  const mensais = [
    mensal(1, 2025, 5000, 4, 50000),
    mensal(1, 2026, 6000, 5, 60000),
    mensal(3, 2026, 3000, 2, 60000),
    mensal(2, 2026, 9999, 9, 1, "c2"),
  ];

  it("uma linha por mês; mês sem relatório fica sem dados, nunca zero", () => {
    const r = evolucaoInadimplencia(mensais, "c1", { mes: 1, ano: 2026 }, { mes: 3, ano: 2026 });
    expect(r.linhas.map((l) => l.rotulo)).toEqual(["01/2026", "02/2026", "03/2026"]);
    const fevereiro = r.linhas[1]!;
    expect(fevereiro.relatorios).toBe(0);
    expect(fevereiro.valor).toBeNull();
    expect(fevereiro.unidades).toBeNull();
    expect(r.avisos).toEqual(["Sem relatório mensal em: 02/2026."]);
  });

  it("percentual sobre as receitas e comparação com o mesmo mês do ano anterior", () => {
    const r = evolucaoInadimplencia(mensais, "c1", { mes: 1, ano: 2026 }, { mes: 1, ano: 2026 });
    const janeiro = r.linhas[0]!;
    expect(janeiro.percentual).toBe(10);
    expect(janeiro.valorAnoAnterior).toBe(5000);
    expect(janeiro.variacaoAnoAnterior).toBe(20);
  });

  it("médias usam só os meses com dados e o último mês é o mais recente com relatório", () => {
    const r = evolucaoInadimplencia(mensais, "c1", { mes: 1, ano: 2026 }, { mes: 3, ano: 2026 });
    expect(r.mesesComDados).toBe(2);
    expect(r.media.valor).toBe(4500);
    expect(r.media.unidades).toBe(3.5);
    expect(r.media.percentual).toBe(7.5);
    expect(r.ultimo?.rotulo).toBe("03/2026");
  });

  it("período vazio (fim antes do início) não quebra", () => {
    const r = evolucaoInadimplencia(mensais, "c1", { mes: 5, ano: 2026 }, { mes: 1, ano: 2026 });
    expect(r.linhas).toEqual([]);
    expect(r.ultimo).toBeNull();
    expect(r.media).toEqual({ unidades: null, valor: null, percentual: null });
  });

  it("meses atravessam a virada do ano", () => {
    expect(mesesEntre({ mes: 11, ano: 2025 }, { mes: 2, ano: 2026 }).map((m) => `${m.mes}/${m.ano}`)).toEqual([
      "11/2025",
      "12/2025",
      "1/2026",
      "2/2026",
    ]);
  });
});
