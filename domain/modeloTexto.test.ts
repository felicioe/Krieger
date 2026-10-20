import { describe, expect, it } from "vitest";
import { avaliarCondicao, blocosVisiveis, montarBlocos, substituirVariaveis, type ContextoBloco } from "@/domain/modeloTexto";
import { condominioPadrao } from "@/domain/condominio";
import { assembleiaPadrao } from "@/domain/edital";
import type { Condominio, Modelo } from "@/domain/types";

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Jardim das Acácias" };
const edital = { id: "e1", ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10" }), modalidade: "online" as const, zoomLink: "https://zoom.us/j/1" };
const contexto: ContextoBloco = { condominio: condo, assembleia: edital };

describe("substituirVariaveis", () => {
  it("substitui {{campo.caminho}} pelo valor do contexto", () => {
    expect(substituirVariaveis("Edital de {{condominio.nome}}", contexto)).toBe("Edital de Jardim das Acácias");
    expect(substituirVariaveis("Modalidade: {{assembleia.modalidade}}", contexto)).toBe("Modalidade: online");
  });

  it("campo ausente vira texto vazio", () => {
    expect(substituirVariaveis("Link: {{assembleia.zoomId}}", contexto)).toBe("Link: ");
  });

  it("não mexe no texto quando não há variáveis", () => {
    expect(substituirVariaveis("Texto fixo sem variável", contexto)).toBe("Texto fixo sem variável");
  });
});

describe("avaliarCondicao", () => {
  it("condição vazia sempre mostra o bloco", () => {
    expect(avaliarCondicao("", contexto)).toBe(true);
    expect(avaliarCondicao("   ", contexto)).toBe(true);
  });

  it("campo sozinho é truthy/falsy", () => {
    expect(avaliarCondicao("assembleia.zoomLink", contexto)).toBe(true);
    expect(avaliarCondicao("assembleia.zoomId", contexto)).toBe(false);
    expect(avaliarCondicao("!assembleia.zoomId", contexto)).toBe(true);
  });

  it("campo == valor e campo != valor", () => {
    expect(avaliarCondicao('assembleia.modalidade == "online"', contexto)).toBe(true);
    expect(avaliarCondicao("assembleia.modalidade == presencial", contexto)).toBe(false);
    expect(avaliarCondicao('assembleia.modalidade != "presencial"', contexto)).toBe(true);
  });
});

describe("blocosVisiveis / montarBlocos", () => {
  const modelo: Pick<Modelo, "blocos"> = {
    blocos: [
      { id: "1", tipo: "titulo", texto: "Edital de {{condominio.nome}}", cond: "" },
      { id: "2", tipo: "texto", texto: "Acesse pelo Zoom: {{assembleia.zoomLink}}", cond: 'assembleia.modalidade == "online"' },
      { id: "3", tipo: "texto", texto: "Compareça ao local.", cond: "assembleia.modalidade == presencial" },
    ],
  };

  it("filtra pelos blocos cuja condição é verdadeira", () => {
    const visiveis = blocosVisiveis(modelo, contexto);
    expect(visiveis.map((b) => b.id)).toEqual(["1", "2"]);
  });

  it("monta id/tipo/texto já com as variáveis resolvidas, só dos blocos visíveis", () => {
    expect(montarBlocos(modelo, contexto)).toEqual([
      { id: "1", tipo: "titulo", texto: "Edital de Jardim das Acácias" },
      { id: "2", tipo: "texto", texto: "Acesse pelo Zoom: https://zoom.us/j/1" },
    ]);
  });
});
