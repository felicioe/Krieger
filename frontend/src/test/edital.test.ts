import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { assembleiaPadrao, camposDaModalidade, prepararAssembleia, validarAssembleia } from "@/domain/edital";
import { modeloPadrao, prepararModelo, validarModelo } from "@/domain/modelo";
import type { Condominio, Modelo } from "@/domain/types";

const condo: Condominio = {
  ...condominioPadrao(),
  id: "c1",
  nome: "Acácias",
  quorum: "maioria simples",
  enderecoEdital: "Rua das Flores, 100",
  unidades: 48,
  administracao: [
    { cargo: "Conselheiro", nome: "João" },
    { cargo: "Síndica", nome: "Ana" },
  ],
};

const modelo: Modelo = {
  id: "m1",
  nome: "Padrão",
  versao: 1,
  pautaOrdinaria: ["Prestação de contas;", "Assuntos gerais."],
  blocos: [{ id: "b1", tipo: "titulo", texto: "EDITAL", cond: "" }],
};

describe("editais", () => {
  it("Zoom só aparece em on-line e híbrida; local só em presencial e híbrida", () => {
    expect(camposDaModalidade("presencial")).toEqual({ local: true, zoom: false });
    expect(camposDaModalidade("online")).toEqual({ local: false, zoom: true });
    expect(camposDaModalidade("hibrida")).toEqual({ local: true, zoom: true });
  });

  it("edital novo vem com a pauta padrão do modelo escolhido", () => {
    const a = assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10", modelo });
    expect(a.pauta).toEqual(["Prestação de contas;", "Assuntos gerais."]);
    expect(a.modeloId).toBe("m1");
    a.pauta.push("Obras");
    expect(modelo.pautaOrdinaria).toHaveLength(2);
  });

  it("ao salvar, limpa o Zoom do edital presencial e o local do on-line", () => {
    const base = { ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10" }), zoomLink: "https://zoom.us/j/1", zoomId: "1", zoomSenha: "x" };
    const presencial = prepararAssembleia({ ...base, modalidade: "presencial" });
    expect([presencial.zoomLink, presencial.zoomId, presencial.zoomSenha]).toEqual(["", "", ""]);
    expect(presencial.local).toBe("Rua das Flores, 100");
    const online = prepararAssembleia({ ...base, modalidade: "online" });
    expect(online.local).toBe("");
    expect(online.zoomLink).toBe("https://zoom.us/j/1");
  });

  it("descarta itens de pauta vazios ao salvar", () => {
    const a = prepararAssembleia({ ...assembleiaPadrao({ condo, tipo: "extraordinaria", data: "2026-11-10" }), pauta: ["Obras", "  ", ""] });
    expect(a.pauta).toEqual(["Obras"]);
  });

  it("exige condomínio, data e horário da 1ª convocação válidos", () => {
    expect(validarAssembleia({ condoId: "", data: "", hora1: "", hora2: "", dataEmissao: "" })).toEqual({
      condoId: "Escolha o condomínio.",
      data: "Informe a data da assembleia.",
      hora1: "Informe o horário da 1ª convocação.",
    });
    expect(validarAssembleia({ condoId: "c1", data: "31/02/2026", hora1: "25:00", hora2: "19:3", dataEmissao: "" })).toEqual({
      data: "Data inválida.",
      hora1: "Horário inválido (hh:mm).",
      hora2: "Horário inválido (hh:mm).",
    });
    expect(validarAssembleia({ condoId: "c1", data: "10/11/2026", hora1: "19:00", hora2: "", dataEmissao: "" })).toEqual({});
  });
});

describe("modelos de edital", () => {
  it("nome é obrigatório", () => {
    expect(validarModelo({ nome: "  " })).toBe("Informe o nome do modelo.");
    expect(validarModelo({ nome: "Padrão" })).toBeNull();
  });

  it("copiar um modelo gera novos ids de bloco e mantém a pauta", () => {
    const copia = modeloPadrao("Cópia", modelo);
    expect(copia.pautaOrdinaria).toEqual(modelo.pautaOrdinaria);
    expect(copia.blocos[0]!.texto).toBe("EDITAL");
    expect(copia.blocos[0]!.id).not.toBe("b1");
  });

  it("ao salvar, descarta blocos sem texto, exceto o bloco da pauta", () => {
    const m = prepararModelo({
      ...modeloPadrao("X"),
      blocos: [
        { id: "1", tipo: "texto", texto: " ", cond: "" },
        { id: "2", tipo: "pauta", texto: "", cond: "" },
      ],
    });
    expect(m.blocos.map((b) => b.id)).toEqual(["2"]);
  });
});
