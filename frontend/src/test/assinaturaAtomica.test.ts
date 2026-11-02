import { describe, expect, it, vi } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import type { Bloco } from "@/lib/documento/tipos";
import type { Ata, Condominio, Exercicio } from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 10 };

/**
 * Local/data e assinatura precisam estar no MESMO bloco "assinaturas" (não um parágrafo separado
 * antes) — é isso que garante, em pdf.ts/word.ts, que os dois nunca caiam em páginas diferentes
 * do PDF/Word (achado do responsável: a assinatura final saía cortada entre duas páginas).
 */
describe("local/data e assinatura formam um bloco átomo (nunca em páginas diferentes)", () => {
  it("relatório final: localData entra no bloco assinaturas, não como parágrafo separado", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = { id: "e1", ...exercicioPadrao(condo, 2025, "Florianópolis") } as Exercicio;
    e.dataEmissao = "02/11/2026";
    const rel = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    const escritorio = { nome: "Escritório Teste", assinatura: "Síndico Responsável" } as any;
    const doc = await documentoRelatorioFinal({ rel, exercicio: e, condominio: condo, escritorio });

    const assinaturas = doc.blocos.find((b): b is Extract<Bloco, { tipo: "assinaturas" }> => b.tipo === "assinaturas");
    expect(assinaturas?.localData).toBe("Florianópolis, 02/11/2026.");

    // Nenhum parágrafo solto com o texto de local/data fora do bloco de assinaturas.
    const paragrafoSolto = doc.blocos.some((b) => b.tipo === "paragrafo" && b.texto === "Florianópolis, 02/11/2026.");
    expect(paragrafoSolto).toBe(false);
  });

  it("relatório final sem cidade/data: bloco assinaturas sai sem localData (não quebra)", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = { id: "e1", ...exercicioPadrao(condo, 2025, "") } as Exercicio;
    e.dataEmissao = "";
    const rel = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    const doc = await documentoRelatorioFinal({ rel, exercicio: e, condominio: condo, escritorio: null });

    const assinaturas = doc.blocos.find((b): b is Extract<Bloco, { tipo: "assinaturas" }> => b.tipo === "assinaturas");
    expect(assinaturas?.localData).toBeUndefined();
  });

  it("ata: localData entra no bloco assinaturas, alinhado à direita", async () => {
    const { documentoAta } = await import("@/documentos/ata");
    const ata: Ata = {
      id: "a1",
      condoId: condo.id,
      assembleiaId: "as1",
      tipo: "ordinaria",
      data: "2026-11-02",
      hora: "19:00",
      modalidade: "presencial",
      local: "Salão de festas",
      mesa: { presidente: "Fulano", secretario: "Ciclana" },
      presentes: [],
      quorum: { unidadesPresentes: 0, totalUnidades: 10 },
      itens: [],
      encerramento: "",
      observacoes: "",
      status: "finalizada",
    };
    const doc = documentoAta({ ata, condominio: condo, cidade: "Florianópolis", escritorio: null });

    const assinaturas = doc.blocos.find((b): b is Extract<Bloco, { tipo: "assinaturas" }> => b.tipo === "assinaturas");
    expect(assinaturas?.localData).toBe("Florianópolis, 02/11/2026.");
    expect(assinaturas?.localDataAlinhamento).toBe("direita");

    const paragrafoSolto = doc.blocos.some((b) => b.tipo === "paragrafo" && b.texto === "Florianópolis, 02/11/2026.");
    expect(paragrafoSolto).toBe(false);
  });
});
