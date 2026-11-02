import { describe, expect, it } from "vitest";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import { aplicarDecisoesImportacao, compararDemonstrativos } from "@/domain/importacao";
import type { Demonstrativo, ItemDivergenteImportacao } from "@/domain/types";

function demo(parcial: Partial<Demonstrativo>): Demonstrativo {
  return recalcularDemonstrativo({ ...demonstrativoVazio("Residencial Teste"), ...parcial });
}

describe("compararDemonstrativos", () => {
  it("atual em branco (nunca importado antes) não é conflito: lista vazia mesmo com itens no novo", () => {
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    expect(compararDemonstrativos(null, novo)).toEqual([]);
    expect(compararDemonstrativos(demonstrativoVazio(""), novo)).toEqual([]);
  });

  it("mesmo valor nos dois lados não é divergência", () => {
    const atual = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    expect(compararDemonstrativos(atual, novo)).toEqual([]);
  });

  it("valor diferente na mesma conta é divergência", () => {
    const atual = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 21000 }], subtotal: 0, totalComSaldo: 0 } });
    expect(compararDemonstrativos(atual, novo)).toEqual([
      { secao: "receitas", nome: "Taxa condominial", ocorrencia: 0, valorAtual: 20000, valorNovo: 21000 },
    ]);
  });

  it("item só no novo (valorAtual null)", () => {
    const atual = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const novo = demo({
      receitas: {
        itens: [
          { nome: "Taxa condominial", valor: 20000 },
          { nome: "Multa", valor: 500 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    expect(compararDemonstrativos(atual, novo)).toEqual([
      { secao: "receitas", nome: "Multa", ocorrencia: 0, valorAtual: null, valorNovo: 500 },
    ]);
  });

  it("item só no atual (valorNovo null, sumiu do PDF novo)", () => {
    const atual = demo({
      receitas: {
        itens: [
          { nome: "Taxa condominial", valor: 20000 },
          { nome: "Multa", valor: 500 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    expect(compararDemonstrativos(atual, novo)).toEqual([
      { secao: "receitas", nome: "Multa", ocorrencia: 0, valorAtual: 500, valorNovo: null },
    ]);
  });

  it("despesas comparam dentro do mesmo grupo — grupos diferentes não se confundem", () => {
    const atual = demo({
      despesas: {
        grupos: [{ nome: "Manutenção", itens: [{ nome: "Elevador", valor: 1000 }] }],
        subtotal: 0,
        saldoRestante: 0,
      },
    });
    const novo = demo({
      despesas: {
        grupos: [
          { nome: "Manutenção", itens: [{ nome: "Elevador", valor: 1200 }] },
          { nome: "Administração", itens: [{ nome: "Elevador", valor: 1000 }] },
        ],
        subtotal: 0,
        saldoRestante: 0,
      },
    });
    const divergentes = compararDemonstrativos(atual, novo);
    expect(divergentes).toContainEqual({ secao: "despesas", grupo: "Manutenção", nome: "Elevador", ocorrencia: 0, valorAtual: 1000, valorNovo: 1200 });
    expect(divergentes).toContainEqual({ secao: "despesas", grupo: "Administração", nome: "Elevador", ocorrencia: 0, valorAtual: null, valorNovo: 1000 });
    expect(divergentes).toHaveLength(2);
  });

  it("despesas num grupo sem nome (string vazia) preservam o grupo na divergência", () => {
    const atual = demo({
      despesas: { grupos: [{ nome: "", itens: [{ nome: "Diversos", valor: 100 }] }], subtotal: 0, saldoRestante: 0 },
    });
    const novo = demo({
      despesas: { grupos: [{ nome: "", itens: [{ nome: "Diversos", valor: 150 }] }], subtotal: 0, saldoRestante: 0 },
    });
    expect(compararDemonstrativos(atual, novo)).toEqual([
      { secao: "despesas", grupo: "", nome: "Diversos", ocorrencia: 0, valorAtual: 100, valorNovo: 150 },
    ]);
  });

  it("duas contas com o mesmo nome na mesma seção comparam por ocorrência, não todas juntas", () => {
    const atual = demo({
      receitas: {
        itens: [
          { nome: "Juros", valor: 100 },
          { nome: "Juros", valor: 200 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    const novo = demo({
      receitas: {
        itens: [
          { nome: "Juros", valor: 100 },
          { nome: "Juros", valor: 900 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    // A 1ª ocorrência (100 x 100) não diverge; só a 2ª (200 x 900) — nunca as duas juntas.
    expect(compararDemonstrativos(atual, novo)).toEqual([
      { secao: "receitas", nome: "Juros", ocorrencia: 1, valorAtual: 200, valorNovo: 900 },
    ]);
  });
});

describe("aplicarDecisoesImportacao", () => {
  it("sem decisões de 'manter', devolve o novo como veio", () => {
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 21000 }], subtotal: 0, totalComSaldo: 0 } });
    const resultado = aplicarDecisoesImportacao(null, novo, []);
    expect(resultado.receitas.itens).toEqual([{ nome: "Taxa condominial", valor: 21000 }]);
  });

  it("'manter' num item com valor nos dois lados restaura o valor antigo", () => {
    const atual = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 21000 }], subtotal: 0, totalComSaldo: 0 } });
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "receitas", nome: "Taxa condominial", ocorrencia: 0, valorAtual: 20000, valorNovo: 21000, escolha: "manter" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.receitas.itens).toEqual([{ nome: "Taxa condominial", valor: 20000 }]);
    expect(resultado.totais.receitas).toBe(20000);
  });

  it("'atualizar' mantém o valor novo do PDF", () => {
    const atual = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 21000 }], subtotal: 0, totalComSaldo: 0 } });
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "receitas", nome: "Taxa condominial", ocorrencia: 0, valorAtual: 20000, valorNovo: 21000, escolha: "atualizar" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.receitas.itens).toEqual([{ nome: "Taxa condominial", valor: 21000 }]);
  });

  it("'manter' num item que só existia no novo (valorAtual null) remove o item do resultado", () => {
    const atual = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const novo = demo({
      receitas: {
        itens: [
          { nome: "Taxa condominial", valor: 20000 },
          { nome: "Multa", valor: 500 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "receitas", nome: "Multa", ocorrencia: 0, valorAtual: null, valorNovo: 500, escolha: "manter" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.receitas.itens).toEqual([{ nome: "Taxa condominial", valor: 20000 }]);
  });

  it("'manter' num item que sumiu do novo (valorNovo null) devolve o item ao resultado", () => {
    const atual = demo({
      receitas: {
        itens: [
          { nome: "Taxa condominial", valor: 20000 },
          { nome: "Multa", valor: 500 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    const novo = demo({ receitas: { itens: [{ nome: "Taxa condominial", valor: 20000 }], subtotal: 0, totalComSaldo: 0 } });
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "receitas", nome: "Multa", ocorrencia: 0, valorAtual: 500, valorNovo: null, escolha: "manter" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.receitas.itens).toContainEqual({ nome: "Multa", valor: 500 });
    expect(resultado.receitas.itens).toContainEqual({ nome: "Taxa condominial", valor: 20000 });
  });

  it("'manter' um grupo de despesa inteiro que sumiu do novo recria o grupo", () => {
    const atual = demo({
      despesas: {
        grupos: [{ nome: "Manutenção", itens: [{ nome: "Elevador", valor: 1000 }] }],
        subtotal: 0,
        saldoRestante: 0,
      },
    });
    const novo = demo({ despesas: { grupos: [], subtotal: 0, saldoRestante: 0 } });
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "despesas", grupo: "Manutenção", nome: "Elevador", ocorrencia: 0, valorAtual: 1000, valorNovo: null, escolha: "manter" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.despesas.grupos).toEqual([{ nome: "Manutenção", itens: [{ nome: "Elevador", valor: 1000 }] }]);
  });

  it("'manter' numa despesa de grupo sem nome (string vazia) funciona — não se perde por undefined", () => {
    const atual = demo({
      despesas: { grupos: [{ nome: "", itens: [{ nome: "Diversos", valor: 100 }] }], subtotal: 0, saldoRestante: 0 },
    });
    const novo = demo({ despesas: { grupos: [{ nome: "", itens: [] }], subtotal: 0, saldoRestante: 0 } });
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "despesas", grupo: "", nome: "Diversos", ocorrencia: 0, valorAtual: 100, valorNovo: null, escolha: "manter" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.despesas.grupos).toEqual([{ nome: "", itens: [{ nome: "Diversos", valor: 100 }] }]);
  });

  it("decide cada ocorrência de contas com o mesmo nome de forma independente", () => {
    const atual = demo({
      receitas: {
        itens: [
          { nome: "Juros", valor: 100 },
          { nome: "Juros", valor: 200 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    const novo = demo({
      receitas: {
        itens: [
          { nome: "Juros", valor: 100 },
          { nome: "Juros", valor: 900 },
        ],
        subtotal: 0,
        totalComSaldo: 0,
      },
    });
    // Só a 2ª ocorrência diverge; "manter" nela não deve mexer na 1ª.
    const decisao: (ItemDivergenteImportacao & { escolha: "manter" | "atualizar" })[] = [
      { secao: "receitas", nome: "Juros", ocorrencia: 1, valorAtual: 200, valorNovo: 900, escolha: "manter" },
    ];
    const resultado = aplicarDecisoesImportacao(atual, novo, decisao);
    expect(resultado.receitas.itens).toEqual([
      { nome: "Juros", valor: 100 },
      { nome: "Juros", valor: 200 },
    ]);
  });
});
