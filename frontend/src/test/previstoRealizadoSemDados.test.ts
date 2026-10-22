import { describe, expect, it, vi } from "vitest";
import { compararPrevistoRealizado } from "@/domain/previstoRealizado";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { Demonstrativo, Exercicio, Mensal } from "@/domain/types";
import type { Bloco } from "@/lib/documento/tipos";
import { semRealizado, textoSemRealizado } from "@/components/previsto-realizado/semRealizado";

vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

/** Caso Urban Classic: exercício 01/09/2025–31/08/2026; a comparação olha 09/2026–08/2027. */
function demo(grupos: Demonstrativo["despesas"]["grupos"], ini: string, fim: string): Demonstrativo {
  return recalcularDemonstrativo({ ...demonstrativoVazio("Urban"), periodo: { ini, fim }, despesas: { grupos, subtotal: 0, saldoRestante: 0 } });
}
const exercicio = {
  id: "e1", condoId: "c1", condoNome: "Urban Classic", ano: 2025,
  demonstrativo: demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }, { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 24000 }] }], "01/09/2025", "31/08/2026"),
  origem: [], cidade: "", dataEmissao: "", rateioAtual: null, variacao: 0, variacaoMetodo: "manual", variacaoParam: null,
  deducaoRegex: "", arredondamento: "centavos", confer: null, consid: {} as Exercicio["consid"], prev: { modo: "tradicional", ajustes: [] },
} as Exercicio;
const mensal = (grupos: Demonstrativo["despesas"]["grupos"]): Mensal => ({
  id: "m1", condoId: "c1", condoNome: "Urban Classic", demonstrativo: demo(grupos, "01/09/2026", "30/09/2026"),
  origem: [], receber: { unidades: null, valor: null }, notas: [],
});

const textos = (b: Bloco[]) => b.filter((x) => x.tipo === "paragrafo").map((x) => JSON.stringify(x));
const temTabelaComparativo = (b: Bloco[]) => b.some((x) => x.tipo === "tabela" && x.colunas.some((c) => c.titulo === "Rubrica"));

describe("Previsto × Realizado sem relatório mensal no período", () => {
  it("sem nenhum relatório, a mensagem cita o período de comparação 09/2026 a 08/2027", () => {
    const r = compararPrevistoRealizado(exercicio, []);
    expect(semRealizado(r)).toBe(true);
    expect(textoSemRealizado(r)).toContain("(09/2026 a 08/2027)");
  });

  it("PDF/Word: sem relatório, troca a tabela por rubrica e o gráfico pela mensagem e não mostra −100%", async () => {
    const { documentoPrevistoRealizado } = await import("@/documentos/previstoRealizado");
    const c = compararPrevistoRealizado(exercicio, []);
    const doc = await documentoPrevistoRealizado({ comparativo: c, exercicio, condominio: null, escritorio: null });
    expect(temTabelaComparativo(doc.blocos)).toBe(false);
    expect(doc.blocos.some((x) => x.tipo === "imagem")).toBe(false);
    expect(textos(doc.blocos).some((t) => t.includes("Ainda não há relatório mensal"))).toBe(true);
    expect(JSON.stringify(doc.blocos)).not.toContain("100,00%");
  });

  it("PDF/Word: com um relatório, a tabela e o gráfico voltam, inclusive a rubrica sem despesa com −100%", async () => {
    const { documentoPrevistoRealizado } = await import("@/documentos/previstoRealizado");
    const c = compararPrevistoRealizado(exercicio, [mensal([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 10000 }] }])], { mesAte: 1 });
    expect(semRealizado(c)).toBe(false);
    const doc = await documentoPrevistoRealizado({ comparativo: c, exercicio, condominio: null, escritorio: null });
    expect(temTabelaComparativo(doc.blocos)).toBe(true);
    expect(doc.blocos.some((x) => x.tipo === "imagem")).toBe(true);
    // Elevadores previsto e sem despesa no mês: divergência real, continua aparecendo.
    expect(JSON.stringify(doc.blocos)).toContain("100,00%");
  });
});

describe("Relatório final sem relatório mensal no período", () => {
  it("seções Previsto × Realizado e Análise gráfica mostram a mensagem; a pizza do exercício continua", async () => {
    const { montarRelatorioFinal } = await import("@/domain/relatorioFinal");
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const { normalizarExercicio } = await import("@/domain/exercicio");
    const todas = normalizarExercicio({ ...exercicio, consid: undefined, mostrarAnalise: true, relatorioFinal: { secoes: {} } } as unknown as Exercicio);
    const { normalizarCondominio } = await import("@/domain/condominio");
    const condominio = normalizarCondominio({ id: "c1", nome: "Urban Classic" } as Parameters<typeof normalizarCondominio>[0]);
    const rel = montarRelatorioFinal({ exercicio: todas, condominio, escritorio: null, mensais: [] });
    const doc = await documentoRelatorioFinal({ rel, exercicio: todas, condominio, escritorio: null });
    expect(temTabelaComparativo(doc.blocos)).toBe(false);
    expect(textos(doc.blocos).filter((t) => t.includes("Ainda não há relatório mensal"))).toHaveLength(2);
    expect(doc.blocos.filter((x) => x.tipo === "imagem")).toHaveLength(1); // só a pizza
  });
});
