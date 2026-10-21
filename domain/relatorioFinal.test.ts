import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { recalcularDemonstrativo } from "@/domain/demonstrativo";
import { exercicioPadrao } from "@/domain/exercicio";
import { mensalPadrao } from "@/domain/mensal";
import { alternarSecao, consumoAgua, inadimplencia, montarRelatorioFinal, notasConsolidadas, secoesIncluidas } from "@/domain/relatorioFinal";
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

  it("sem previsão sugerida (PDF sem essa folha, ou exercício digitado à mão), os campos ficam null", () => {
    const r = montarRelatorioFinal({ exercicio: exercicio(4000), condominio: condo, escritorio: null, mensais: [] });
    expect(r.previsaoSugerida).toBeNull();
    expect(r.previsaoSugeridaPorUnidade).toBeNull();
  });

  it("com previsão sugerida no exercício, calcula o total e o quadro por unidade (fundo de reserva do prev)", () => {
    const e: Exercicio = {
      ...exercicio(4000),
      prev: { modo: "tradicional", fundoReservaPct: 10 },
      previsaoSugerida: {
        rateioMensalAtual: 40000,
        categorias: [{ nome: "Pessoal", anual: 120000, media: 10000 }],
        deducoes: [],
        variacao: { sinal: "+", valor: 0 },
      },
    };
    const r = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    expect(r.previsaoSugerida?.rateioMensalSugerido).toBe(10000); // 120000 / 12
    // unidades = 10 (condo), fundoReservaPct = 10%: cota 1000 + reserva 100 = 1100
    expect(r.previsaoSugeridaPorUnidade).toEqual({ unidades: 10, cotaUnidade: 1000, reservaUnidade: 100, valorUnidade: 1100 });
  });
});
