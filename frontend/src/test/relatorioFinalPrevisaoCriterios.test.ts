import { describe, expect, it, vi } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import { formatBRL } from "@/lib/format";
import type { Bloco } from "@/lib/documento/tipos";
import type { Condominio, Exercicio } from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 10 };

type Pares = Extract<Bloco, { tipo: "pares" }>;
type Tabela = Extract<Bloco, { tipo: "tabela" }>;

describe("Previsão orçamentária no relatório final: mesmos critérios e tabela da tela de manutenção", () => {
  async function gerar(parcial: Partial<Exercicio> = {}) {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const e = {
      id: "e1",
      ...exercicioPadrao(condo, 2025, "Curitiba"),
      variacaoMetodo: "mediaIndices" as const,
      variacaoParam: 2,
      arredondamento: "truncar" as const,
      ...parcial,
    } as Exercicio;
    e.relatorioFinal = { ...e.relatorioFinal, secoes: {} };
    e.consid = {
      ...e.consid,
      indices: [
        { ano: 2023, pct: 4 },
        { ano: 2025, pct: 5 },
        { ano: 2024, pct: 6 },
      ],
    };
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

  it("o documento declara método, índices usados e arredondamento, com os rótulos da tela", async () => {
    const { doc } = await gerar();
    const pares = doc.blocos.find(
      (b): b is Pares =>
        b.tipo === "pares" && b.itens.some((i) => i.rotulo === "Método da variação"),
    );
    expect(pares, "bloco de critérios da previsão").toBeDefined();
    const valor = (rotulo: string) => pares!.itens.find((i) => i.rotulo === rotulo)?.valor;
    expect(valor("Modo da previsão")).toBe("Tradicional (por grupo)");
    expect(valor("Método da variação")).toBe("Média dos índices");
    expect(valor("Índices usados na média")).toBe("2025: 5,00% · 2024: 6,00%");
    expect(valor("Arredondamento do valor por unidade")).toBe("Truncar (sem centavos, para baixo)");
  });

  it("a tabela por grupo é a da tela: realizado × média prevista, com Total dos grupos no rodapé", async () => {
    const { rel, doc } = await gerar();
    const tabela = doc.blocos.find(
      (b): b is Tabela =>
        b.tipo === "tabela" && b.colunas.some((c) => c.titulo === "Média prevista dos grupos"),
    );
    expect(tabela, "tabela da previsão").toBeDefined();

    const total = tabela!.linhas.at(-1)!;
    expect(total.estilo).toBe("total");
    expect(total.celulas[0]).toBe("Total dos grupos");
    expect(total.celulas[1]).toBe(formatBRL(rel.previsao.base));
    const somaPrevistos = rel.previsao.linhas.reduce((s, l) => s + l.previsto, 0);
    expect(total.celulas[2]).toBe(formatBRL(somaPrevistos / rel.previsao.mesesAnalisados));
  });

  it("método valor: a variação aplicada aparece em reais e não lista índices", async () => {
    const { doc } = await gerar({ variacaoMetodo: "valor", variacaoParam: 5000 });
    const pares = doc.blocos.find(
      (b): b is Pares =>
        b.tipo === "pares" && b.itens.some((i) => i.rotulo === "Método da variação"),
    );
    const rotulos = pares!.itens.map((i) => i.rotulo);
    expect(rotulos).not.toContain("Índices usados na média");
    expect(pares!.itens.find((i) => i.rotulo === "Método da variação")?.valor).toBe(
      "Valor fixo (R$)",
    );
    expect(pares!.itens.find((i) => i.rotulo === "Variação aplicada")?.valor).toBe(formatBRL(5000));
  });
});
