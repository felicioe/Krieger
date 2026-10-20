import { describe, expect, it } from "vitest";
import { compararPrevistoRealizado, mesesDoExercicioSeguinte, GRUPO_AJUSTES_GERAIS } from "@/domain/previstoRealizado";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { AjustePrevisao, Demonstrativo, Exercicio, Mensal } from "@/domain/types";

function demo(grupos: Demonstrativo["despesas"]["grupos"], ini = "", fim = ""): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    periodo: { ini, fim },
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  });
}

function exercicio(ajustes: AjustePrevisao[] = [], variacao = 0): Exercicio {
  return {
    id: "e1",
    condoId: "c1",
    condoNome: "Teste",
    ano: 2025,
    demonstrativo: demo(
      [
        { nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] },
        { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 24000 }, { nome: "Fundo de caixa p/ obras", valor: 12000 }] },
      ],
      "01/01/2025",
      "31/12/2025",
    ),
    origem: [],
    cidade: "",
    dataEmissao: "",
    rateioAtual: null,
    variacao,
    variacaoMetodo: "manual",
    variacaoParam: null,
    deducaoRegex: "fundo de caixa p/ obras",
    arredondamento: "centavos",
    confer: null,
    consid: {} as Exercicio["consid"],
    prev: { modo: "tradicional", ajustes },
  };
}

function mensal(mes: number, ano: number, grupos: Demonstrativo["despesas"]["grupos"], condoId = "c1"): Mensal {
  const mm = String(mes).padStart(2, "0");
  return {
    id: `m${ano}${mm}`,
    condoId,
    condoNome: "Teste",
    demonstrativo: demo(grupos, `01/${mm}/${ano}`, `28/${mm}/${ano}`),
    origem: [],
    receber: { unidades: null, valor: null },
    notas: [],
  };
}

const salarios = (v: number) => ({ nome: "Pessoal", itens: [{ nome: "Salários", valor: v }] });

describe("previsto × realizado", () => {
  it("o exercício N+1 começa no mês seguinte ao fim do demonstrativo N", () => {
    const e = exercicio();
    e.demonstrativo!.periodo = { ini: "01/07/2024", fim: "30/06/2025" };
    const m = mesesDoExercicioSeguinte(e);
    expect(m[0]).toEqual({ mes: 7, ano: 2025 });
    expect(m[11]).toEqual({ mes: 6, ano: 2026 });
  });

  it("previsto até o mês = anual × meses ÷ 12; realizado soma os mensais até o mês escolhido", () => {
    const mensais = [mensal(1, 2026, [salarios(10000)]), mensal(2, 2026, [salarios(11000)]), mensal(3, 2026, [salarios(50000)])];
    const r = compararPrevistoRealizado(exercicio(), mensais, { mesAte: 2 });
    const l = r.grupos.find((g) => g.nome === "Pessoal")!.linhas[0]!;
    expect(l.previstoAnual).toBe(120000);
    expect(l.previstoMensal).toBe(10000);
    expect(l.previsto).toBe(20000);
    expect(l.realizado).toBe(21000); // março fica de fora
    expect(l.diferenca).toBe(1000);
    expect(l.pct).toBe(5);
  });

  it("situação: dentro até a tolerância; acima e abaixo fora dela", () => {
    const comTol = (v: number, tolerancia: number) =>
      compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(v)])], { mesAte: 1, tolerancia }).grupos[0]!.linhas[0]!.situacao;
    expect(comTol(10500, 5)).toBe("dentro");
    expect(comTol(10600, 5)).toBe("acima");
    expect(comTol(9400, 5)).toBe("abaixo");
    expect(comTol(10100, 0)).toBe("acima");
  });

  it("a previsão comparada já inclui variação e ajustes + e −, por grupo e no geral", () => {
    const ajustes: AjustePrevisao[] = [
      { id: "a", descricao: "Novo porteiro", sinal: "+", valor: 12000, grupo: "Pessoal" },
      { id: "b", descricao: "Economia geral", sinal: "-", valor: 6000 },
    ];
    const r = compararPrevistoRealizado(exercicio(ajustes, 10), [], { mesAte: 12 });
    const pessoal = r.grupos.find((g) => g.nome === "Pessoal")!;
    expect(pessoal.totais.previstoAnual).toBe(132000 + 12000);
    expect(r.grupos.at(-1)!.nome).toBe(GRUPO_AJUSTES_GERAIS);
    expect(r.grupos.at(-1)!.totais.previstoAnual).toBe(-6000);
    // (120.000 + 24.000) × 1,10 + 12.000 − 6.000 = anual ajustado da previsão
    expect(r.total.previstoAnual).toBe(164400);
  });

  it("despesas da dedução ficam fora dos totais", () => {
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{ nome: "Manutenção", itens: [{ nome: "Fundo de caixa p/ obras", valor: 1000 }, { nome: "Elevadores", valor: 2000 }] }])],
      { mesAte: 1 },
    );
    expect(r.deduzidas.map((d) => d.nome)).toEqual(["Fundo de caixa p/ obras"]);
    expect(r.total.realizado).toBe(2000);
    expect(r.total.previstoAnual).toBe(144000);
  });

  it("rubricas casam sem acento/maiúsculas e pelo de-para do condomínio", () => {
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{ nome: "PESSOAL", itens: [{ nome: "Folha de pagamento", valor: 10000 }] }])],
      { mesAte: 1, condominio: { unidades: 10, mapeamento: [{ de: "Folha de pagamento", para: "Salários" }] } },
    );
    const pessoal = r.grupos.find((g) => g.nome === "Pessoal")!;
    expect(pessoal.linhas).toHaveLength(1);
    expect(pessoal.linhas[0]!.realizado).toBe(10000);
  });

  it("ignora outros condomínios e avisa meses sem relatório", () => {
    const r = compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(10000)]), mensal(2, 2026, [salarios(99999)], "outro")], {
      mesAte: 2,
    });
    expect(r.total.realizado).toBe(10000);
    expect(r.avisos.some((a) => a.includes("02/2026"))).toBe(true);
  });
});
