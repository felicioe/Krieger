import { describe, expect, it } from "vitest";
import { compararPrevistoRealizadoMensal } from "@/domain/previstoRealizadoMensal";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { Demonstrativo, Exercicio, HistoricoRateio } from "@/domain/types";

function demo(grupos: Demonstrativo["despesas"]["grupos"], ini = "", fim = ""): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    periodo: { ini, fim },
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  });
}

function exercicio(): Exercicio {
  return {
    id: "e1",
    condoId: "c1",
    condoNome: "Teste",
    ano: 2025,
    demonstrativo: demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }], "01/01/2026", "31/12/2026"),
    origem: [],
    cidade: "",
    dataEmissao: "",
    rateioAtual: null,
    variacao: 0,
    variacaoMetodo: "manual",
    variacaoParam: null,
    deducaoRegex: "",
    arredondamento: "centavos",
    confer: null,
    consid: {} as Exercicio["consid"],
    prev: { modo: "tradicional", ajustes: [] },
  };
}

describe("compararPrevistoRealizadoMensal", () => {
  const hist = (variacao: number): HistoricoRateio[] => [
    { id: "h1", condoId: "c1", ano: 2025, rateioAtual: null, rateioSugerido: null, variacao, rateioAprovado: 1, travadoEm: "", fonte: "calculo", exercicioId: null },
  ];

  it("previsto vem do exercício anterior × (1 + % do histórico); sem base não há previsão aprovada", () => {
    const e = exercicio();
    e.ano = 2026;
    const base = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 240000 }] }]);
    const comBase = compararPrevistoRealizadoMensal(e, [], { demonstrativoBase: base, historicoRateios: hist(10) });
    const semBase = compararPrevistoRealizadoMensal(e, [], { historicoRateios: hist(10) });
    expect(comBase.total.previsto).toBe(264000);
    expect(comBase.situacaoPrevisto).toBe("ok");
    expect(semBase.total.previsto).toBe(0); // não usa o demonstrativo do próprio exercício
    expect(semBase.situacaoPrevisto).toBe("sem_base");
  });

  it("sem base: linhas e total do previsto ficam zerados e o aviso aparece; com base não há aviso", () => {
    const e = exercicio();
    e.ano = 2026;
    const base = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 240000 }] }]);
    const semBase = compararPrevistoRealizadoMensal(e, [], { historicoRateios: hist(10) });
    expect(semBase.linhas.every((l) => l.total.previsto === 0)).toBe(true);
    expect(semBase.total.previsto).toBe(0);
    expect(semBase.avisos.some((a) => a.startsWith("Sem demonstrativo base"))).toBe(true);
    const comBase = compararPrevistoRealizadoMensal(e, [], { demonstrativoBase: base, historicoRateios: hist(10) });
    expect(comBase.avisos.some((a) => a.startsWith("Sem demonstrativo base"))).toBe(false);
    expect(comBase.linhas[0]?.total.previsto).toBe(264000);
  });
});
