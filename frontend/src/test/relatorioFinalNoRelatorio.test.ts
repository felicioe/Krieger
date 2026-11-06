import { describe, expect, it, vi } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import type { Bloco } from "@/lib/documento/tipos";
import type { Condominio, Exercicio } from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 10 };

/** Rótulos do bloco "pares" que segue o título dado (Administração, Seguro, Índices...). */
function rotulosDoGrupo(blocos: Bloco[], titulo: string): string[] {
  const i = blocos.findIndex((b) => b.tipo === "titulo" && b.texto === titulo);
  const pares = i !== -1 ? blocos[i + 1] : undefined;
  return pares?.tipo === "pares" ? pares.itens.map((it) => it.rotulo) : [];
}

describe("Considerações finais: item com noRelatorio=false fica fora do relatório final", () => {
  it("Administração, Coberturas do seguro e Índices de correção respeitam o toggle por item", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = { id: "e1", ...exercicioPadrao(condo, 2025, "Curitiba") } as Exercicio;
    e.relatorioFinal = { ...e.relatorioFinal, secoes: {} };
    e.consid = {
      ...e.consid,
      administracao: [
        { cargo: "Síndico", nome: "Visível", mandatoFim: "", noRelatorio: true },
        { cargo: "Subsíndico", nome: "Oculto", mandatoFim: "", noRelatorio: false },
      ],
      seguro: { riscoAbsoluto: null, coberturas: [
        { desc: "Incêndio", valor: 1000, noRelatorio: true },
        { desc: "Roubo", valor: 500, noRelatorio: false },
      ] },
      indices: [
        { ano: 2024, pct: 5, noRelatorio: true },
        { ano: 2023, pct: 4, noRelatorio: false },
      ],
    };
    const rel = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    const doc = await documentoRelatorioFinal({ rel, exercicio: e, condominio: condo, escritorio: null });

    expect(rotulosDoGrupo(doc.blocos, "Administração")).toEqual(["Síndico"]);
    expect(rotulosDoGrupo(doc.blocos, "Seguro")).toContain("Incêndio");
    expect(rotulosDoGrupo(doc.blocos, "Seguro")).not.toContain("Roubo");
    expect(rotulosDoGrupo(doc.blocos, "Índices de correção aplicados")).toEqual(["2024"]);
  });

  it("item sem noRelatorio definido (dado antigo) continua incluído — padrão é mostrar", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = { id: "e1", ...exercicioPadrao(condo, 2025, "Curitiba") } as Exercicio;
    e.relatorioFinal = { ...e.relatorioFinal, secoes: {} };
    e.consid = {
      ...e.consid,
      administracao: [{ cargo: "Síndico", nome: "Antigo", mandatoFim: "" }],
      seguro: { riscoAbsoluto: null, coberturas: [{ desc: "Incêndio", valor: 1000 }] },
      indices: [{ ano: 2024, pct: 5 }],
    };
    const rel = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    const doc = await documentoRelatorioFinal({ rel, exercicio: e, condominio: condo, escritorio: null });

    expect(rotulosDoGrupo(doc.blocos, "Administração")).toEqual(["Síndico"]);
    expect(rotulosDoGrupo(doc.blocos, "Seguro")).toContain("Incêndio");
    expect(rotulosDoGrupo(doc.blocos, "Índices de correção aplicados")).toEqual(["2024"]);
  });
});
