import { describe, expect, it } from "vitest";
import { lerRelatorio } from "@/domain/pdfParser";
import { textoComLayout, type ItemTexto } from "@/domain/layoutTexto";
import {
  COLUNA_TOTAL,
  anoDoRelatorio,
  camposFaltando,
  colunaPadrao,
  demonstrativoDoRelatorio,
  encontrarCondominio,
  novaImportacao,
  resumoConferencia,
} from "@/domain/importacao";

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

  it("lê as contas a receber", () => {
    expect(rel.contasAReceber).toEqual({ ate: "2026-08-31", unidades: 3, total: 1500 });
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
    { id: "a", codigo: "73", cnpj: "" },
    { id: "b", codigo: "", cnpj: "98.765.432/0001-10" },
  ];

  it("encontra pelo mesmo código (com ou sem zeros à esquerda)", () => {
    expect(encontrarCondominio(condos, { codigo: "073", cnpj: null })?.id).toBe("a");
  });

  it("encontra pelo mesmo CNPJ", () => {
    expect(encontrarCondominio(condos, { codigo: "999", cnpj: "98765432000110" })?.id).toBe("b");
  });

  it("sem correspondência, vai para o staging como pendente", () => {
    const rel = lerRelatorio(periodoUnico.replace(/^Condomínio:.*$/m, "Demonstrativo"));
    expect(encontrarCondominio(condos, rel.condominio)).toBeNull();
    const imp = novaImportacao(rel, "x.pdf", "mensais", null, null, new Date("2026-10-20T00:00:00Z"));
    expect(imp).toMatchObject({ status: "pendente", arquivo: "x.pdf", importadoEm: "2026-10-20T00:00:00.000Z", condominioId: null });
    expect(imp.cadastro.revisar).toBe(true);
    expect(camposFaltando(imp.cadastro)).toEqual(["codigo", "nome", "cnpj"]);
  });
});
