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
  evolucaoMensal,
  inadimplencia,
  montarRelatorioFinal,
  notasConsolidadas,
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

  it("evolução mensal mapeia receitas, despesas e saldo de cada mês, em ordem", () => {
    const comTotais = (m: Mensal, t: { receitas: number; despesas: number; saldoAtual: number }): Mensal => ({
      ...m,
      demonstrativo: { ...m.demonstrativo!, totais: { ...m.demonstrativo!.totais, ...t } },
    });
    const r = evolucaoMensal([
      comTotais(mensal(1, null), { receitas: 5000, despesas: 3000, saldoAtual: 2000 }),
      comTotais(mensal(2, null), { receitas: 5500, despesas: 3200, saldoAtual: 2300 }),
    ]);
    expect(r).toEqual([
      { mes: "01/2026", receitas: 5000, despesas: 3000, saldo: 2000 },
      { mes: "02/2026", receitas: 5500, despesas: 3200, saldo: 2300 },
    ]);
  });

  it("mês sem demonstrativo fica de fora da evolução mensal", () => {
    expect(evolucaoMensal([{ ...mensal(1, null), demonstrativo: null }, mensal(2, null)])).toHaveLength(1);
  });

  it("consumo de água soma as despesas da rubrica de água; o valor manual prevalece", () => {
    const e = exercicio(4000);
    expect(consumoAgua(e)).toEqual({
      valor: 1200,
      manual: false,
      rubricas: ["Água e esgoto"],
      automatico: { valor: 1200, rubricas: ["Água e esgoto"] },
    });
    expect(consumoAgua({ ...e, consid: { ...e.consid, consumoAguaManual: 999 } }).valor).toBe(999);
  });

  it("consumo de energia e de elevadores usam a mesma mecânica da água, com rubrica própria", () => {
    const e = exercicio(4000);
    // Rubrica padrão do cadastro ("energia el[ée]trica") não casa com "Energia" do demonstrativo de teste.
    expect(consumoEnergia(e).valor).toBe(0);
    expect(consumoElevador(e).valor).toBe(0);
    const comRubrica = { ...e, consid: { ...e.consid, energiaRubrica: "^energia" } };
    expect(consumoEnergia(comRubrica)).toEqual({
      valor: 800,
      manual: false,
      rubricas: ["Energia"],
      automatico: { valor: 800, rubricas: ["Energia"] },
    });
    expect(consumoEnergia({ ...comRubrica, consid: { ...comRubrica.consid, consumoEnergiaManual: 50 } }).valor).toBe(50);
  });

  it("consumo com valor manual mantém o cálculo automático disponível (não vira 0/[])", () => {
    const e = exercicio(4000);
    const manual = consumoAgua({ ...e, consid: { ...e.consid, consumoAguaManual: 999 } });
    expect(manual).toEqual({
      valor: 999,
      manual: true,
      rubricas: [],
      automatico: { valor: 1200, rubricas: ["Água e esgoto"] },
    });
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

  it("sem unidades no cadastro, o quadro por unidade fica nulo (não usa unidades inadimplentes do relatório mensal como total)", () => {
    const semCadastro: Condominio = { ...condo, unidades: null };
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

    // mensal(1, 100) grava receber.unidades = 2 (unidades inadimplentes, não o total do condomínio)
    // — mesmo presente, não deve ser usado como divisor do rateio por unidade.
    const semCadastroComMensal = montarRelatorioFinal({ exercicio: e, condominio: semCadastro, escritorio: null, mensais: [mensal(1, 100)] });
    expect(semCadastroComMensal.previsaoSugeridaPorUnidade?.unidades).toBeNull();
    expect(semCadastroComMensal.previsao.unidades).toBeNull();

    const comCadastro = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [mensal(1, 100)] });
    expect(comCadastro.previsaoSugeridaPorUnidade?.unidades).toBe(10);
  });

  it("conferência: com previsão sugerida, compara o rateio aprovado com o valor por unidade dela (não com a previsão antiga)", () => {
    const e: Exercicio = {
      ...exercicio(4000),
      rateioAprovado: 1100,
      prev: { modo: "tradicional", fundoReservaPct: 10 },
      previsaoSugerida: {
        rateioMensalAtual: 40000,
        categorias: [{ nome: "Pessoal", anual: 120000, media: 10000 }],
        deducoes: [],
        variacao: { sinal: "+", valor: 0 },
      },
    };
    const r = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    const item = r.conferencia.find((c) => c.titulo === "Previsão orçamentária");
    expect(item?.situacao).toBe("ok");
    expect(item?.detalhe).toContain("1.100,00"); // valor por unidade da previsão sugerida, não a antiga

    const divergente = montarRelatorioFinal({ exercicio: { ...e, rateioAprovado: 999 }, condominio: condo, escritorio: null, mensais: [] });
    const itemDivergente = divergente.conferencia.find((c) => c.titulo === "Previsão orçamentária");
    expect(itemDivergente?.situacao).toBe("aviso");
  });

  it("conferência: sem previsão sugerida (exercício antigo ou digitado à mão), continua usando a previsão calculada do demonstrativo", () => {
    const r = montarRelatorioFinal({ exercicio: exercicio(4000), condominio: condo, escritorio: null, mensais: [] });
    const item = r.conferencia.find((c) => c.titulo === "Previsão orçamentária");
    expect(item?.situacao).toBe("aviso"); // rateioAprovado não informado no exercício-base de teste
    expect(item?.detalhe).toMatch(/rateio aprovado ainda não informado/);
  });
});
