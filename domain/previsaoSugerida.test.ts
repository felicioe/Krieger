import { describe, expect, it } from "vitest";
import { lerPrevisaoSugerida } from "@/domain/pdfParser";
import {
  calcularPrevisaoSugerida,
  calcularPrevisaoSugeridaPorUnidade,
  previsaoSugeridaDoPdf,
  validarPrevisaoSugeridaDoPdf,
} from "@/domain/previsaoSugerida";
import type { PrevisaoSugeridaExercicio } from "@/domain/types";

describe("previsaoSugeridaDoPdf", () => {
  const previsaoSugerida = [
    "CONDOMÍNIO RESIDENCIAL JARDIM TESTE",
    "PREVISÃO ORÇAMENTÁRIA ORDINÁRIA",
    "SUGERIDA PARA O EXERCÍCIO DE 2026/2027.",
    "Valor total do rateio ordinário mensal utilizado atualmente ",
    "para obter os valores cobrados de condomínio .............. R$ 20.000,00 ",
    "Dados históricos das despesas ocorridas em 2025/2026 que ",
    "Poderão servir como base para a previsão das despesas ordi- ",
    "nárias do exercício de 2026/2027: ",
    "efetivamente realizado no ano média mês ",
    "Departamento pessoal ..................... R$ 150.000,00 R$ 12.500,00 ",
    "Manutenções .............................. R$ 40.000,00 R$ 3.333,33 ",
    "Total das despesas do período ............ R$ 190.000,00 R$ 15.833,33 ",
    "Despesas a deduzir (parte água e gás) .... R$-30.000,00 ",
    "Total de despesas consideradas ordinárias. R$ 160.000,00 ",
    "Variação de despesas sugeridas p/ 2026/27. R$ 10.000,00 ",
    "Sugestão de rateio anual ordinário ....... R$ 170.000,00 ",
    "Sugestão de rateio mensal ordinário ....................... R$ 14.166,67 ",
    "Índice sugerido para correção do condomínio ............... 7,50% ",
    "Cidade Exemplo, 31 de outubro de 2026. ",
  ].join("\n");
  const pv = lerPrevisaoSugerida(previsaoSugerida)!;

  it("converte o que foi lido do PDF na estrutura editável, com uma linha de dedução pré-preenchida", () => {
    const p = previsaoSugeridaDoPdf(pv);
    expect(p.rateioMensalAtual).toBe(20000);
    expect(p.categorias).toEqual([
      { nome: "Departamento pessoal", anual: 150000, media: 12500 },
      { nome: "Manutenções", anual: 40000, media: 3333.33 },
    ]);
    expect(p.deducoes).toEqual([{ id: "ded-agua-gas", descricao: "Parte água e gás", sinal: "-", valor: 30000 }]);
    expect(p.variacao).toEqual({ sinal: "+", valor: 10000 });
  });

  it("sem dedução nem variação no PDF, não cria linha de dedução e a variação fica zerada", () => {
    const semExtra = previsaoSugeridaDoPdf({ ...pv, deducao: null, variacaoSugerida: null });
    expect(semExtra.deducoes).toEqual([]);
    expect(semExtra.variacao).toEqual({ sinal: "+", valor: 0 });
  });
});

describe("validarPrevisaoSugeridaDoPdf", () => {
  const previsaoSugerida = [
    "CONDOMÍNIO RESIDENCIAL JARDIM TESTE",
    "PREVISÃO ORÇAMENTÁRIA ORDINÁRIA",
    "SUGERIDA PARA O EXERCÍCIO DE 2026/2027.",
    "Valor total do rateio ordinário mensal utilizado atualmente ",
    "para obter os valores cobrados de condomínio .............. R$ 20.000,00 ",
    "efetivamente realizado no ano média mês ",
    "Departamento pessoal ..................... R$ 150.000,00 R$ 12.500,00 ",
    "Manutenções .............................. R$ 40.000,00 R$ 3.333,33 ",
    "Total das despesas do período ............ R$ 190.000,00 R$ 15.833,33 ",
    "Despesas a deduzir (parte água e gás) .... R$-30.000,00 ",
    "Total de despesas consideradas ordinárias. R$ 160.000,00 ",
    "Variação de despesas sugeridas p/ 2026/27. R$ 10.000,00 ",
    "Sugestão de rateio anual ordinário ....... R$ 170.000,00 ",
    "Sugestão de rateio mensal ordinário ....................... R$ 14.166,67 ",
    // Consistente com os demais valores: 14.166,67 / 20.000,00 - 1 ≈ -29,17% (não um valor arbitrário).
    "Índice sugerido para correção do condomínio ............... -29,17% ",
    "Cidade Exemplo, 31 de outubro de 2026. ",
  ].join("\n");

  it("sem divergência, quando os totais do PDF batem com o recalculado", () => {
    const pv = lerPrevisaoSugerida(previsaoSugerida)!;
    expect(validarPrevisaoSugeridaDoPdf(pv)).toEqual([]);
  });

  it("acusa divergência quando uma linha de subtotal vira categoria falsa (caso real: Residencial Santa Cecília)", () => {
    // Rótulo que o parser não reconhece como linha de total (ex.: faltando "do", como no PDF real do
    // Santa Cecília) vira uma categoria a mais, duplicando o total das despesas do ano — e por tabela
    // o total ordinário, o rateio sugerido e o índice, mesmo esses vindo de linhas à parte no PDF.
    const comSubtotalDuplicado = previsaoSugerida.replace(
      "Total das despesas do período ............ R$ 190.000,00 R$ 15.833,33 ",
      "Subtotal período .......................... R$ 190.000,00 R$ 15.833,33 ",
    );
    const pv = lerPrevisaoSugerida(comSubtotalDuplicado)!;
    expect(pv.totalDespesasAno).toBeNull(); // a linha de total nem foi reconhecida como tal
    const divergencias = validarPrevisaoSugeridaDoPdf(pv);
    expect(divergencias.length).toBeGreaterThan(0);
    const campos = divergencias.map((d) => d.campo);
    expect(campos).toContain("Total ordinário");
    expect(campos).toContain("Sugestão de rateio anual ordinário");
    expect(campos).toContain("Sugestão de rateio mensal ordinário");
    expect(campos).toContain("Índice sugerido para correção");
    const ordinario = divergencias.find((d) => d.campo === "Total ordinário")!;
    expect(ordinario.doPdf).toBe(160000); // o PDF informa este total à parte, numa linha própria
    expect(ordinario.calculado).toBe(350000); // 380000 (categorias, já duplicadas) - 30000 (dedução)
  });
});

describe("calcularPrevisaoSugerida", () => {
  const base: PrevisaoSugeridaExercicio = {
    rateioMensalAtual: 48000,
    categorias: [
      { nome: "Pessoal", anual: 194400, media: 16200 },
      { nome: "Consumo", anual: 85500, media: 7125 },
    ],
    deducoes: [{ id: "d1", descricao: "Parte água e gás", sinal: "-", valor: 24000 }],
    variacao: { sinal: "+", valor: 17587.05 },
  };

  it("soma categorias, aplica deduções e variação (com sinal) até o rateio mensal sugerido", () => {
    const r = calcularPrevisaoSugerida(base);
    expect(r.totalDespesasAno).toBe(279900); // 194400 + 85500
    expect(r.totalDespesasMedia).toBeCloseTo(23325, 2); // ÷12
    expect(r.deducoesTotal).toBe(-24000);
    expect(r.totalOrdinario).toBe(255900); // 279900 - 24000
    expect(r.variacaoValor).toBe(17587.05);
    expect(r.totalFinal).toBeCloseTo(273487.05, 2);
    expect(r.rateioMensalSugerido).toBeCloseTo(22790.59, 2); // ÷12
  });

  it("índice sugerido compara o rateio mensal sugerido com o rateio mensal atual (ano anterior)", () => {
    const r = calcularPrevisaoSugerida(base);
    // 22790.59 / 48000 - 1 ≈ -52,52%
    expect(r.indiceSugerido).toBeCloseTo(-52.52, 1);
  });

  it("sem rateio mensal atual, o índice fica null em vez de dividir por algo desconhecido", () => {
    const r = calcularPrevisaoSugerida({ ...base, rateioMensalAtual: null });
    expect(r.indiceSugerido).toBeNull();
  });

  it("deduções/variação negativas reduzem o total; múltiplas linhas de dedução se somam", () => {
    const comDuasDeducoes: PrevisaoSugeridaExercicio = {
      ...base,
      deducoes: [
        { id: "d1", descricao: "Parte água e gás", sinal: "-", valor: 24000 },
        { id: "d2", descricao: "Obra extraordinária já rateada à parte", sinal: "-", valor: 6000 },
      ],
      variacao: { sinal: "-", valor: 5000 },
    };
    const r = calcularPrevisaoSugerida(comDuasDeducoes);
    expect(r.deducoesTotal).toBe(-30000);
    expect(r.variacaoValor).toBe(-5000);
    expect(r.totalOrdinario).toBe(249900); // 279900 - 30000
    expect(r.totalFinal).toBe(244900); // 249900 - 5000
  });
});

describe("calcularPrevisaoSugeridaPorUnidade", () => {
  it("divide o rateio mensal sugerido pelas unidades e soma o fundo de reserva, arredondando", () => {
    const r = calcularPrevisaoSugeridaPorUnidade(22790.59, 48, 10, "arredondar");
    expect(r.unidades).toBe(48);
    expect(r.cotaUnidade).toBeCloseTo(474.8, 1);
    expect(r.reservaUnidade).toBeCloseTo(47.48, 1);
    expect(r.valorUnidade).toBe(Math.round(474.8 + 47.48));
  });

  it("sem unidades cadastradas, devolve tudo null em vez de dividir por zero", () => {
    expect(calcularPrevisaoSugeridaPorUnidade(22790.59, null, 10, "arredondar")).toEqual({
      unidades: null,
      cotaUnidade: null,
      reservaUnidade: null,
      valorUnidade: null,
    });
    expect(calcularPrevisaoSugeridaPorUnidade(22790.59, 0, 10, "arredondar").unidades).toBeNull();
  });
});
