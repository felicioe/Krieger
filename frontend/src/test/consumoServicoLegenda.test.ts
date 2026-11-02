import { describe, expect, it, vi } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { recalcularDemonstrativo } from "@/domain/demonstrativo";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import type { Bloco } from "@/lib/documento/tipos";
import type { Condominio, Exercicio } from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 10 };

/** Junta todo o texto de um bloco "tabela" (células podem ser string ou lista de Texto). */
function textoDaTabela(b: Bloco): string {
  if (b.tipo !== "tabela") return "";
  return b.linhas
    .flatMap((l) => l.celulas)
    .flatMap((c) => (Array.isArray(c) ? c.map((t) => t.texto) : [c]))
    .join(" ");
}

describe("\"Consumo de serviços\" nunca mostra a expressão técnica da rubrica", () => {
  it("mostra as despesas do demonstrativo que bateram, não a regex", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = { id: "e1", ...exercicioPadrao(condo, 2025, "Florianópolis") } as Exercicio;
    e.relatorioFinal = { ...e.relatorioFinal, secoes: {} };
    e.consid = { ...e.consid, elevadorRubrica: "manuten[çc][ãa]o.*elevador" };
    e.demonstrativo = recalcularDemonstrativo({
      ...e.demonstrativo!,
      periodo: { ini: "01/01/2025", fim: "31/12/2025" },
      despesas: { grupos: [{ nome: "Manutenção", itens: [{ nome: "Manutenção de elevadores", valor: 27784.81 }] }], subtotal: 0, saldoRestante: 0 },
    });

    const rel = montarRelatorioFinal({ exercicio: e, condominio: condo, escritorio: null, mensais: [] });
    const doc = await documentoRelatorioFinal({ rel, exercicio: e, condominio: condo, escritorio: null });

    const i = doc.blocos.findIndex((b) => b.tipo === "titulo" && b.texto === "Consumo de serviços");
    expect(i).toBeGreaterThan(-1);
    const texto = textoDaTabela(doc.blocos[i + 1]!);

    expect(texto).toContain("Manutenção de elevadores");
    expect(texto).not.toMatch(/\[[cç]\]|\[[ãa]\]|\.\*/);
  });
});
