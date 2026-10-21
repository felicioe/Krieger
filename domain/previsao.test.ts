import { describe, expect, it } from "vitest";
import { arredondarValor, calcularPrevisao, resolverVariacao, type ParametrosPrevisao } from "@/domain/previsao";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import { validarNovoExercicio } from "@/domain/exercicio";
import type { AjustePrevisao, Demonstrativo } from "@/domain/types";

function demo(grupos: Demonstrativo["despesas"]["grupos"]): Demonstrativo {
  return recalcularDemonstrativo({ ...demonstrativoVazio("Teste"), despesas: { grupos, subtotal: 0, saldoRestante: 0 } });
}

// base 120.000 = 108.000 de despesas comuns + 12.000 de "Fundo de caixa p/ obras" (deduzido)
const D = demo([
  { nome: "Pessoal", itens: [{ nome: "Salários", valor: 60000 }] },
  { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 48000 }, { nome: "Fundo de caixa p/ obras", valor: 12000 }] },
]);

const ajuste = (sinal: "+" | "-", valor: number): AjustePrevisao => ({ id: sinal + valor, descricao: "x", sinal, valor });

function params(p: Partial<ParametrosPrevisao> = {}): ParametrosPrevisao {
  return {
    variacao: 10,
    variacaoMetodo: "manual",
    variacaoParam: null,
    arredondamento: "centavos",
    deducaoRegex: "fundo de caixa p/ obras",
    rateioAtual: null,
    prev: { modo: "tradicional", ajustes: [ajuste("+", 5000), ajuste("-", 2000)], fundoReservaPct: 10 },
    ...p,
  };
}

describe("previsão — anual ajustado", () => {
  it("anual ajustado = base − dedução + variação + ajustes + − ajustes −", () => {
    const r = calcularPrevisao(D, params(), 25);
    expect(r.base).toBe(120000);
    expect(r.deducao).toBe(12000);
    expect(r.variacaoValor).toBe(10800); // 10% de (120.000 − 12.000)
    expect(r.ajustesMais).toBe(5000);
    expect(r.ajustesMenos).toBe(2000);
    expect(r.totalAnual).toBe(121800);
  });

  it("ajuste com sinal − sempre reduz, mesmo digitado como negativo", () => {
    const r = calcularPrevisao(D, params({ prev: { modo: "tradicional", ajustes: [ajuste("-", -3000)] } }), 25);
    expect(r.totalAnual).toBe(120000 - 12000 + 10800 - 3000);
  });

  it("avisa quando a variação % é implausível (ex.: valor em R$ digitado no lugar do percentual)", () => {
    // Achado testando com dado real: o cadastro do condomínio tinha variacaoPadrao = 14000 (um
    // valor em R$ digitado onde se esperava um percentual), e o total saía sem sentido sem aviso.
    const r = calcularPrevisao(D, params({ variacao: 14000 }), 25);
    expect(r.avisos).toContain("Variação de 14000% é incomum para um reajuste anual — confira se não foi digitado um valor em R$ no lugar do percentual.");
  });

  it("não avisa para uma variação dentro da faixa plausível", () => {
    const r = calcularPrevisao(D, params({ variacao: 10 }), 25);
    expect(r.avisos).toEqual([]);
  });

  it("a dedução também vale quando o nome do grupo casa com a expressão", () => {
    const d = demo([
      { nome: "Fundo de caixa p/ obras", itens: [{ nome: "Pintura", valor: 5000 }] },
      { nome: "Pessoal", itens: [{ nome: "Salários", valor: 10000 }] },
    ]);
    const r = calcularPrevisao(d, params({ variacao: 0, prev: { modo: "tradicional" } }), 10);
    expect(r.deducao).toBe(5000);
    expect(r.totalAnual).toBe(10000);
  });
});

describe("previsão — valores derivados do anual ajustado", () => {
  it("reserva é por unidade: 120.000 anual, 100 unidades, 10% → 100,00 + 10,00 = 110,00", () => {
    const d = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }]);
    const r = calcularPrevisao(d, params({ variacao: 0, prev: { modo: "tradicional", fundoReservaPct: 10 } }), 100);
    expect(r.totalAnual).toBe(120000);
    expect(r.mensal).toBe(10000);
    expect(r.cotaUnidade).toBe(100);
    expect(r.reservaUnidade).toBe(10);
    expect(r.rateioSugerido).toBe(110);
  });

  it("valor por unidade = anual ÷ 12 ÷ unidades + reserva por unidade, com o arredondamento escolhido", () => {
    // 121.800 ÷ 12 ÷ 25 = 406,00; reserva 10% = 40,60; total 446,60
    expect(calcularPrevisao(D, params({ arredondamento: "truncar" }), 25).rateioSugerido).toBe(446);
    expect(calcularPrevisao(D, params({ arredondamento: "arredondar" }), 25).rateioSugerido).toBe(447);
    expect(calcularPrevisao(D, params({ arredondamento: "centavos" }), 25).rateioSugerido).toBe(446.6);
  });

  it("índice = valor por unidade ÷ rateio atual − 1", () => {
    const r = calcularPrevisao(D, params({ arredondamento: "truncar", rateioAtual: 400 }), 25);
    expect(r.indice).toBe(11.5); // 446 ÷ 400 − 1
  });

  it("modo detalhado: soma das linhas previstas = base líquida + variação", () => {
    const r = calcularPrevisao(D, params({ prev: { modo: "detalhado" } }), 25);
    const soma = r.linhas.reduce((s, l) => s + l.previsto, 0);
    expect(soma).toBe(108000 + 10800);
    expect(r.linhas.find((l) => l.nome === "Fundo de caixa p/ obras")?.previsto).toBe(0);
  });
});

describe("previsão — variação e arredondamento", () => {
  it("média dos últimos N índices de correção", () => {
    const indices = [
      { ano: 2023, pct: 4 },
      { ano: 2025, pct: 5 },
      { ano: 2024, pct: 6 },
    ];
    expect(resolverVariacao({ variacao: null, variacaoMetodo: "mediaIndices", variacaoParam: 2, indices }).pct).toBe(5.5);
    expect(resolverVariacao({ variacao: null, variacaoMetodo: "mediaIndices", variacaoParam: null, indices }).pct).toBe(5);
  });
  it("truncar corta os centavos; arredondar vai ao real mais próximo", () => {
    expect(arredondarValor(728.99, "truncar")).toBe(728);
    expect(arredondarValor(728.5, "arredondar")).toBe(729);
    expect(arredondarValor(728.555, "centavos")).toBe(728.56);
  });
});

describe("demonstrativo", () => {
  it("saldo restante = saldo anterior + receitas − despesas e avisa divergência", () => {
    const d = recalcularDemonstrativo({
      ...demonstrativoVazio(),
      saldoAnterior: { contas: [{ nome: "CC", valor: 1000 }], total: 0 },
      receitas: { itens: [{ nome: "Taxa", valor: 5000.1 }], subtotal: 0, totalComSaldo: 0 },
      despesas: { grupos: [{ nome: "G", itens: [{ nome: "x", valor: 4000.05 }] }], subtotal: 0, saldoRestante: 0 },
      saldoAtual: { contas: [{ nome: "CC", valor: 2000 }], total: 0 },
    });
    expect(d.despesas.saldoRestante).toBe(2000.05);
    expect(d.avisos).toHaveLength(1);
  });
});

describe("exercício", () => {
  it("uma prestação de contas por condomínio e ano", () => {
    const existentes = [{ id: "e1", condoId: "c1", ano: 2025 }];
    expect(validarNovoExercicio("c1", 2025, existentes).ok).toBe(false);
    expect(validarNovoExercicio("c1", 2026, existentes).ok).toBe(true);
    expect(validarNovoExercicio("c1", 2025, existentes, "e1").ok).toBe(true);
  });
});
