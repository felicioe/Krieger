import { describe, expect, it } from "vitest";
import { lerRelatorio } from "@/domain/pdfParser";
import { textoComLayout, type ItemTexto } from "@/domain/layoutTexto";
import type { ConsideracoesFinaisLidas, PrevisaoSugeridaLida } from "@/domain/pdfParser";
import {
  COLUNA_TOTAL,
  anoDoRelatorio,
  camposFaltando,
  colunaPadrao,
  condominiosParecidos,
  demonstrativoDoRelatorio,
  divergenciasImportacao,
  encontrarCondominio,
  mensaisDoComparativo,
  novaImportacao,
  novoAnexoImportado,
  resumoConferencia,
} from "@/domain/importacao";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import { condominioPadrao } from "@/domain/condominio";
import type { Condominio, Mensal } from "@/domain/types";

/** Linha com rótulo recuado e valores alinhados à direita nas colunas indicadas (posição do último caractere). */
function linha(rotulo: string, recuo: number, valores: (string | null)[], fins: number[]): string {
  let s = " ".repeat(recuo) + rotulo;
  valores.forEach((v, i) => {
    if (v) s = s.padEnd(fins[i]! - v.length) + v;
  });
  return s;
}

const UNICO = [40];
const periodoUnico = [
  "Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90",
  "Demonstrativo de Receitas e Despesas - Período de 01/08/2026 a 31/08/2026",
  "(*) SALDO ANTERIOR",
  linha("Banco do Brasil", 4, ["10.000,00"], UNICO),
  linha("Poupança", 4, ["5.000,00"], UNICO),
  linha("", 0, ["15.000,00"], UNICO),
  "(+) RECEITAS",
  linha("Taxa condominial", 4, ["20.000,00"], UNICO),
  linha("Multas e juros", 4, ["500,00"], UNICO),
  linha("", 0, ["20.500,00"], UNICO),
  "(-) DESPESAS",
  "  PESSOAL",
  linha("Salários", 4, ["8.000,00"], UNICO),
  linha("INSS", 4, ["1.000,00"], UNICO),
  "  CONSUMO",
  linha("Água", 4, ["2.000,00"], UNICO),
  linha("", 0, ["11.000,00"], UNICO),
  "(=) SALDO ATUAL",
  linha("Banco do Brasil", 4, ["19.500,00"], UNICO),
  linha("Poupança", 4, ["5.000,00"], UNICO),
  linha("", 0, ["24.500,00"], UNICO),
  "Conta a receber até a data de 31/08/2026 Quantidade de Unidades: 3 Totalizando: R$ 1.500,00",
].join("\n");

const FINS = [44, 58, 72, 86];
const comparativo = [
  "Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90",
  "Comparativo Financeiro de 07/2026 a 08/2026",
  linha("Competência", 0, ["07/2026", "08/2026", "Total", "Média"], FINS),
  "(*) SALDO ANTERIOR",
  linha("Banco do Brasil", 4, ["1.000,00", "2.000,00"], FINS),
  "(+) RECEITAS",
  linha("Taxa condominial", 4, ["10.000,00", "10.500,00", "20.500,00", "10.250,00"], FINS),
  "(-) DESPESAS",
  linha("Pessoal", 2, ["9.000,00", "9.500,00", "18.500,00", "9.250,00"], FINS),
  linha("Salários", 4, ["8.000,00", "8.000,00", "16.000,00", "8.000,00"], FINS),
  linha("INSS", 4, ["1.000,00", "1.500,00", "2.500,00", "1.250,00"], FINS),
  "(=) SALDO ATUAL",
  linha("Banco do Brasil", 4, ["2.000,00", "3.000,00"], FINS),
].join("\n");

describe("importação do PDF Systemar — período único", () => {
  const rel = lerRelatorio(periodoUnico, "073_082026 - Estrelas do Mar.pdf");

  it("preenche o demonstrativo com os valores do PDF e o saldo fecha", () => {
    const d = demonstrativoDoRelatorio(rel, null, "Estrelas do Mar");
    expect(d.periodo).toEqual({ ini: "01/08/2026", fim: "31/08/2026" });
    expect(d.totais).toEqual({ saldoAnterior: 15000, receitas: 20500, despesas: 11000, saldoAtual: 24500 });
    expect(d.despesas.grupos.map((g) => g.nome)).toEqual(["PESSOAL", "CONSUMO"]);
    expect(d.avisos).toEqual([]);
  });

  it("conferência automática do parser confere", () => {
    expect(resumoConferencia(rel).ok).toBe(true);
  });

  it("sugere o ano do fim do período para a prestação de contas", () => {
    expect(anoDoRelatorio(rel, null)).toBe(2026);
  });

  it("lê o período do layout DEMONSTRATIVO GERAL ENCERRADO EM (prestação de contas anual), assumindo 1º de janeiro como início", () => {
    // Achado testando com PDF real: a prestação de contas anual não usa Período de X a Y, só a
    // data final (ex.: DEMONSTRATIVO GERAL ENCERRADO EM 31/12/2025) — sem isso, rel.periodo ficava
    // null e travava a importação como relatório mensal pedindo o mês manualmente.
    const anual = periodoUnico.replace("Demonstrativo de Receitas e Despesas - Período de 01/08/2026 a 31/08/2026", "DEMONSTRATIVO GERAL ENCERRADO EM 31/12/2026");
    const relAnual = lerRelatorio(anual, "073_122026 - Estrelas do Mar.pdf");
    expect(relAnual.periodo).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
  });

  it("lê as contas a receber", () => {
    expect(rel.contasAReceber).toEqual({ ate: "2026-08-31", unidades: 3, total: 1500 });
  });

  it("não absorve a página de Considerações finais em SALDO ATUAL quando ela vem logo em seguida", () => {
    const comConsideracoes = [periodoUnico, "CONSIDERAÇÕES FINAIS", "01) Membros da atual administração: ", " Síndico: Fulano de Tal "].join("\n");
    const rel2 = lerRelatorio(comConsideracoes, "073_082026 - Estrelas do Mar.pdf");
    const d = demonstrativoDoRelatorio(rel2, null, "Estrelas do Mar");
    expect(d.totais.saldoAtual).toBe(24500);
    expect(d.saldoAtual.contas.map((c) => c.nome)).toEqual(["Banco do Brasil", "Poupança"]);
  });

  it("não corta a seção de despesas quando uma rubrica se chama Telefones (bate com o rodapé de ofício)", () => {
    // Achado testando com PDF real do Systemar: "Telefones" é uma rubrica de despesa comum, mas também
    // era (antes da correção) um dos marcadores de fim de seção (rodapé do escritório), então tudo que
    // vinha depois dela na mesma seção era descartado silenciosamente.
    const comTelefones = [
      "Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90",
      "Demonstrativo de Receitas e Despesas - Período de 01/08/2026 a 31/08/2026",
      "(*) SALDO ANTERIOR",
      linha("Banco do Brasil", 4, ["10.000,00"], UNICO),
      linha("", 0, ["10.000,00"], UNICO),
      "(+) RECEITAS",
      linha("Taxa condominial", 4, ["20.000,00"], UNICO),
      linha("", 0, ["20.000,00"], UNICO),
      "(-) DESPESAS",
      "  CONSUMO",
      linha("Telefones", 4, ["300,00"], UNICO),
      linha("Água", 4, ["2.000,00"], UNICO),
      linha("", 0, ["2.300,00"], UNICO),
      "(=) SALDO ATUAL",
      linha("Banco do Brasil", 4, ["27.700,00"], UNICO),
      linha("", 0, ["27.700,00"], UNICO),
    ].join("\n");
    const rel2 = lerRelatorio(comTelefones, "073_082026 - Estrelas do Mar.pdf");
    const d = demonstrativoDoRelatorio(rel2, null, "Estrelas do Mar");
    expect(d.despesas.grupos[0]!.itens.map((i) => i.nome)).toEqual(["Telefones", "Água"]);
    expect(d.totais.despesas).toBe(2300);
    expect(d.totais.saldoAtual).toBe(27700);
    expect(resumoConferencia(rel2).ok).toBe(true);
  });

  it("acumula despesas em vez de reiniciar quando a seção continua numa segunda página (cabeçalho repetido)", () => {
    // Achado testando com um PDF real de 7 páginas: "(-) DESPESAS" aparecia 2 vezes no texto (a seção
    // continuava na página seguinte), e o parser reiniciava a lista do zero ao ver o cabeçalho de novo,
    // perdendo tudo que tinha lido da primeira página.
    const duasPaginas = [
      "Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90",
      "Demonstrativo de Receitas e Despesas - Período de 01/08/2026 a 31/08/2026",
      "(*) SALDO ANTERIOR",
      linha("Banco do Brasil", 4, ["10.000,00"], UNICO),
      linha("", 0, ["10.000,00"], UNICO),
      "(+) RECEITAS",
      linha("Taxa condominial", 4, ["20.000,00"], UNICO),
      linha("", 0, ["20.000,00"], UNICO),
      "(-) DESPESAS",
      "  PESSOAL",
      linha("Salários", 4, ["8.000,00"], UNICO),
      // quebra de página no meio da seção; o relatório repete o cabeçalho na página seguinte
      "(-) DESPESAS",
      "  CONSUMO",
      linha("Água", 4, ["2.000,00"], UNICO),
      linha("", 0, ["10.000,00"], UNICO),
      "(=) SALDO ATUAL",
      linha("Banco do Brasil", 4, ["20.000,00"], UNICO),
      linha("", 0, ["20.000,00"], UNICO),
    ].join("\n");
    const rel2 = lerRelatorio(duasPaginas, "073_082026 - Estrelas do Mar.pdf");
    const d = demonstrativoDoRelatorio(rel2, null, "Estrelas do Mar");
    expect(d.despesas.grupos.map((g) => g.nome)).toEqual(["PESSOAL", "CONSUMO"]);
    expect(d.totais.despesas).toBe(10000);
    expect(resumoConferencia(rel2).ok).toBe(true);
  });
});

describe("importação do PDF Systemar — comparativo", () => {
  const rel = lerRelatorio(comparativo);

  it("usa o mês escolhido", () => {
    const d = demonstrativoDoRelatorio(rel, "08/2026");
    expect(d.periodo).toEqual({ ini: "01/08/2026", fim: "31/08/2026" });
    expect(d.totais).toEqual({ saldoAnterior: 2000, receitas: 10500, despesas: 9500, saldoAtual: 3000 });
    expect(d.despesas.grupos).toEqual([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 8000 }, { nome: "INSS", valor: 1500 }] }]);
  });

  it("no total do período: Total nas receitas/despesas, saldo anterior do 1º mês e saldo atual do último", () => {
    const d = demonstrativoDoRelatorio(rel, COLUNA_TOTAL);
    expect(d.periodo).toEqual({ ini: "01/07/2026", fim: "31/08/2026" });
    expect(d.totais).toEqual({ saldoAnterior: 1000, receitas: 20500, despesas: 18500, saldoAtual: 3000 });
  });

  it("sugere o último mês no relatório mensal e o total na prestação de contas", () => {
    expect(colunaPadrao(rel, "mensais")).toBe("08/2026");
    expect(colunaPadrao(rel, "exercicios")).toBe(COLUNA_TOTAL);
  });

  it("lê o período mesmo com o cabeçalho bem espaçado (colunas), e não deixa a linha repetida do cabeçalho vazar como despesa", () => {
    // Achado testando com PDF real: "Comparativo Financeiro de X a Y" se repete em toda página
    // (layout multi-mês), com espaçamento bem mais largo entre as palavras do que o fixture
    // acima — nem o período era reconhecido, nem a linha repetida era filtrada (vazava como um
    // item de despesa vazio, sem valores, em cada página).
    const comEspacamentoLargo = comparativo.replace(
      "Comparativo Financeiro de 07/2026 a 08/2026",
      "Comparativo         Financeiro         de        07/2026  a       08/2026\nComparativo         Financeiro         de        07/2026  a       08/2026",
    );
    const rel2 = lerRelatorio(comEspacamentoLargo);
    expect(rel2.periodo).toEqual({ competenciaInicio: "07/2026", competenciaFim: "08/2026" });
    const d = demonstrativoDoRelatorio(rel2, "08/2026");
    expect(d.despesas.grupos.flatMap((g) => g.itens).some((i) => /Comparativo/i.test(i.nome))).toBe(false);
  });

  const condo = { ...condominioPadrao(), id: "c1", nome: "Estrelas do Mar" } as Condominio;

  it("mensaisDoComparativo: um relatório mensal por mês do comparativo, sem conflito quando não há mensal existente", () => {
    const r = mensaisDoComparativo(condo, rel, "comparativo.pdf", []);
    expect(r.map((x) => x.mes)).toEqual(["07/2026", "08/2026"]);
    expect(r.every((x) => x.existente === null)).toBe(true);
    const ago = r.find((x) => x.mes === "08/2026")!;
    expect(ago.registro.condoId).toBe("c1");
    expect(ago.registro.demonstrativo?.totais).toEqual({ saldoAnterior: 2000, receitas: 10500, despesas: 9500, saldoAtual: 3000 });
    expect(ago.competencia).toEqual({ mes: 8, ano: 2026 });
  });

  it("mensaisDoComparativo: acha o relatório mensal existente do mesmo condomínio/competência como conflito", () => {
    const existente: Mensal = {
      id: "m-ago",
      condoId: "c1",
      condoNome: "Estrelas do Mar",
      demonstrativo: { ...demonstrativoVazio(""), periodo: { ini: "01/08/2026", fim: "31/08/2026" } },
      origem: [],
      receber: { unidades: null, valor: null },
      notas: [],
    };
    const r = mensaisDoComparativo(condo, rel, "comparativo.pdf", [existente]);
    expect(r.find((x) => x.mes === "08/2026")?.existente?.id).toBe("m-ago");
    expect(r.find((x) => x.mes === "07/2026")?.existente).toBeNull();
  });
});

describe("texto com layout a partir dos itens do pdf.js", () => {
  // Largura de 5 pt por caractere no texto e 5,5 pt nos números (fontes reais variam).
  const t = (str: string, x: number, y: number, cw = 5): ItemTexto => ({ str, x, y, largura: str.length * cw, altura: 9 });
  const fim = (str: string, xFim: number, y: number, cw = 5.5): ItemTexto => t(str, xFim - str.length * cw, y, cw);
  const paginas: ItemTexto[][] = [
    [
      t("Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90", 40, 800),
      t("Comparativo Financeiro de 07/2026 a 08/2026", 40, 785),
      t("Competência", 40, 770),
      fim("07/2026", 300, 770, 5),
      fim("08/2026", 380, 770, 5),
      fim("Total", 460, 770, 5),
      t("(+) RECEITAS", 40, 755),
      t("Taxa condominial", 60, 740),
      fim("10.000,00", 300, 740),
      fim("10.500,00", 380, 740),
      fim("20.500,00", 460, 740),
    ],
  ];

  it("cada número cai na coluna do mês certo", () => {
    const rel = lerRelatorio(textoComLayout(paginas));
    expect(rel.meses).toEqual(["07/2026", "08/2026"]);
    expect(rel.receitas?.itens[0]).toMatchObject({
      descricao: "Taxa condominial",
      valores: { "07/2026": 10000, "08/2026": 10500 },
      total: 20500,
    });
  });
});

describe("condomínio do relatório", () => {
  const condos = [
    { id: "a", codigo: "73", cnpj: "", nome: "Estrelas do Mar", nomeRelatorio: "" },
    { id: "b", codigo: "", cnpj: "98.765.432/0001-10", nome: "Jardim das Acácias", nomeRelatorio: "" },
    { id: "c", codigo: "", cnpj: "", nome: "Urban Classic", nomeRelatorio: "" },
  ];

  it("encontra pelo mesmo código (com ou sem zeros à esquerda)", () => {
    expect(encontrarCondominio(condos, { codigo: "073", cnpj: null })?.id).toBe("a");
  });

  it("encontra pelo mesmo CNPJ", () => {
    expect(encontrarCondominio(condos, { codigo: "999", cnpj: "98765432000110" })?.id).toBe("b");
  });

  it("sem código nem CNPJ, encontra pelo nome completo (só nesse caso)", () => {
    expect(encontrarCondominio(condos, { codigo: null, cnpj: null, nome: "Urban Classic" })?.id).toBe("c");
    expect(encontrarCondominio(condos, { codigo: null, cnpj: null, nome: "URBAN   classic" })?.id).toBe("c");
    expect(encontrarCondominio(condos, { codigo: null, cnpj: null, nome: "Outro Nome" })).toBeNull();
  });

  it("não usa o nome como fallback quando código ou CNPJ foram informados mas não bateram", () => {
    // Evita "corrigir" pro condomínio errado quando o PDF trouxe um código/CNPJ que só não existe
    // no cadastro ainda — nesse caso é melhor ir pro staging de qualquer jeito.
    expect(encontrarCondominio(condos, { codigo: "999", cnpj: null, nome: "Urban Classic" })).toBeNull();
  });

  it("sugere o condomínio parecido quando não houve correspondência exata (nome com palavra a mais)", () => {
    // Sem código/CNPJ bater, encontrarCondominio devolveria null; condominiosParecidos dá a pista
    // pro usuário antes de tratar como cadastro novo, em vez de arriscar duplicar. "Residencial" é
    // único ao nome do PDF, então bate 2 de 3 palavras (urban, classic) com o cadastro "Urban Classic".
    const parecidos = condominiosParecidos(condos, { nome: "Residencial Urban Classic" });
    expect(parecidos).toEqual([{ condominio: condos[2], pontuacao: 2 / 3 }]);
  });

  it("não sugere nada quando o nome não tem palavra relevante em comum com nenhum cadastro", () => {
    expect(condominiosParecidos(condos, { nome: "Edifício Completamente Diferente" })).toEqual([]);
  });

  it("ordena do mais parecido pro menos parecido e respeita o limiar", () => {
    const base = [
      { id: "a", codigo: "", cnpj: "", nome: "Residencial Jardim das Palmeiras", nomeRelatorio: "" },
      { id: "b", codigo: "", cnpj: "", nome: "Jardim das Flores", nomeRelatorio: "" },
    ];
    const parecidos = condominiosParecidos(base, { nome: "Jardim das Palmeiras" });
    expect(parecidos.map((p) => p.condominio.id)).toEqual(["a"]);
  });

  it("sem correspondência, vai para o staging como pendente", () => {
    const rel = lerRelatorio(periodoUnico.replace(/^Condomínio:.*$/m, "Demonstrativo"));
    expect(encontrarCondominio(condos, rel.condominio)).toBeNull();
    const imp = novaImportacao(rel, "x.pdf", "mensais", null, null, new Date("2026-10-20T00:00:00Z"));
    expect(imp).toMatchObject({
      status: "pendente",
      arquivo: "x.pdf",
      importadoEm: "2026-10-20T00:00:00.000Z",
      condominioId: null,
      consideracoes: null,
      previsaoSugerida: null,
    });
    expect(imp.cadastro.revisar).toBe(true);
    expect(camposFaltando(imp.cadastro)).toEqual(["codigo", "nome", "cnpj"]);
  });

  it("guarda Considerações finais e Previsão sugerida no staging quando o PDF trouxer essas páginas", () => {
    const rel = lerRelatorio(periodoUnico.replace(/^Condomínio:.*$/m, "Demonstrativo"));
    const cf: ConsideracoesFinaisLidas = {
      administracao: [{ cargo: "Síndico", nome: "Fulano" }],
      contasReceber: 1000,
      contasPagar: 500,
      seguro: { riscoAbsoluto: 2000000, coberturas: [] },
      seguradora: "Seguradora S.A.",
      vigenciaSeguro: "12/2026",
      manutencaoElevadores: null,
      empresaElevadores: null,
      consumoAguaMedio: null,
      ultCaixaDagua: null,
      ultDedetizacao: null,
      ultGordura: null,
      indices: [],
    };
    const pv: PrevisaoSugeridaLida = {
      rateioMensalAtual: 500,
      categorias: [],
      totalDespesasAno: 6000,
      totalDespesasMedia: 500,
      deducao: null,
      totalOrdinario: 6000,
      variacaoSugerida: null,
      rateioAnualSugerido: 6200,
      rateioMensalSugerido: 516.67,
      indiceSugerido: 3.33,
    };
    const imp = novaImportacao(rel, "x.pdf", "mensais", cf, pv);
    expect(imp.consideracoes).toBe(cf);
    expect(imp.previsaoSugerida).toBe(pv);
  });
});

describe("auditoria: divergência entre o importado e o gravado", () => {
  const base = recalcularDemonstrativo({
    ...demonstrativoVazio("Estrelas do Mar"),
    saldoAnterior: { contas: [{ nome: "Banco", valor: 10000 }], total: 0 },
    receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Despesas", itens: [{ nome: "Limpeza", valor: 8000 }] }], subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: [{ nome: "Banco", valor: 22000 }], total: 0 },
  });

  it("sem edição após a importação, não há divergência", () => {
    expect(divergenciasImportacao(base, base)).toEqual([]);
  });

  it("aponta cada total que mudou em relação ao importado, com a diferença percentual", () => {
    const editado = recalcularDemonstrativo({
      ...base,
      despesas: { ...base.despesas, grupos: [{ nome: "Despesas", itens: [{ nome: "Limpeza", valor: 1120000 }] }] },
    });
    const divergencias = divergenciasImportacao(base, editado);
    expect(divergencias).toEqual([
      { campo: "despesas", rotulo: "Despesas", importado: 8000, atual: 1120000, diferencaPct: 13900 },
      // saldoRestante muda junto (despesas entram na conta), então "saldoAtual" não diverge aqui —
      // só os 4 totais top-level de demonstrativoDoRelatorio são comparados, não o saldo calculado.
    ]);
  });

  it("edição que corrige de volta o valor importado some da lista de divergências", () => {
    const comDigitoAMais = recalcularDemonstrativo({
      ...base,
      receitas: { ...base.receitas, itens: [{ nome: "Taxa condominial", valor: 200000 }] },
    });
    expect(divergenciasImportacao(base, comDigitoAMais)).toEqual([
      { campo: "receitas", rotulo: "Receitas", importado: 20000, atual: 200000, diferencaPct: 900 },
    ]);
    const corrigido = recalcularDemonstrativo({
      ...comDigitoAMais,
      receitas: { ...comDigitoAMais.receitas, itens: [{ nome: "Taxa condominial", valor: 20000 }] },
    });
    expect(divergenciasImportacao(base, corrigido)).toEqual([]);
  });

  it("quando o importado é zero, a diferença percentual fica indefinida (null) em vez de Infinity", () => {
    const semReceita = recalcularDemonstrativo({ ...base, receitas: { itens: [], subtotal: 0, totalComSaldo: 0 } });
    const comReceitaNova = recalcularDemonstrativo({
      ...semReceita,
      receitas: { itens: [{ nome: "Receita extra", valor: 5000 }], subtotal: 0, totalComSaldo: 0 },
    });
    const divergencias = divergenciasImportacao(semReceita, comReceitaNova);
    expect(divergencias).toEqual([{ campo: "receitas", rotulo: "Receitas", importado: 0, atual: 5000, diferencaPct: null }]);
  });
});

describe("anexo de relatório só leitura (Comparativo Financeiro)", () => {
  it("guarda o relatório lido na íntegra, vinculado ao exercício, sem id", () => {
    const rel = lerRelatorio(periodoUnico.replace(/^Condomínio:.*$/m, "Demonstrativo"));
    const anexo = novoAnexoImportado(
      "ex-1",
      "comparativo_financeiro",
      rel,
      "comparativo.pdf",
      "data:application/pdf;base64,AAAA",
      new Date("2026-10-22T00:00:00Z"),
    );
    expect(anexo).toEqual({
      exercicioId: "ex-1",
      tipo: "comparativo_financeiro",
      arquivo: "comparativo.pdf",
      arquivoDataUrl: "data:application/pdf;base64,AAAA",
      importadoEm: "2026-10-22T00:00:00.000Z",
      relatorio: rel,
    });
  });
});
