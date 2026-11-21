import { describe, expect, it } from "vitest";
import { calcularPrevisaoParaRelatorios, variacaoPct } from "./previsaoRelatorios";
import { demonstrativoVazio, recalcularDemonstrativo } from "./demonstrativo";
import type { Demonstrativo, Exercicio, Mensal } from "./types";

function demo(grupos: Demonstrativo["despesas"]["grupos"], ini = "", fim = ""): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    periodo: { ini, fim },
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  });
}

const pessoal = (v: number) => ({ nome: "Pessoal", itens: [{ nome: "Salários", valor: v }] });

function exercicio(grupos = [pessoal(1200)], ini = "01/01/2026", fim = "31/12/2026"): Exercicio {
  return {
    id: "e26",
    condoId: "c1",
    condoNome: "Teste",
    ano: 2026,
    demonstrativo: demo(grupos, ini, fim),
    origem: [],
    cidade: "",
    dataEmissao: "",
    rateioAtual: null,
    variacao: 0,
    variacaoMetodo: "percentual",
    variacaoParam: 10,
    deducaoRegex: "",
    arredondamento: "centavos",
    confer: null,
    consid: {} as Exercicio["consid"],
    prev: { modo: "tradicional", ajustes: [] },
  };
}

function mensal(mes: number, grupos: Demonstrativo["despesas"]["grupos"], condoId = "c1"): Mensal {
  const ultimo = new Date(2026, mes, 0).getDate();
  const p = String(mes).padStart(2, "0");
  return {
    id: `m${mes}${condoId}`,
    condoId,
    condoNome: "Teste",
    demonstrativo: demo(grupos, `01/${p}/2026`, `${ultimo}/${p}/2026`),
    origem: [],
    receber: { unidades: null, valor: null },
    notas: [],
  };
}

const base2025 = demo([pessoal(1000), { nome: "Água", itens: [{ nome: "Sabesp", valor: 600 }] }], "01/01/2025", "31/12/2025");

describe("calcularPrevisaoParaRelatorios", () => {
  it("variação segue o sentido do domínio: (realizado − previsto) ÷ previsto", () => {
    expect(variacaoPct(120, 100)).toBe(20);
    expect(variacaoPct(80, 100)).toBe(-20);
    expect(variacaoPct(10, 0)).toBeNull();
  });

  it("previsto = ano anterior × (1 + %) proporcional aos meses; realizado vem dos mensais", () => {
    const r = calcularPrevisaoParaRelatorios(
      exercicio(),
      [mensal(1, [pessoal(110)]), mensal(2, [pessoal(130)])],
      { demonstrativoBase: base2025, reajustePct: 10 },
    );
    expect(r.origemRealizado).toBe("mensais");
    expect(r.meses).toBe(2);
    expect(r.mesAte).toBe("02/2026");
    const pes = r.grupos.find((g) => g.nome === "Pessoal")!;
    // 1000 × 1,10 × 2/12 = 183,33; realizado 240
    expect(pes.previsto).toBe(183.33);
    expect(pes.realizado).toBe(240);
    expect(pes.diferenca).toBe(56.67);
    expect(pes.variacaoPct).toBe(30.91);
  });

  it("grupo que só existe no ano anterior entra no previsto, com realizado zero", () => {
    const r = calcularPrevisaoParaRelatorios(
      exercicio(),
      [mensal(1, [pessoal(100)])],
      { demonstrativoBase: base2025, reajustePct: 0 },
    );
    const agua = r.grupos.find((g) => g.nome === "Água")!;
    expect(agua.previsto).toBe(50);
    expect(agua.realizado).toBe(0);
    expect(agua.variacaoPct).toBe(-100);
    expect(r.total.previsto).toBe(133.33);
    expect(r.total.realizado).toBe(100);
  });

  it("conta só do realizado entra com previsto zero e sem variação", () => {
    const r = calcularPrevisaoParaRelatorios(
      exercicio(),
      [mensal(1, [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 80 }, { nome: "Rescisão", valor: 40 }] }])],
      { demonstrativoBase: base2025, reajustePct: 0 },
    );
    const resc = r.grupos[0]!.contas.find((c) => c.nome === "Rescisão")!;
    expect(resc.previsto).toBe(0);
    expect(resc.realizado).toBe(40);
    expect(resc.variacaoPct).toBeNull();
  });

  it("sem exercício anterior não calcula previsto nem variação", () => {
    const r = calcularPrevisaoParaRelatorios(exercicio(), [mensal(1, [pessoal(100)])], { demonstrativoBase: null, reajustePct: 10 });
    expect(r.semBase).toBe(true);
    expect(r.total.previsto).toBe(0);
    expect(r.total.variacaoPct).toBeNull();
    expect(r.total.realizado).toBe(100);
    expect(r.avisos.join(" ")).toMatch(/base histórica/);
  });

  it("sem mensais usa o demonstrativo da prestação, no período inteiro, e avisa a origem", () => {
    const r = calcularPrevisaoParaRelatorios(exercicio([pessoal(1320)]), [], { demonstrativoBase: base2025, reajustePct: 10 });
    expect(r.origemRealizado).toBe("prestacao");
    expect(r.meses).toBe(12);
    expect(r.mesAte).toBeNull();
    const pes = r.grupos.find((g) => g.nome === "Pessoal")!;
    expect(pes.previsto).toBe(1100);
    expect(pes.realizado).toBe(1320);
    expect(pes.variacaoPct).toBe(20);
    expect(r.avisos.join(" ")).toMatch(/prestação de contas/);
  });

  it("ignora mensais de outro condomínio e de fora do período; avisa meses sem relatório", () => {
    const r = calcularPrevisaoParaRelatorios(
      exercicio(),
      [mensal(1, [pessoal(100)]), mensal(3, [pessoal(100)]), mensal(2, [pessoal(9999)], "outro")],
      { demonstrativoBase: base2025, reajustePct: 0 },
    );
    expect(r.relatoriosUsados).toBe(2);
    expect(r.meses).toBe(3);
    expect(r.total.realizado).toBe(200);
    expect(r.avisos.join(" ")).toMatch(/Sem relatório mensal em: 02\/2026/);
  });

  it("de-para do condomínio junta rubricas com nomes diferentes", () => {
    const r = calcularPrevisaoParaRelatorios(
      exercicio(),
      [mensal(1, [{ nome: "Pessoal", itens: [{ nome: "Folha", valor: 100 }] }])],
      { demonstrativoBase: base2025, reajustePct: 0, condominio: { mapeamento: [{ de: "Folha", para: "Salários" }] } },
    );
    const pes = r.grupos.find((g) => g.nome === "Pessoal")!;
    expect(pes.contas).toHaveLength(1);
    expect(pes.contas[0]!.realizado).toBe(100);
    expect(pes.contas[0]!.previsto).toBe(83.33);
  });

  it("soma das contas bate com o total do grupo e o total geral", () => {
    const r = calcularPrevisaoParaRelatorios(
      exercicio(),
      [mensal(1, [pessoal(100)])],
      { demonstrativoBase: demo([{ nome: "Pessoal", itens: [{ nome: "A", valor: 100 }, { nome: "B", valor: 100 }, { nome: "C", valor: 100 }] }]), reajustePct: 3 },
    );
    const g = r.grupos[0]!;
    expect(g.contas.reduce((s, c) => s + c.previsto, 0)).toBeCloseTo(g.previsto, 2);
    expect(r.total.previsto).toBe(g.previsto);
  });

  it("método de variação em valor fixo gera aviso e não aplica percentual", () => {
    const r = calcularPrevisaoParaRelatorios(exercicio(), [], { demonstrativoBase: base2025, reajustePct: 0, variacaoMetodo: "valor" });
    expect(r.avisos.join(" ")).toMatch(/valor fixo/);
  });
});
