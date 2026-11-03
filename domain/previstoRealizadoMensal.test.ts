import { describe, expect, it } from "vitest";
import { compararPrevistoRealizadoMensal } from "@/domain/previstoRealizadoMensal";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { Demonstrativo, Exercicio } from "@/domain/types";

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
  it("demonstrativoBase substitui o do próprio exercício na previsão (achado do Codex no PR #170: evita divergir do editor)", () => {
    const e = exercicio();
    const outraBase = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 240000 }] }]);
    const comBase = compararPrevistoRealizadoMensal(e, [], { demonstrativoBase: outraBase });
    const semBase = compararPrevistoRealizadoMensal(e, [], {});
    expect(comBase.total.previsto).toBe(240000);
    expect(semBase.total.previsto).toBe(120000); // base do próprio exercício
  });
});
