import { describe, expect, it, vi } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { assembleiaPadrao } from "@/domain/edital";
import { exercicioPadrao } from "@/domain/exercicio";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import type { Condominio, Modelo } from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
  paraPng: async () => "data:image/png;base64,AAAA",
}));

const condo: Condominio = {
  ...condominioPadrao(),
  id: "c1",
  codigo: "243",
  nome: "Lago Negro",
  nomeRelatorio: "Condomínio Rural Lago Negro",
  enderecoEdital: "Rua Augusto Wolf, s/n, Vargedo, Rancho Queimado/SC",
  unidades: 120,
};

const modeloEdital: Modelo = {
  id: "m1",
  condoId: "",
  nome: "Padrão",
  versao: 1,
  pautaOrdinaria: ["Prestação de contas;", "Assuntos gerais."],
  blocos: [{ id: "b1", tipo: "titulo", texto: "EDITAL DE CONVOCAÇÃO", cond: "" }],
};

/** Extrai o `defaultStyle` da definição que vai para o pdfmake. */
type DefaultStyle = { font?: string; fontSize?: number };

describe("edital e relatórios mantêm a tipografia da interface", () => {
  it("o edital não pede a família de documento e sai em Source Sans 3 / 10 pt", async () => {
    const { documentoEdital } = await import("@/documentos/edital");
    const { montarDefinicao } = await import("@/lib/documento/pdf");
    const { tipografia } = await import("@/lib/documento/tipografia");

    const assembleia = {
      id: "a-edital",
      ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10", modelo: modeloEdital }),
    };
    const doc = documentoEdital({
      assembleia,
      condominio: condo,
      modelo: modeloEdital,
      escritorio: null,
    });

    expect(doc.fonte).toBeUndefined();
    expect(doc.tamanhoCorpo).toBeUndefined();

    const t = tipografia(doc);
    expect(t.familiaPdf).toBe("SourceSans3");
    expect(t.familiaWord).toBe("Calibri");
    expect(t.corpo).toBe(10);

    const definicao = await montarDefinicao(doc);
    const estilo = definicao.defaultStyle as DefaultStyle;
    expect(estilo.font).toBe("SourceSans3");
    expect(estilo.fontSize).toBe(10);
    // Os tamanhos de título do edital são os de sempre.
    expect(t.titulo).toEqual({ 1: 15, 2: 12, 3: 10.5 });
    expect(t.paragrafo).toEqual({ normal: 10, pequeno: 8.5, grande: 13 });
  });

  it("o relatório final continua em Source Sans 3 / 10 pt", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const { montarDefinicao } = await import("@/lib/documento/pdf");

    const e = { id: "e1", ...exercicioPadrao(condo, 2025, "Rancho Queimado") };
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

    expect(doc.fonte).toBeUndefined();
    const definicao = await montarDefinicao(doc);
    const estilo = definicao.defaultStyle as DefaultStyle;
    expect(estilo.font).toBe("SourceSans3");
    expect(estilo.fontSize).toBe(10);
  });
});
