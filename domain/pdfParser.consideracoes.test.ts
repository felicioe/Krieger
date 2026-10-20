import { describe, expect, it } from "vitest";
import { lerConsideracoesFinais, lerPrevisaoSugerida } from "@/domain/pdfParser";
import { aplicarConsideracoesAoExercicio } from "@/domain/importacao";
import { considDoCondominio } from "@/domain/exercicio";
import { condominioPadrao } from "@/domain/condominio";

// Estrutura real (ver ESPECIFICACAO.md do importador), dados fictícios.
const consideracoesFinais = [
  "CONDOMÍNIO RESIDENCIAL JARDIM TESTE",
  "DEMONSTRATIVO GERAL ENCERRADO EM 31/10/2026",
  "CONSIDERAÇÕES FINAIS",
  "01) Membros da atual administração: ",
  " Síndico:              Fulano de Tal ",
  " Subsíndico:           Ciclana Exemplo ",
  " Conselho fiscal:      Beltrano Teste ",
  "                       Sicrana Amostra ",
  "02) Valor total contas a receber ........................ R$ 5.250,00 ",
  "03) Valor total contas a pagar .......................... R$ 0,00 ",
  "04) Valor do seguro contratado (risco absoluto).......... R$ 10.000.000,00 ",
  " R.C. condomínio/sindico....... R$ 300.000,00 ",
  " Vidros ....................... R$ 10.000,00 ",
  "05) Seguradora: Seguradora Fictícia S.A.. ",
  "06) Vigência do seguro................................... dezembro/26 ",
  "07) Valor da manutenção dos elevadores .................. R$ 1.200,00 ",
  "08) Empresa: Elevadores Exemplo Ltda ",
  "09) Valor médio do consumo de água ...................... R$ 3.500,00 ",
  "10) Última limpeza da caixa d´ água e cisterna .......... outubro/26 ",
  "11) Última dedetização .................................. setembro/26 ",
  "12) Última limpeza da caixa de gordura .................. outubro/26 ",
  "13) Índice de correção aplicado no condomínio em 2024 ... % 4,00 ",
  "14) Índice de correção aplicado no condomínio em 2025 ... % 5,50 ",
  "Cidade Exemplo, 31 de outubro de 2026. ",
  " Krieger Assessoria Contábil e Condominial Ltda. ",
].join("\n");

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

describe("lerConsideracoesFinais", () => {
  const cf = lerConsideracoesFinais(consideracoesFinais);

  it("lê a administração (cargo + nome), inclusive conselhos com vários nomes", () => {
    expect(cf?.administracao).toEqual([
      { cargo: "Síndico", nome: "Fulano de Tal" },
      { cargo: "Subsíndico", nome: "Ciclana Exemplo" },
      { cargo: "Conselho fiscal", nome: "Beltrano Teste" },
      { cargo: "Conselho fiscal", nome: "Sicrana Amostra" },
    ]);
  });

  it("lê contas a receber/pagar, seguro (risco absoluto + coberturas) e seguradora", () => {
    expect(cf?.contasReceber).toBe(5250);
    expect(cf?.contasPagar).toBe(0);
    expect(cf?.seguro).toEqual({
      riscoAbsoluto: 10000000,
      coberturas: [
        { desc: "R.C. condomínio/sindico", valor: 300000 },
        { desc: "Vidros", valor: 10000 },
      ],
    });
    expect(cf?.seguradora).toBe("Seguradora Fictícia S.A.");
  });

  it("converte mês por extenso em mm/aaaa", () => {
    expect(cf?.vigenciaSeguro).toBe("12/2026");
    expect(cf?.ultCaixaDagua).toBe("10/2026");
    expect(cf?.ultDedetizacao).toBe("09/2026");
    expect(cf?.ultGordura).toBe("10/2026");
  });

  it("lê manutenção dos elevadores, consumo de água e os índices de correção por ano", () => {
    expect(cf?.manutencaoElevadores).toBe(1200);
    expect(cf?.empresaElevadores).toBe("Elevadores Exemplo Ltda");
    expect(cf?.consumoAguaMedio).toBe(3500);
    expect(cf?.indices).toEqual([
      { ano: 2024, pct: 4 },
      { ano: 2025, pct: 5.5 },
    ]);
  });

  it("devolve null quando a seção não existe no PDF", () => {
    expect(lerConsideracoesFinais("Demonstrativo qualquer sem essa seção")).toBeNull();
  });
});

describe("lerPrevisaoSugerida", () => {
  const pv = lerPrevisaoSugerida(previsaoSugerida);

  it("lê o rateio mensal atual e as categorias de despesa (anual + média)", () => {
    expect(pv?.rateioMensalAtual).toBe(20000);
    expect(pv?.categorias).toEqual([
      { nome: "Departamento pessoal", anual: 150000, media: 12500 },
      { nome: "Manutenções", anual: 40000, media: 3333.33 },
    ]);
    expect(pv?.totalDespesasAno).toBe(190000);
    expect(pv?.totalDespesasMedia).toBe(15833.33);
  });

  it("lê dedução, total ordinário, variação e os valores sugeridos", () => {
    expect(pv?.deducao).toBe(-30000);
    expect(pv?.totalOrdinario).toBe(160000);
    expect(pv?.variacaoSugerida).toBe(10000);
    expect(pv?.rateioAnualSugerido).toBe(170000);
    expect(pv?.rateioMensalSugerido).toBe(14166.67);
    expect(pv?.indiceSugerido).toBe(7.5);
  });

  it("devolve null quando a seção não existe no PDF", () => {
    expect(lerPrevisaoSugerida("Demonstrativo qualquer sem essa seção")).toBeNull();
  });
});

describe("aplicarConsideracoesAoExercicio", () => {
  const condo = { ...condominioPadrao(), id: "c1", nome: "Jardim Teste" };
  const cf = lerConsideracoesFinais(consideracoesFinais)!;
  const pv = lerPrevisaoSugerida(previsaoSugerida)!;

  it("preenche consid a partir das considerações finais, preservando o que não veio do PDF", () => {
    const base = considDoCondominio(condo);
    const consid = aplicarConsideracoesAoExercicio(base, cf, null);
    expect(consid.administracao).toHaveLength(4);
    expect(consid.contasReceber).toBe(5250);
    expect(consid.seguradora).toBe("Seguradora Fictícia S.A.");
    expect(consid.indices).toEqual(cf.indices);
  });

  it("acrescenta os valores sugeridos pelo Systemar em extras, já formatados, sem mexer no cálculo da previsão", () => {
    const base = considDoCondominio(condo);
    const consid = aplicarConsideracoesAoExercicio(base, null, pv);
    expect(consid.extras).toEqual([
      { rotulo: "Rateio mensal sugerido (Systemar)", valor: "R$ 14.166,67" },
      { rotulo: "Índice sugerido para correção (Systemar)", valor: "7,50%" },
      { rotulo: "Total de despesas consideradas ordinárias (Systemar)", valor: "R$ 160.000,00" },
    ]);
  });

  it("acrescenta manutenção/empresa dos elevadores e consumo de água em extras, pois não há campo próprio pra eles", () => {
    const base = considDoCondominio(condo);
    const consid = aplicarConsideracoesAoExercicio(base, cf, null);
    expect(consid.extras).toEqual([
      { rotulo: "Manutenção dos elevadores (Systemar)", valor: "R$ 1.200,00" },
      { rotulo: "Empresa dos elevadores (Systemar)", valor: "Elevadores Exemplo Ltda" },
      { rotulo: "Consumo médio de água (Systemar)", valor: "R$ 3.500,00" },
    ]);
  });

  it("reaplicar (reimportação do mesmo PDF) substitui os extras do Systemar em vez de duplicar", () => {
    const base = considDoCondominio(condo);
    const primeira = aplicarConsideracoesAoExercicio(base, cf, pv);
    const extrasManual = { rotulo: "Observação do síndico", valor: "conferir com o conselho" };
    const comExtraManual = { ...primeira, extras: [...primeira.extras, extrasManual] };
    const segunda = aplicarConsideracoesAoExercicio(comExtraManual, cf, pv);
    expect(segunda.extras.filter((e) => e.rotulo === "Rateio mensal sugerido (Systemar)")).toHaveLength(1);
    expect(segunda.extras).toContainEqual(extrasManual);
  });
});
