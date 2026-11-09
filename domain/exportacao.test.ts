import { describe, expect, it } from "vitest";
import { celulaTexto, conteudoCsv, numeroParaCelula } from "./exportacao";
import {
  colunasComparativoExport,
  linhasComparativoExport,
} from "./relatoriosExportacao";
import type { ResultadoComparativo, Totais } from "./previstoRealizado";

/** Achados de #145: CSV, XLSX e as colunas de saída usam a mesma fonte. */

type Linha = { nome: string; valor: number | null };

const colunas: { titulo: string; valor: (l: Linha) => string | number | null }[] = [
  { titulo: "Conta", valor: (l) => l.nome },
  { titulo: "Valor", valor: (l) => l.valor },
];

describe("#145 CSV para o Excel pt-BR", () => {
  it("começa com BOM, usa ; e CRLF e mantém número com vírgula", () => {
    const csv = conteudoCsv(colunas, [
      { nome: "Água", valor: 1234.56 },
      { nome: "Luz", valor: null },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Conta;Valor");
    expect(csv).toContain("Água;1234,56");
    expect(csv).toContain("Luz;");
    expect(csv.split("\r\n")).toHaveLength(4);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("protege campo com ; aspas ou quebra de linha", () => {
    const csv = conteudoCsv(colunas, [{ nome: 'Taxa "extra"; fundo', valor: 1 }]);
    expect(csv).toContain('"Taxa ""extra""; fundo";1');
  });

  it("não transforma texto numérico em número no CSV", () => {
    expect(numeroParaCelula("0012")).toBe(12);
    expect(numeroParaCelula("12/2026")).toBe("12/2026");
    expect(numeroParaCelula(null)).toBe("");
  });
});

describe("#145 texto das células na impressão", () => {
  it("usa a formatação da coluna quando existe e o padrão pt-BR quando não existe", () => {
    const comTexto = [{ ...colunas[1]!, texto: (l: Linha) => `R$ ${String(l.valor)}` }];
    expect(celulaTexto(comTexto[0]!, { nome: "Água", valor: 5 })).toBe("R$ 5");
    expect(celulaTexto(colunas[1]!, { nome: "Água", valor: 1234.56 })).toBe("1.234,56");
    expect(celulaTexto(colunas[1]!, { nome: "Água", valor: null })).toBe("");
  });
});

const totais = (previstoAnual: number, previsto: number, realizado: number, situacao: Totais["situacao"]): Totais => ({
  previstoAnual,
  previstoMensal: previstoAnual / 12,
  previsto,
  realizado,
  diferenca: realizado - previsto,
  pct: previsto ? ((realizado - previsto) / previsto) * 100 : null,
  situacao,
});

function comparativo(): ResultadoComparativo {
  return {
    meses: [{ posicao: 1, mes: 1, ano: 2026, rotulo: "jan/2026", relatorios: 1 }],
    mesAte: { posicao: 1, mes: 1, ano: 2026, rotulo: "jan/2026", relatorios: 1 },
    grupos: [
      {
        nome: "Pessoal",
        linhas: [
          { grupo: "Pessoal", nome: "Porteiro", tipo: "rubrica", ...totais(1200, 100, 90, "abaixo") },
          { grupo: "Pessoal", nome: "Bônus", tipo: "ajuste", sinal: "+", ...totais(100, 8.33, 0, "abaixo") },
        ],
        totais: totais(1300, 108.33, 90, "abaixo"),
      },
    ],
    deduzidas: [],
    total: totais(1300, 108.33, 90, "abaixo"),
    tolerancia: 5,
    relatoriosUsados: 1,
    avisos: [],
  };
}

describe("#145 colunas do Previsto × Realizado", () => {
  it("mantém a hierarquia da tela: contas, subtotal por grupo e total geral", () => {
    const linhas = linhasComparativoExport(comparativo());
    expect(linhas.map((l) => l.conta)).toEqual([
      "Porteiro",
      "Bônus (ajuste +)",
      "Total Pessoal",
      "Total geral",
    ]);
    expect(linhas.map((l) => l.nivel)).toEqual(["rubrica", "ajuste", "subtotal", "total"]);
    expect(linhas.at(-1)!.realizadoAte).toBe(90);
  });

  it("esconde as contas analíticas quando pedido, preservando subtotais e total", () => {
    const linhas = linhasComparativoExport(comparativo(), false);
    expect(linhas.map((l) => l.conta)).toEqual(["Total Pessoal", "Total geral"]);
  });

  it("traz a situação como texto, nunca nulo, e as colunas na ordem da tela", () => {
    const linhas = linhasComparativoExport(comparativo());
    expect(linhas[0]!.situacao).toBe("Abaixo");
    expect(colunasComparativoExport().map((c) => c.titulo)).toEqual([
      "Grupo",
      "Rubrica",
      "Previsto anual",
      "Previsto até",
      "Realizado até",
      "Diferença",
      "%",
      "Situação",
    ]);
  });
});
