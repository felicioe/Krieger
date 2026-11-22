import { describe, expect, it } from "vitest";
import { cidadeDoModeloEdital, escolherModeloEdital, modelosDoEdital } from "@/domain/modelo";
import { modelosEditalSemente } from "@/domain/modelosEditalSeed";
import type { Modelo } from "@/domain/types";

function m(parcial: Partial<Modelo> & { id: string }): Modelo {
  return {
    condoId: "",
    nome: parcial.id,
    versao: 1,
    pautaOrdinaria: [],
    blocos: [],
    ...parcial,
  };
}

const seeds = modelosEditalSemente();

describe("escolha do modelo de edital pela cidade do condomínio", () => {
  it("a cidade sai do endereço do edital, sem a preposição do texto livre", () => {
    expect(cidadeDoModeloEdital("Rua 3160, nº 313, Centro, em Balneário Camboriú/SC")).toBe("Balneário Camboriú");
    expect(cidadeDoModeloEdital("Rua Joaquim Garcia, nº 1764, Bairro Centro, em Camboriú/SC")).toBe("Camboriú");
    expect(cidadeDoModeloEdital("Rua Hecília Moser, 281, na Cidade de Itajaí – SC")).toBe("Itajaí");
    expect(cidadeDoModeloEdital("")).toBe("");
  });

  it("o modelo da cidade do condomínio vem primeiro e é o escolhido", () => {
    const bc = modelosDoEdital(seeds, "c1", "Balneário Camboriú", "extraordinaria");
    expect(bc[0]?.id).toBe("mod-edital-balneario-camboriu");
    expect(escolherModeloEdital(bc, "Balneário Camboriú", "extraordinaria")?.id).toBe("mod-edital-balneario-camboriu");

    const camb = modelosDoEdital(seeds, "c1", "Camboriú", "extraordinaria");
    expect(camb[0]?.id).toBe("mod-edital-camboriu-extraordinaria");
    expect(escolherModeloEdital(camb, "Camboriú", "extraordinaria")?.id).toBe("mod-edital-camboriu-extraordinaria");
  });

  it("Camboriú tem modelo próprio para cada tipo de assembleia", () => {
    const ord = escolherModeloEdital(modelosDoEdital(seeds, "c1", "Camboriú", "ordinaria"), "Camboriú", "ordinaria");
    const ext = escolherModeloEdital(modelosDoEdital(seeds, "c1", "Camboriú", "extraordinaria"), "Camboriú", "extraordinaria");
    expect(ord?.id).toBe("mod-edital-camboriu-ordinaria");
    expect(ext?.id).toBe("mod-edital-camboriu-extraordinaria");
    expect(ord?.id).not.toBe(ext?.id);
  });

  it("Balneário Camboriú usa o mesmo modelo nos dois tipos", () => {
    for (const tipo of ["ordinaria", "extraordinaria"] as const) {
      const lista = modelosDoEdital(seeds, "c1", "Balneário Camboriú", tipo);
      expect(escolherModeloEdital(lista, "Balneário Camboriú", tipo)?.id).toBe("mod-edital-balneario-camboriu");
    }
  });

  it("casa a cidade sem depender de acento nem de caixa", () => {
    const lista = modelosDoEdital(seeds, "c1", "balneario camboriu", "ordinaria");
    expect(lista[0]?.id).toBe("mod-edital-balneario-camboriu");
  });

  it("cidade sem semente cai no primeiro modelo disponível, sem quebrar", () => {
    const lista = modelosDoEdital(seeds, "c1", "Joinville", "ordinaria");
    expect(lista.length).toBeGreaterThan(0);
    expect(escolherModeloEdital(lista, "Joinville", "ordinaria")).not.toBeNull();
  });

  it("respeita o condomínio: o modelo de um não aparece no outro", () => {
    const doCondo = m({ id: "proprio", condoId: "c1", cidade: "Itajaí", tipo: "ordinaria" });
    const lista = modelosDoEdital([doCondo, ...seeds], "c9", "Itajaí", "ordinaria");
    expect(lista.some((x) => x.id === "proprio")).toBe(false);
  });

  it("sem tipo declarado, o modelo serve aos dois tipos", () => {
    const semTipo = m({ id: "amplo", cidade: "Camboriú" });
    const tipado = m({ id: "so-extra", cidade: "Camboriú", tipo: "extraordinaria" });
    expect(modelosDoEdital([semTipo, tipado], "c1", "Camboriú", "ordinaria").map((x) => x.id)).toContain("amplo");
    const escolhido = escolherModeloEdital([semTipo, tipado], "Camboriú", "extraordinaria");
    expect(escolhido?.id).toBe("amplo");
  });
});
