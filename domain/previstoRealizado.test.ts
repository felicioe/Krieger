import { describe, expect, it } from "vitest";
import { compararPrevistoRealizado, mesesDoExercicioSeguinte, GRUPO_AJUSTES_GERAIS } from "@/domain/previstoRealizado";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { AjustePrevisao, Demonstrativo, Exercicio, Mensal } from "@/domain/types";

function demo(grupos: Demonstrativo["despesas"]["grupos"], ini = "", fim = ""): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    periodo: { ini, fim },
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  });
}

function exercicio(ajustes: AjustePrevisao[] = [], variacao = 0, ano = 2025): Exercicio {
  const anoAnterior = ano - 1;
  // Período cruza anos pra que mesesDoExercicioSeguinte gere a janela do exercício seguinte
  // (jan-dez do ano+1), onde ficam os relatórios mensais comparados na tela real.
  const ini = `01/07/${ano}`;
  const fim = `30/06/${Number(ano) + 1}`;
  return {
    id: "e1",
    condoId: "c1",
    condoNome: "Teste",
    ano,
    demonstrativo: demo(
      [
        { nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] },
        { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 24000 }, { nome: "Fundo de caixa p/ obras", valor: 12000 }] },
      ],
      ini,
      fim,
    ),
    origem: [],
    cidade: "",
    dataEmissao: "",
    rateioAtual: null,
    variacao,
    variacaoMetodo: "manual",
    variacaoParam: null,
    deducaoRegex: "fundo de caixa p/ obras",
    arredondamento: "centavos",
    confer: null,
    consid: {} as Exercicio["consid"],
    prev: { modo: "tradicional", ajustes },
  };
}

/** Base anterior (o "realizado do ano passado"), que no padrão "relatorios" é a base da previsão. */
function baseAnterior(valor = 120000): Demonstrativo {
  return demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor }] }]);
}

/** Base anterior com Manutenção (Elevadores + Pintura), usada pelo teste de pesos do realizado. */
function baseAnteriorComManutencao(): Demonstrativo {
  return demo([
    { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 100000 }, { nome: "Pintura", valor: 0 }] },
  ]);
}

/** Base anterior com grupo Manutenção, para testes de pesos e dedução (usa nomes diferentes da base padrão). */
function baseAnteriorManutencao(elevadores = 24000, fundo = 12000): Demonstrativo {
  return demo([
    { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: elevadores }, { nome: "Fundo de caixa p/ obras", valor: fundo }] },
  ]);
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

describe("previsto × realizado", () => {
  it("usa exatamente os meses do período informado na prestação", () => {
    const e = exercicio();
    e.demonstrativo!.periodo = { ini: "01/07/2025", fim: "30/06/2026" };
    const m = mesesDoExercicioSeguinte(e);
    expect(m[0]).toEqual({ mes: 7, ano: 2025 });
    expect(m[11]).toEqual({ mes: 6, ano: 2026 });
  });

  it("previsto até o mês = anual × meses ÷ 12; realizado soma os mensais até o mês escolhido", () => {
    // Janela jul/2025-jun/2026: jan/2026=pos7, fev/2026=pos8, mar/2026=pos9.
    const mensais = [mensal(1, 2026, [salarios(10000)]), mensal(2, 2026, [salarios(11000)]), mensal(3, 2026, [salarios(50000)])];
    const r = compararPrevistoRealizado(exercicio(), mensais, { mesAte: 8, demonstrativoBase: baseAnterior() });
    const l = r.grupos.find((g) => g.nome === "Pessoal")!.linhas[0]!;
    expect(l.previstoAnual).toBe(120000);
    expect(l.previstoMensal).toBe(10000);
    expect(l.previsto).toBe(80000); // 120000 × 8/12
    expect(l.realizado).toBe(21000); // março fica de fora
    expect(l.diferenca).toBe(-59000);
    expect(l.pct).toBe(-73.75);
  });

  it("situação: dentro até a tolerância; acima e abaixo fora dela", () => {
    // jan/2026 = posição 7 na janela jul/2025-jun/2026. Base = 120000 → previsto anual = 120000,
    // previsto até pos7 = 70000. Realizado = v (apenas jan). Tolerância sobre previsto até o mês.
    const comTol = (v: number, tolerancia: number) =>
      compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(v)])], {
        mesAte: 7,
        tolerancia,
        demonstrativoBase: baseAnterior(120000),
      }).grupos[0]!.linhas[0]!.situacao;
    // 70000 ± 5% = [66500, 73500]. Valor realizado em jan não fecha o previsto de 7 meses;
    // o teste valida a classificação da situação, não o valor absoluto.
    expect(comTol(70000, 5)).toBe("dentro");
    expect(comTol(74000, 5)).toBe("acima");
    expect(comTol(66000, 5)).toBe("abaixo");
    expect(comTol(70100, 0)).toBe("acima");
  });

  it("previsto = base anterior × (1 + variação%), aberto nas rubricas do realizado (sem os ajustes do rateio)", () => {
    const ajustes: AjustePrevisao[] = [
      { id: "a", descricao: "Novo porteiro", sinal: "+", valor: 12000, grupo: "Pessoal" },
    ];
    const r = compararPrevistoRealizado(exercicio(ajustes, 10), [], {
      mesAte: 12,
      demonstrativoBase: baseAnterior(100000),
    });
    expect(r.grupos.map((g) => g.nome)).toEqual(["Pessoal"]);
    expect(r.grupos[0]!.totais.previstoAnual).toBe(110000); // 100.000 × 1,10
    expect(r.total.previstoAnual).toBe(110000);
    expect(r.grupos.some((g) => g.nome === GRUPO_AJUSTES_GERAIS)).toBe(false);
  });

  it("as contas do realizado recebem o previsto do grupo pelos pesos do realizado e fecham o total", () => {
    // jan/2026 = posição 7 na janela jul/2025-jun/2026.
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{
        nome: "Manutenção",
        itens: [{ nome: "Elevadores", valor: 3000 }, { nome: "Pintura", valor: 1000 }],
      }])],
      { mesAte: 7, demonstrativoBase: baseAnteriorComManutencao() },
    );
    const manut = r.grupos.find((g) => g.nome === "Manutenção")!;
    const elev = manut.linhas.find((l) => l.nome === "Elevadores")!;
    const pint = manut.linhas.find((l) => l.nome === "Pintura")!;
    expect(elev.previstoAnual).toBe(75000);
    expect(pint.previstoAnual).toBe(25000);
    expect(manut.totais.previstoAnual).toBe(100000);
    expect(r.total.previstoAnual).toBe(100000);
  });

  it("despesas da dedução ficam fora dos totais", () => {
    const deducaoBase = demo(
      [{ nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 24000 }, { nome: "Fundo de caixa p/ obras", valor: 12000 }] }],
      // 6 meses anteriores: o exercício do relatório corre julho/2025–junho/2026; jan/2026 = pos7
    );
    // jan/2026 = posição 7 na janela jul/2025-jun/2026.
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{ nome: "Manutenção", itens: [{ nome: "Fundo de caixa p/ obras", valor: 1000 }, { nome: "Elevadores", valor: 2000 }] }])],
      { mesAte: 7, demonstrativoBase: deducaoBase },
    );
    expect(r.deduzidas.map((d) => d.nome)).toEqual(["Fundo de caixa p/ obras"]);
    expect(r.total.realizado).toBe(2000);
    expect(r.total.previstoAnual).toBe(16000); // (24000+12000)*1,00 - dedução 12000
  });

  it("rubricas casam sem acento/maiúsculas e pelo de-para do condomínio", () => {
    // jan/2026 = posição 7 na janela jul/2025-jun/2026.
    const r = compararPrevistoRealizado(
      exercicio(),
      [mensal(1, 2026, [{ nome: "PESSOAL", itens: [{ nome: "Folha de pagamento", valor: 10000 }] }])],
      { mesAte: 7, demonstrativoBase: baseAnterior(120000), condominio: { unidades: 10, mapeamento: [{ de: "Folha de pagamento", para: "Salários" }] } },
    );
    // Grupo do realizado vem como "PESSOAL" (mapeamento age só na rubrica, não no grupo).
    const pessoal = r.grupos.find((g) => g.nome.toUpperCase() === "PESSOAL")!;
    expect(pessoal.linhas).toHaveLength(1);
    expect(pessoal.linhas[0]!.nome).toBe("Salários"); // rubrica mapeada
    expect(pessoal.linhas[0]!.realizado).toBe(10000);
  });

  it("ignora outros condomínios e avisa meses sem relatório", () => {
    // jan/2026=pos7, fev/2026=pos8 na janela jul/2025-jun/2026.
    const r = compararPrevistoRealizado(exercicio(), [mensal(1, 2026, [salarios(10000)]), mensal(2, 2026, [salarios(99999)], "outro")], {
      mesAte: 8,
    });
    expect(r.total.realizado).toBe(10000);
    expect(r.avisos.some((a) => a.includes("02/2026"))).toBe(true);
  });

  it("demonstrativoBase substitui o do próprio exercício na previsão (achado do Codex no PR #170: evita divergir do editor)", () => {
    const e = exercicio();
    const outraBase = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 999999 }] }]);
    const comBase = compararPrevistoRealizado(e, [], { demonstrativoBase: outraBase });
    const semBase = compararPrevistoRealizado(e, [], {});
    expect(comBase.total.previstoAnual).toBe(999999);
    expect(semBase.total.previstoAnual).toBe(144000); // base do próprio exercício (120000 + 24000)
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
