import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { recalcularDemonstrativo } from "@/domain/demonstrativo";
import { exercicioPadrao } from "@/domain/exercicio";
import { mensalPadrao } from "@/domain/mensal";
import {
  alternarSecao,
  consumoAgua,
  consumoElevador,
  consumoEnergia,
  inadimplencia,
  montarRelatorioFinal,
  notasConsolidadas,
  receitasPorCategoria,
  secoesIncluidas,
} from "@/domain/relatorioFinal";
import type { Condominio, Exercicio, Mensal } from "@/domain/types";

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 10 };

function exercicio(saldoAtual: number): Exercicio {
  const e = { id: "e1", ...exercicioPadrao(condo, 2025, "Curitiba") } as Exercicio;
  e.demonstrativo = recalcularDemonstrativo({
    ...e.demonstrativo!,
    periodo: { ini: "01/01/2025", fim: "31/12/2025" },
    saldoAnterior: { contas: [{ nome: "Conta", valor: 1000 }], total: 0 },
    receitas: { itens: [{ nome: "Taxa", valor: 5000 }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Consumo", itens: [{ nome: "Água e esgoto", valor: 1200 }, { nome: "Energia", valor: 800 }] }], subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: [{ nome: "Conta", valor: saldoAtual }], total: 0 },
  });
  return e;
}

function mensal(mes: number, receber: number | null, notas: Mensal["notas"] = []): Mensal {
  return { id: `m${mes}`, ...mensalPadrao(condo, { mes, ano: 2026 }), receber: { unidades: receber ? 2 : null, valor: receber }, notas };
}

describe("relatório final", () => {
  it("todas as seções vêm incluídas; análise gráfica segue mostrarAnalise", () => {
    const e = exercicio(4000);
    expect(Object.values(secoesIncluidas(e)).every(Boolean)).toBe(true);
    expect(secoesIncluidas({ ...e, ...alternarSecao(e, "analise", false) }).analise).toBe(false);
    expect(alternarSecao(e, "analise", false)).toEqual({ mostrarAnalise: false });
    expect(secoesIncluidas({ ...e, ...alternarSecao(e, "notas", false) }).notas).toBe(false);
  });

  it("conferência: saldo que fecha é ok; que não fecha é erro com a diferença", () => {
    const ok = montarRelatorioFinal({ exercicio: exercicio(4000), condominio: condo, escritorio: null, mensais: [] });
    expect(ok.conferencia.find((c) => c.titulo === "Saldo do demonstrativo")?.situacao).toBe("ok");
    const ruim = montarRelatorioFinal({ exercicio: exercicio(3900), condominio: condo, escritorio: null, mensais: [] });
    const item = ruim.conferencia.find((c) => c.titulo === "Saldo do demonstrativo");
    expect(item?.situacao).toBe("erro");
    expect(item?.detalhe).toContain("R$ 100,00");
  });

  it("inadimplência é a posição do último mês com valor, não a soma", () => {
    const r = inadimplencia([mensal(1, 3000), mensal(2, 2500), mensal(3, null)]);
    expect(r.linhas).toHaveLength(3);
    expect(r.final).toEqual({ mes: "02/2026", unidades: 2, valor: 2500 });
  });

  it("notas dos relatórios mensais consolidadas em ordem, sem notas vazias", () => {
    const n = notasConsolidadas([
      mensal(1, null, [{ rubrica: "Água", texto: "Vazamento", valor: 300 }, { rubrica: " ", texto: "", valor: null }]),
      mensal(2, null, [{ rubrica: "Energia", texto: "Reajuste", valor: null }]),
    ]);
    expect(n).toEqual([
      { mes: "01/2026", rubrica: "Água", texto: "Vazamento", valor: 300 },
      { mes: "02/2026", rubrica: "Energia", texto: "Reajuste", valor: null },
    ]);
  });

  it("relatórios mensais do relatório = janela do Previsto × Realizado até o mês escolhido", () => {
    const e = { ...exercicio(4000), relatorioFinal: { prAte: 2 } };
    const outroAno = { ...mensal(1, 100), id: "x", demonstrativo: { ...mensal(1, 100).demonstrativo!, periodo: { ini: "01/01/2025", fim: "31/01/2025" } } };
    const r = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [mensal(1, 10), mensal(2, 20), mensal(3, 30), outroAno] });
    expect(r.mensais.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("consumo de água soma as despesas da rubrica de água; o valor manual prevalece", () => {
    const e = exercicio(4000);
    expect(consumoAgua(e)).toEqual({ valor: 1200, manual: false, rubricas: ["Água e esgoto"] });
    expect(consumoAgua({ ...e, consid: { ...e.consid, consumoAguaManual: 999 } }).valor).toBe(999);
  });

  it("consumo de energia e de elevadores usam a mesma mecânica da água, com rubrica própria", () => {
    const e = exercicio(4000);
    // Rubrica padrão do cadastro ("energia el[ée]trica") não casa com "Energia" do demonstrativo de teste.
    expect(consumoEnergia(e).valor).toBe(0);
    expect(consumoElevador(e).valor).toBe(0);
    const comRubrica = { ...e, consid: { ...e.consid, energiaRubrica: "^energia" } };
    expect(consumoEnergia(comRubrica)).toEqual({ valor: 800, manual: false, rubricas: ["Energia"] });
    expect(consumoEnergia({ ...comRubrica, consid: { ...comRubrica.consid, consumoEnergiaManual: 50 } }).valor).toBe(50);
  });

  it("receitas por categoria: uma série por nome de item; mês sem aquela receita entra como zero", () => {
    function mensalComReceitas(mes: number, itens: { nome: string; valor: number }[]): Mensal {
      const base = mensal(mes, null);
      return {
        ...base,
        demonstrativo: recalcularDemonstrativo({
          ...base.demonstrativo!,
          periodo: { ini: `01/${String(mes).padStart(2, "0")}/2026`, fim: `28/${String(mes).padStart(2, "0")}/2026` },
          receitas: { itens, subtotal: 0, totalComSaldo: 0 },
        }),
      };
    }
    const m1 = mensalComReceitas(1, [{ nome: "Taxa condominial", valor: 31200 }, { nome: "Multas e juros", valor: 800 }]);
    const m2 = mensalComReceitas(2, [{ nome: "Taxa condominial", valor: 31200 }]);
    const r = receitasPorCategoria([m1, m2]);
    expect(r.map((s) => s.nome)).toEqual(["Taxa condominial", "Multas e juros"]);
    expect(r.find((s) => s.nome === "Multas e juros")!.pontos).toEqual([
      { mes: "01/2026", valor: 800 },
      { mes: "02/2026", valor: 0 },
    ]);
  });

  it("receitas por categoria: categoria sem nenhum valor no período fica de fora", () => {
    const vazio = { ...mensal(1, null) };
    vazio.demonstrativo = recalcularDemonstrativo({
      ...vazio.demonstrativo!,
      receitas: { itens: [{ nome: "Rendimentos de aplicação", valor: 0 }], subtotal: 0, totalComSaldo: 0 },
    });
    expect(receitasPorCategoria([vazio])).toEqual([]);
  });
});
