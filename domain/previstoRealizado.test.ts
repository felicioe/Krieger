import { describe, expect, it } from "vitest";
import { compararPrevistoRealizado, mesesDoExercicioSeguinte } from "@/domain/previstoRealizado";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { Demonstrativo, Exercicio, HistoricoRateio, Mensal } from "@/domain/types";

function demo(grupos: Demonstrativo["despesas"]["grupos"], ini = "", fim = ""): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    periodo: { ini, fim },
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  });
}

function exercicio(variacao = 0): Exercicio {
  return {
    id: "e1",
    condoId: "c1",
    condoNome: "Teste",
    ano: 2026,
    demonstrativo: demo(
      [
        { nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] },
        { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 24000 }, { nome: "Fundo de caixa p/ obras", valor: 12000 }] },
      ],
      "01/01/2026",
      "31/12/2026",
    ),
    origem: [],
    cidade: "",
    dataEmissao: "",
    rateioAtual: null,
    variacao,
    variacaoMetodo: "manual",
    variacaoParam: null,
    deducaoRegex: "",
    arredondamento: "centavos",
    confer: null,
    consid: {} as Exercicio["consid"],
    prev: { modo: "tradicional", ajustes: [] },
  };
}

function mensal(mes: number, ano: number, grupos: Demonstrativo["despesas"]["grupos"], condoId = "c1"): Mensal {
  const mm = String(mes).padStart(2, "0");
  return {
    id: `m${ano}${mm}`,
    condoId,
    condoNome: "Teste",
    demonstrativo: demo(grupos, `01/${mm}/${ano}`, `28/${mm}/${ano}`),
    origem: [],
    receber: { unidades: null, valor: null },
    notas: [],
  };
}

const salarios = (v: number) => ({ nome: "Pessoal", itens: [{ nome: "Salários", valor: v }] });

// Exercício anterior (2025): realizado de origem do previsto aprovado.
const BASE = demo(
  [
    { nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] },
    { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 24000 }, { nome: "Fundo de caixa p/ obras", valor: 12000 }] },
  ],
  "01/01/2025",
  "31/12/2025",
);

// Histórico de rateios: percentual aprovado no ano-base (2025) para o exercício 2026.
const hist = (variacao: number): HistoricoRateio[] => [
  { id: "h1", condoId: "c1", ano: 2025, rateioAtual: null, rateioSugerido: null, variacao, rateioAprovado: 1, travadoEm: "", fonte: "calculo", exercicioId: null },
];
const com = (pct = 0) => ({ demonstrativoBase: BASE, historicoRateios: hist(pct) });

describe("previsto × realizado", () => {
  it("usa exatamente os meses do período informado na prestação", () => {
    const e = exercicio();
    e.demonstrativo!.periodo = { ini: "01/07/2025", fim: "30/06/2026" };
    const m = mesesDoExercicioSeguinte(e);
    expect(m[0]).toEqual({ mes: 7, ano: 2025 });
    expect(m[11]).toEqual({ mes: 6, ano: 2026 });
  });

  it("previsto até o mês = anual × meses ÷ 12; realizado soma os mensais até o mês escolhido", () => {
    const mensais = [mensal(1, 2026, [salarios(10000)]), mensal(2, 2026, [salarios(11000)]), mensal(3, 2026, [salarios(50000)])];
    const r = compararPrevistoRealizado(exercicio(), mensais, { mesAte: 2, ...com(0) });
    const l = r.grupos.find((g) => g.nome === "Pessoal")!.linhas[0]!;
    expect(l.previstoAnual).toBe(120000);
    expect(l.previstoMensal).toBe(10000);
    expect(l.previsto).toBe(20000);
    expect(l.realizado).toBe(21000); // março fica de fora
    expect(l.diferenca).toBe(1000);
    expect(l.pct).toBe(5); // (realizado − previsto) ÷ previsto
  });

  it("situação: dentro até a tolerância; acima e abaixo fora dela", () => {
    const comTol = (v: number, tolerancia: number) =>
      compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(v)])], { mesAte: 1, tolerancia, ...com(0) }).grupos[0]!.linhas[0]!.situacao;
    expect(comTol(10500, 5)).toBe("dentro");
    expect(comTol(10600, 5)).toBe("acima");
    expect(comTol(9400, 5)).toBe("abaixo");
    expect(comTol(10100, 0)).toBe("acima");
  });

  it("o previsto é o simples: realizado do ano anterior × (1 + % do histórico), sem dedução nem ajustes", () => {
    const e = exercicio();
    e.prev = { modo: "tradicional", ajustes: [{ id: "a", descricao: "Novo porteiro", sinal: "+", valor: 12000, grupo: "Pessoal" }] };
    e.deducaoRegex = "fundo de caixa p/ obras";
    const r = compararPrevistoRealizado(e, [], { mesAte: 12, ...com(10) });
    const pessoal = r.grupos.find((g) => g.nome === "Pessoal")!;
    expect(pessoal.totais.previstoAnual).toBe(132000);
    // (120.000 + 24.000 + 12.000) × 1,10 — a conta "fundo de caixa" não é deduzida
    expect(r.total.previstoAnual).toBe(171600);
    expect(r.deduzidas).toEqual([]);
    expect(r.grupos.some((g) => g.nome === "Ajustes gerais")).toBe(false);
  });

  it("percentual do histórico prevalece sobre a variação do exercício", () => {
    const r = compararPrevistoRealizado(exercicio(99), [], com(10));
    expect(r.percentualPrevisto).toBe(10);
    expect(r.grupos.find((g) => g.nome === "Pessoal")!.totais.previstoAnual).toBe(132000);
  });

  it("sem exercício anterior não há previsão aprovada: sem previsto, percentual nem situação", () => {
    const r = compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(10000)])], { mesAte: 1, historicoRateios: hist(10) });
    expect(r.situacaoPrevisto).toBe("sem_base");
    expect(r.total.previstoAnual).toBe(0);
    expect(r.total.realizado).toBe(10000);
    expect(r.total.pct).toBeNull();
    expect(r.total.situacao).toBeNull();
  });

  it("sem percentual aprovado o previsto fica pendente", () => {
    const r = compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(10000)])], { mesAte: 1, demonstrativoBase: BASE });
    expect(r.situacaoPrevisto).toBe("sem_percentual");
    expect(r.total.previstoAnual).toBe(0);
    expect(r.total.situacao).toBeNull();
  });

  it("conta prevista sem despesa continua no relatório; conta nova com despesa é sinalizada", () => {
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 10000 }, { nome: "Rescisão", valor: 500 }] }])],
      { mesAte: 1, ...com(0) },
    );
    const manut = r.grupos.find((g) => g.nome === "Manutenção")!;
    expect(manut.linhas.find((l) => l.nome === "Elevadores")!.realizado).toBe(0);
    const resc = r.grupos.find((g) => g.nome === "Pessoal")!.linhas.find((l) => l.nome === "Rescisão")!;
    expect(resc.semPrevisaoConta).toBe(true);
    expect(resc.previstoAnual).toBe(0);
  });

  it("rubricas casam sem acento/maiúsculas e pelo de-para do condomínio", () => {
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{ nome: "PESSOAL", itens: [{ nome: "Folha de pagamento", valor: 10000 }] }])],
      { mesAte: 1, ...com(0), condominio: { unidades: 10, mapeamento: [{ de: "Folha de pagamento", para: "Salários" }] } },
    );
    const pessoal = r.grupos.find((g) => g.nome === "Pessoal")!;
    expect(pessoal.linhas).toHaveLength(1);
    expect(pessoal.linhas[0]!.realizado).toBe(10000);
  });

  it("ignora outros condomínios e avisa meses sem relatório", () => {
    const r = compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(10000)]), mensal(2, 2026, [salarios(99999)], "outro")], {
      mesAte: 2,
      ...com(0),
    });
    expect(r.total.realizado).toBe(10000);
    expect(r.avisos.some((a) => a.includes("02/2026"))).toBe(true);
  });

  // Regressão: a janela pode ter menos de 12 meses (período da prestação menor que um ano).
  // `posAte` era limitado a 12 e `meses[posAte - 1]` ficava indefinido, quebrando a tela do
  // relatório final com "Cannot read properties of undefined (reading 'rotulo')".
  describe("janela menor que 12 meses", () => {
    const comPeriodo = (ini: string, fim: string): Exercicio => ({
      ...exercicio(),
      demonstrativo: demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }], ini, fim),
    });

    it("sem relatórios, mesAte é o último mês da janela e não estoura", () => {
      const r = compararPrevistoRealizado(comPeriodo("01/01/2025", "30/06/2025"), []);
      expect(r.meses).toHaveLength(6);
      expect(r.mesAte.posicao).toBe(6);
      expect(r.mesAte.rotulo).toBe("06/2025");
    });

    it("prAte salvo maior que a janela é limitado ao último mês existente", () => {
      const r = compararPrevistoRealizado(comPeriodo("01/01/2025", "31/03/2025"), [], { mesAte: 12 });
      expect(r.meses).toHaveLength(3);
      expect(r.mesAte.posicao).toBe(3);
      expect(r.mesAte.rotulo).toBe("03/2025");
    });

    it("prAte zero cai no primeiro mês", () => {
      const r = compararPrevistoRealizado(comPeriodo("01/01/2025", "31/03/2025"), [], { mesAte: 0 });
      expect(r.mesAte.posicao).toBe(1);
      expect(r.mesAte.rotulo).toBe("01/2025");
    });
  });
});
