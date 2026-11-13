import { describe, expect, it } from "vitest";
import { consolidarPeriodo } from "../frontend/src/domain/demonstrativoDinamico";
import { demonstrativoVazio, recalcularDemonstrativo } from "../frontend/src/domain/demonstrativo";
import type { Demonstrativo, Mensal } from "../frontend/src/domain/types";

function mensal(id: string, fim: string, receitas: number, despesas: number, condoId = "c1"): Mensal {
  const d = recalcularDemonstrativo({
    ...demonstrativoVazio("Urban"), periodo: { ini: `01/${fim.slice(3)}`, fim },
    receitas: { itens: [{ nome: "Taxa", valor: receitas }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Pessoal", itens: [{ nome: "Limpeza", valor: despesas }] }], subtotal: 0, saldoRestante: 0 },
  });
  return { id, condoId, condoNome: "Urban", demonstrativo: d, origem: [], receber: { unidades: null, valor: null }, notas: [] };
}

/** Exercício anual com 12 mensais, nov/2025 a out/2026. */
function serieCompleta(): Mensal[] {
  const meses = ["11/2025", "12/2025", "01/2026", "02/2026", "03/2026", "04/2026",
    "05/2026", "06/2026", "07/2026", "08/2026", "09/2026", "10/2026"];
  const ultimoDia = [30, 31, 31, 28, 31, 30, 31, 31, 30, 31, 30, 31];
  return meses.map((m, i) => mensal(`m${i}`, `${ultimoDia[i]}/${m}`, 100, 40));
}

const baseAnual = (): Demonstrativo => ({
  ...demonstrativoVazio("Urban"),
  periodo: { ini: "01/11/2025", fim: "31/10/2026" },
});

describe("consolidarPeriodo", () => {
  it("consolida quando há um relatório mensal para cada mês do período", () => {
    const r = consolidarPeriodo(baseAnual(), serieCompleta(), "c1");
    expect(r.estado).toBe("completa");
    expect(r.usados).toBe(12);
    expect(r.meses).toBe(12);
    expect(r.aviso).toBeNull();
    expect(r.demonstrativo.receitas.itens).toEqual([{ nome: "Taxa", valor: 1200 }]);
    expect(r.demonstrativo.despesas.grupos[0]?.itens).toEqual([{ nome: "Limpeza", valor: 480 }]);
  });

  it("não consolida cobertura parcial e mantém o demonstrativo salvo (caso Lago Negro 2025)", () => {
    // Exercício de 11 meses (01/01/2025 a 30/11/2025) com um único mensal de 11/2025 vindo do
    // comparativo: somar esse mês apagaria as despesas do balanço.
    const base: Demonstrativo = recalcularDemonstrativo({
      ...demonstrativoVazio("Lago Negro"),
      periodo: { ini: "01/01/2025", fim: "30/11/2025" },
      despesas: {
        grupos: [{
          nome: "Pessoal",
          itens: [
            { nome: "Salários", valor: 800000 },
            { nome: "Encargos", valor: 51955.11 },
          ],
        }],
        subtotal: 0,
        saldoRestante: 0,
      },
    });
    const r = consolidarPeriodo(base, [mensal("unico", "30/11/2025", 64160.72, 58382.02)], "c1");
    expect(r.estado).toBe("parcial");
    expect(r.usados).toBe(1);
    expect(r.meses).toBe(11);
    expect(r.demonstrativo).toBe(base); // intocado
    expect(r.aviso).toContain("Cobertura incompleta");
    expect(r.aviso).toContain("1 relatório mensal");
  });

  it("não consolida série com buraco no meio mesmo quando o número de meses bate", () => {
    const base: Demonstrativo = { ...demonstrativoVazio("Urban"), periodo: { ini: "01/11/2025", fim: "30/11/2025" } };
    const r = consolidarPeriodo(base, [mensal("a", "30/11/2025", 100, 40)], "c1");
    expect(r.estado).toBe("completa"); // 1 mensal para 1 mês
    expect(r.usados).toBe(1);
  });

  it("reporta vazio quando não há mensal do condomínio no período", () => {
    const base: Demonstrativo = { ...demonstrativoVazio("Urban"), periodo: { ini: "01/11/2025", fim: "31/12/2025" } };
    const r = consolidarPeriodo(
      base,
      [mensal("fora", "31/10/2025", 999, 999), mensal("outro", "30/11/2025", 500, 500, "c2")],
      "c1",
    );
    expect(r.estado).toBe("vazia");
    expect(r.usados).toBe(0);
    expect(r.demonstrativo).toBe(base);
    expect(r.aviso).toContain("Nenhum relatório mensal");
  });
});

describe("nomes do consolidado", () => {
  it("empilha receitas e despesas de mesmo nome entre meses em vez de duplicar a linha", () => {
    const r = consolidarPeriodo(baseAnual(), serieCompleta(), "c1");
    expect(r.demonstrativo.receitas.itens).toHaveLength(1);
    expect(r.demonstrativo.despesas.grupos).toHaveLength(1);
    expect(r.demonstrativo.despesas.grupos[0]?.itens).toHaveLength(1);
  });
});
