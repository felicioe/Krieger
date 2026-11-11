import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import type { Ata, Condominio } from "@/domain/types";
import type { Documento } from "@/lib/documento/tipos";

const condo: Condominio = {
  ...condominioPadrao(),
  id: "c1",
  codigo: "243",
  nome: "Lago Negro",
  nomeRelatorio: "Condomínio Rural Lago Negro",
  cnpj: "19.741.383/0001-87",
  enderecoEdital: "Rua Augusto Wolf, s/n, Vargedo, Rancho Queimado/SC",
  unidades: 120,
};

const ata: Ata = {
  id: "a1",
  condoId: "c1",
  assembleiaId: "as1",
  tipo: "ordinaria",
  data: "2025-12-13",
  hora: "09:00",
  modalidade: "presencial",
  local: "nas dependências do condomínio",
  mesa: { presidente: "Roberto Fuck de Almeida", secretario: "Alexandre Krieger" },
  presentes: [],
  quorum: { unidadesPresentes: 24, totalUnidades: 120 },
  itens: [],
  encerramento: "",
  observacoes: "",
  status: "finalizada",
};

const base = (extra: Partial<Documento> = {}): Documento => ({
  titulo: "Documento",
  arquivo: "documento",
  timbre: null,
  blocos: [{ tipo: "paragrafo", texto: "Texto" }],
  ...extra,
});

describe("tipografia do documento", () => {
  it("mantém a tipografia da interface quando o documento não pede outra", async () => {
    const { tipografia } = await import("@/lib/documento/tipografia");
    const t = tipografia(base());
    expect(t.familiaPdf).toBe("SourceSans3");
    expect(t.familiaWord).toBe("Calibri");
    expect(t.corpo).toBe(10);
    expect(t.titulo).toEqual({ 1: 15, 2: 12, 3: 10.5 });
    expect(t.paragrafo).toEqual({ normal: 10, pequeno: 8.5, grande: 13 });
    expect(t.rodapeEscritorio).toBe(true);
  });

  it("usa Liberation Sans em 12 pt para documento de cartório e escala os títulos", async () => {
    const { tipografia } = await import("@/lib/documento/tipografia");
    const t = tipografia(base({ fonte: "documento", tamanhoCorpo: 12 }));
    expect(t.familiaPdf).toBe("LiberationSans");
    expect(t.familiaWord).toBe("Arial");
    expect(t.corpo).toBe(12);
    expect(t.titulo).toEqual({ 1: 18, 2: 14.4, 3: 12.6 });
    expect(t.paragrafo).toEqual({ normal: 12, pequeno: 10.2, grande: 15.6 });
  });

  it("suprime o texto de rodapé do escritório quando o documento pede", async () => {
    const { tipografia } = await import("@/lib/documento/tipografia");
    expect(tipografia(base({ rodapeEscritorio: false })).rodapeEscritorio).toBe(false);
  });
});

describe("documento da ata com modelo", () => {
  it("pede a tipografia de documento e mantém a borda sem o logo do escritório", async () => {
    const { documentoAta } = await import("@/documentos/ata");
    const { tipografia } = await import("@/lib/documento/tipografia");
    const escritorio = { id: "escritorio" as const, nome: "Krieger", cidade: "", rodape: "", assinatura: "", logo: "data:image/png;base64,AA", logoRatio: 3 };
    const doc = documentoAta({ ata, condominio: condo, cidade: "Rancho Queimado", escritorio, modelo: { texto: "# ATA DA ASSEMBLEIA GERAL ORDINÁRIA\n\nCorpo.", logoEscritorio: false, bordaPagina: true } });

    expect(doc.fonte).toBe("documento");
    expect(doc.tamanhoCorpo).toBe(12);
    expect(doc.bordaPagina).toBe(true);
    expect(doc.timbre).toBeNull();
    expect(doc.rodapeEscritorio).toBe(false);

    const t = tipografia(doc);
    expect(t.familiaPdf).toBe("LiberationSans");
    expect(t.corpo).toBe(12);
  });

  it("sem logo do escritório, a definição do PDF não traz texto de rodapé nem timbre, mas numera as páginas", async () => {
    const { documentoAta } = await import("@/documentos/ata");
    const { montarDefinicao } = await import("@/lib/documento/pdf");
    // Escritório COM rodapé configurado: o teste prova que ele não vaza para a ata.
    const escritorio = {
      id: "escritorio" as const,
      nome: "Krieger",
      cidade: "Rancho Queimado",
      rodape: "Escritório Krieger · CNPJ 00.000.000/0001-00",
      assinatura: "",
      logo: "data:image/png;base64,AA",
      logoRatio: 3,
    };
    const doc = documentoAta({ ata, condominio: condo, cidade: "Rancho Queimado", escritorio, modelo: { texto: "# ATA\n\nCorpo.", logoEscritorio: false, bordaPagina: true } });

    const definicao = await montarDefinicao(doc);
    const texto = JSON.stringify(definicao);

    expect(doc.timbre).toBeNull();
    expect(texto).not.toContain("Escritório Krieger");
    expect(texto).not.toContain("CNPJ 00.000.000/0001-00");

    // A numeração de páginas é do documento e continua existindo (o footer é função,
    // por isso não aparece no JSON: chamamos como o pdfmake chama).
    const rodape = definicao.footer as (pagina: number, total: number) => { columns: { text: string }[] };
    const primeiro = rodape(1, 3).columns.map((c) => c.text);
    expect(primeiro.some((t) => t.includes("Página 1 de 3"))).toBe(true);
    expect(primeiro.join(" ")).not.toContain("Escritório Krieger");
    // A borda de página continua sendo desenhada (background é função também).
    expect(typeof (definicao as { background?: unknown }).background).toBe("function");

    const estilo = definicao.defaultStyle as { font?: string; fontSize?: number };
    expect(estilo.font).toBe("LiberationSans");
    expect(estilo.fontSize).toBe(12);
  });
});
