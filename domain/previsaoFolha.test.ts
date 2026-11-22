import { describe, expect, it } from "vitest";
import { exercicioPorExtenso, montarFolhaPrevisao, periodoHistorico } from "./previsaoFolha";
import { calcularPrevisaoSugerida } from "./previsaoSugerida";
import { exercicioPadrao } from "./exercicio";
import { condominioPadrao } from "./condominio";
import { formatBRL } from "../lib/format";
import type { Exercicio, PrevisaoSugeridaExercicio } from "./types";

const condo = { ...condominioPadrao(), id: "c1", nome: "Urban Classic", unidades: 156 };

/** A folha 7 do balanço do Urban Classic, com os números do print. */
const urban: PrevisaoSugeridaExercicio = {
  rateioMensalAtual: 45206,
  categorias: [
    { nome: "Departamento pessoal", anual: 340642.18, media: 28386.85 },
    { nome: "Administrativas e afins", anual: 49325.05, media: 4110.42 },
    { nome: "Serviços essenciais", anual: 240289.23, media: 20024.1 },
    { nome: "Seguro e extintores", anual: 7064.61, media: 588.72 },
    { nome: "Judiciais, cartório e taxas", anual: 7450.06, media: 620.84 },
    { nome: "Manutenções", anual: 108069.96, media: 9005.83 },
    { nome: "Aquisições", anual: 16038.06, media: 1336.5 },
    { nome: "Despesas com área de lazer", anual: 6671.25, media: 555.94 },
    { nome: "Despesas diversas", anual: 980.96, media: 81.75 },
  ],
  deducoes: [{ id: "d1", descricao: "parte água e gás", sinal: "-", valor: 215592.88 }],
  variacao: { sinal: "+", valor: 30000 },
};

function exercicio(parcial: Partial<Exercicio> = {}): Exercicio {
  const e = { ...exercicioPadrao(condo, 2025, "Itajaí"), ...parcial } as Exercicio;
  e.demonstrativo = { ...e.demonstrativo, periodo: { ini: "01/11/2024", fim: "31/10/2025" } } as Exercicio["demonstrativo"];
  return e;
}

describe("montarFolhaPrevisao — a folha do Systemar", () => {
  it("reproduz o print do Urban Classic linha a linha", () => {
    const e = exercicio();
    const f = montarFolhaPrevisao(e, urban, calcularPrevisaoSugerida(urban, "truncar"));

    expect(f.titulo).toEqual([
      "PREVISÃO ORÇAMENTÁRIA ORDINÁRIA",
      "SUGERIDA PARA O EXERCÍCIO DE 2024/2025.",
    ]);
    expect(f.rateioAtual?.rotulo).toContain("Valor total do rateio ordinário mensal");
    expect(f.rateioAtual?.valor).toBe(formatBRL(45206));
    expect(f.aberturaHistorico[0]).toContain("ocorridas em 2023/2024");
    expect(f.colunas).toEqual(["efetivamente realizado", "no ano", "média mês"]);
    expect(f.categorias).toHaveLength(9);
    expect(f.totalCategorias).toEqual({
      nome: "Total das despesas do período",
      anual: formatBRL(776531.36),
      media: formatBRL(64710.95),
    });

    const valor = (trecho: string) => f.fechamento.find((l) => l.rotulo.includes(trecho))?.valor;
    expect(valor("Despesas a deduzir")).toBe(formatBRL(-215592.88));
    expect(valor("Total de despesas consideradas ordinárias")).toBe(formatBRL(560938.48));
    expect(valor("Variação de despesas sugeridas")).toBe(formatBRL(30000));
    expect(valor("Sugestão de rateio anual ordinário")).toBe(formatBRL(590938.48));
    expect(valor("Sugestão de rateio mensal ordinário")).toBe(formatBRL(49244));
    expect(valor("Índice sugerido")).toBe("8,93%");
  });

  it("usa a variante por unidade quando o PDF não traz o total mensal (Lago Negro)", () => {
    const lago: PrevisaoSugeridaExercicio = {
      rateioMensalAtual: null,
      rateioUnidadeAtual: 321,
      unidadesRateio: 156,
      categorias: [{ nome: "Departamento pessoal", anual: 218113.02, media: 18176.09 }],
      deducoes: [{ id: "d1", descricao: "pavimentação", sinal: "-", valor: 189700 }],
      variacao: { sinal: "+", valor: 30000 },
    };
    const f = montarFolhaPrevisao(exercicio(), lago, calcularPrevisaoSugerida(lago, "truncar"));
    expect(f.rateioAtual?.rotulo).toBe("Valor cobrado atualmente por unidade (156 lotes)");
    expect(f.rateioAtual?.valor).toBe(formatBRL(321));
    // Sem total mensal não há índice — a folha simplesmente não imprime a linha.
    expect(f.fechamento.some((l) => l.rotulo.includes("Índice sugerido"))).toBe(false);
  });

  it("sem rateio atual de nenhuma das duas formas, a linha não aparece", () => {
    const semRateio = { ...urban, rateioMensalAtual: null };
    const f = montarFolhaPrevisao(exercicio(), semRateio, calcularPrevisaoSugerida(semRateio));
    expect(f.rateioAtual).toBeNull();
  });

  it("não assina a folha com cidade/data (decisão de 13/11/2026)", () => {
    const f = montarFolhaPrevisao(
      exercicio({ cidade: "Rancho Queimado", dataEmissao: "30/11/2025" }),
      urban,
      calcularPrevisaoSugerida(urban),
    );
    expect(f).not.toHaveProperty("localData");
    expect(JSON.stringify(f)).not.toContain("Rancho Queimado");
  });
});

describe("notação de exercício", () => {
  it("usa o ano fiscal cruzado do período", () => {
    expect(exercicioPorExtenso(exercicio())).toBe("2024/2025");
    expect(periodoHistorico(exercicio())).toBe("2023/2024");
  });

  it("cai no ano do exercício quando o período é de um ano só ou está vazio", () => {
    const e = exercicio();
    e.demonstrativo = { ...e.demonstrativo, periodo: { ini: "01/01/2025", fim: "30/11/2025" } } as Exercicio["demonstrativo"];
    expect(exercicioPorExtenso(e)).toBe("2025");
    expect(periodoHistorico(e)).toBe("2024");
    e.demonstrativo = { ...e.demonstrativo, periodo: { ini: "", fim: "" } } as Exercicio["demonstrativo"];
    expect(exercicioPorExtenso(e)).toBe("2025");
  });
});
