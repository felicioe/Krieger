import { describe, expect, it } from "vitest";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { evolucaoInadimplencia } from "@/domain/inadimplencia";
import { documentoInadimplencia } from "@/documentos/inadimplencia";
import type { Mensal } from "@/domain/types";

function mensal(mes: number, valor: number, receitas: number): Mensal {
  const mm = String(mes).padStart(2, "0");
  const d = demonstrativoVazio("Teste");
  return {
    id: `m${mm}`,
    condoId: "c1",
    condoNome: "Teste",
    demonstrativo: {
      ...d,
      periodo: { ini: `01/${mm}/2026`, fim: `28/${mm}/2026` },
      totais: { ...d.totais, receitas },
    },
    origem: [],
    receber: { unidades: 3, valor },
    notas: [],
  };
}

describe("Evolução da inadimplência em PDF/Word (#251)", () => {
  const r = evolucaoInadimplencia(
    [mensal(1, 1000, 10000), mensal(3, 2000, 10000)],
    "c1",
    { mes: 1, ano: 2026 },
    { mes: 3, ano: 2026 },
  );
  const doc = documentoInadimplencia({
    resultado: r,
    condominio: null,
    nomeCondominio: "Condomínio Teste",
    escritorio: null,
  });
  const tabela = doc.blocos.find((b) => b.tipo === "tabela");

  it("mês sem relatório aparece como Sem dados, e o rodapé traz a média", () => {
    expect(tabela && tabela.tipo === "tabela").toBe(true);
    if (!tabela || tabela.tipo !== "tabela") return;
    const textos = tabela.linhas.map((l) => l.celulas.join(" | "));
    expect(textos[1]).toContain("Sem dados");
    expect(textos.at(-1)).toMatch(/^Média/);
  });

  it("traz o aviso de meses sem relatório e é paisagem", () => {
    const paragrafos = doc.blocos.flatMap((b) =>
      b.tipo === "paragrafo" && typeof b.texto === "string" ? [b.texto] : [],
    );
    expect(paragrafos.some((t) => t.startsWith("Sem relatório mensal em: 02/2026."))).toBe(true);
    expect(doc.orientacao).toBe("paisagem");
  });
});
