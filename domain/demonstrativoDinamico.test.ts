import { describe, expect, it } from "vitest";
import { demonstrativoDoPeriodo } from "./demonstrativoDinamico";
import { demonstrativoVazio, recalcularDemonstrativo } from "./demonstrativo";
import type { Mensal } from "./types";

function mensal(id: string, fim: string, receitas: number, despesas: number, condoId = "c1"): Mensal {
  const d = recalcularDemonstrativo({
    ...demonstrativoVazio("Urban"),
    periodo: { ini: `01/${fim.slice(3)}`, fim },
    receitas: { itens: [{ nome: "Taxa", valor: receitas }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Pessoal", itens: [{ nome: "Limpeza", valor: despesas }] }], subtotal: 0, saldoRestante: 0 },
  });
  return { id, condoId, condoNome: "Urban", demonstrativo: d, origem: [], receber: { unidades: null, valor: null }, notas: [] };
}

describe("demonstrativoDoPeriodo", () => {
  it("soma receitas e despesas dos meses do período", () => {
    const base = { ...demonstrativoVazio("Urban"), periodo: { ini: "01/11/2025", fim: "31/10/2026" } };
    const r = demonstrativoDoPeriodo(base, [mensal("m1", "30/11/2025", 100, 40), mensal("m2", "31/12/2025", 200, 60)], "c1");
    expect(r.receitas.itens).toEqual([{ nome: "Taxa", valor: 300 }]);
    expect(r.despesas.grupos[0]?.itens).toEqual([{ nome: "Limpeza", valor: 100 }]);
  });

  it("ignora meses fora do período e de outro condomínio", () => {
    const base = { ...demonstrativoVazio("Urban"), periodo: { ini: "01/11/2025", fim: "31/12/2025" } };
    const r = demonstrativoDoPeriodo(base, [mensal("fora", "31/10/2025", 999, 999), mensal("outro", "30/11/2025", 500, 500, "c2")], "c1");
    expect(r.receitas.itens).toEqual([]);
  });
});
