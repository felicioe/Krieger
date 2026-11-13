import { describe, expect, it, vi } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import { formatBRL } from "@/lib/format";
import type { Bloco } from "@/lib/documento/tipos";
import type { Condominio, Exercicio, PrevisaoSugeridaExercicio } from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 10 };

type Tabela = Extract<Bloco, { tipo: "tabela" }>;
type Guiada = Extract<Bloco, { tipo: "linhaGuiada" }>;
type Paragrafo = Extract<Bloco, { tipo: "paragrafo" }>;

/** Previsão sugerida do Systemar, como sai da folha 7 do balanço (números do Urban Classic). */
const sugerida: PrevisaoSugeridaExercicio = {
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

describe("Previsão orçamentária no relatório final: a folha do Systemar", () => {
  async function gerar(parcial: Partial<Exercicio> = {}) {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = {
      id: "e1",
      ...exercicioPadrao(condo, 2025, "Itajaí"),
      arredondamento: "truncar" as const,
      previsaoSugerida: sugerida,
      ...parcial,
    } as Exercicio;
    e.demonstrativo = {
      ...e.demonstrativo,
      periodo: { ini: "01/11/2024", fim: "31/10/2025" },
    } as Exercicio["demonstrativo"];
    e.relatorioFinal = { ...e.relatorioFinal, secoes: {} };
    const rel = montarRelatorioFinal({
      exercicio: e,
      condominio: condo,
      escritorio: null,
      mensais: [],
    });
    const doc = await documentoRelatorioFinal({
      rel,
      exercicio: e,
      condominio: condo,
      escritorio: null,
    });
    return { rel, doc };
  }

  it("imprime a folha: rateio atual, histórico por categoria e o fechamento com o índice", async () => {
    const { doc } = await gerar();
    const guiadas = doc.blocos.filter((b): b is Guiada => b.tipo === "linhaGuiada");
    expect(guiadas.length).toBeGreaterThanOrEqual(2);

    // Primeiro bloco guiado: o rateio atual, com o total mensal do condomínio.
    expect(guiadas[0]!.itens[0]!.rotulo).toContain("Valor total do rateio ordinário mensal");
    expect(guiadas[0]!.itens[0]!.valor).toBe(formatBRL(45206));

    // Fechamento: dedução, total ordinário, variação, rateio anual, mensal e índice.
    const fechamento = guiadas.at(-1)!.itens;
    const valor = (trecho: string) => fechamento.find((i) => i.rotulo.includes(trecho))?.valor;
    expect(valor("Despesas a deduzir")).toBe(formatBRL(-215592.88));
    expect(valor("Total de despesas consideradas ordinárias")).toBe(formatBRL(560938.48));
    expect(valor("Variação de despesas sugeridas")).toBe(formatBRL(30000));
    expect(valor("Sugestão de rateio anual ordinário")).toBe(formatBRL(590938.48));
    // Truncado, como a folha: 590.938,48 ÷ 12 = 49.244,87 → 49.244,00.
    expect(valor("Sugestão de rateio mensal ordinário")).toBe(formatBRL(49244));
    expect(valor("Índice sugerido")).toBe("8,93%");
  });

  it("a tabela de categorias é a do histórico, com o total do período no rodapé", async () => {
    const { doc } = await gerar();
    const tabela = doc.blocos.find(
      (b): b is Tabela => b.tipo === "tabela" && b.colunas.some((c) => c.titulo === "no ano"),
    );
    expect(tabela, "tabela do histórico").toBeDefined();
    expect(tabela!.linhas).toHaveLength(sugerida.categorias.length + 1);
    const total = tabela!.linhas.at(-1)!;
    expect(total.estilo).toBe("total");
    expect(total.celulas[0]).toBe("Total das despesas do período");
    expect(total.celulas[1]).toBe(formatBRL(776531.36));
    expect(total.celulas[2]).toBe(formatBRL(64710.95));
  });

  it("o título usa a notação de exercício cruzado do período (2024/2025)", async () => {
    const { doc } = await gerar();
    const titulos = doc.blocos
      .filter((b): b is Paragrafo => b.tipo === "paragrafo" && b.alinhamento === "centro")
      .map((b) => String(b.texto));
    expect(titulos).toContain("PREVISÃO ORÇAMENTÁRIA ORDINÁRIA");
    expect(titulos).toContain("SUGERIDA PARA O EXERCÍCIO DE 2024/2025.");
  });

  it("sem previsão sugerida importada, explica em vez de imprimir números inventados", async () => {
    const { doc } = await gerar({ previsaoSugerida: null });
    const texto = doc.blocos
      .filter((b): b is Paragrafo => b.tipo === "paragrafo")
      .map((b) => String(b.texto))
      .join(" ");
    expect(texto).toContain("não tem a previsão orçamentária sugerida importada");
    expect(doc.blocos.some((b) => b.tipo === "linhaGuiada")).toBe(false);
  });

  it("o cálculo do Krieger não é mais impresso nesta seção (sem dois demonstrativos)", async () => {
    const { doc } = await gerar();
    const texto = doc.blocos
      .filter((b): b is Paragrafo => b.tipo === "paragrafo")
      .map((b) => String(b.texto))
      .join(" ");
    expect(texto).not.toContain("Previsão calculada pelo Krieger");
    expect(texto).not.toContain("Referência histórica importada do Systemar");
    const tabela = doc.blocos.find(
      (b): b is Tabela =>
        b.tipo === "tabela" && b.colunas.some((c) => c.titulo === "Média prevista dos grupos"),
    );
    expect(tabela).toBeUndefined();
  });
});
