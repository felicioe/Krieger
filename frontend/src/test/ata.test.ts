import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { assembleiaPadrao } from "@/domain/edital";
import { contarUnidadesPresentes, novaAtaDeAssembleia, prepararAta, validarAta, validarNovaAta, novoItemAta } from "@/domain/ata";
import type { Assembleia, Condominio } from "@/domain/types";

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias", unidades: 48 };
const edital: Assembleia = {
  id: "e1",
  ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-10-31" }),
  modalidade: "hibrida",
  hora1: "19:00",
  hora2: "19:30",
  local: "Salão de festas",
  pauta: ["Prestação de contas;", "  ", "Assuntos gerais."],
};

describe("atas", () => {
  it("ata criada do edital puxa data, hora, modalidade, local e total de unidades", () => {
    const ata = novaAtaDeAssembleia(edital, condo);
    expect(ata.assembleiaId).toBe("e1");
    expect(ata.data).toBe("2026-10-31");
    expect(ata.hora).toBe("19:00");
    expect(ata.modalidade).toBe("hibrida");
    expect(ata.local).toBe("Salão de festas");
    expect(ata.quorum).toEqual({ unidadesPresentes: 0, totalUnidades: 48 });
    expect(ata.status).toBe("rascunho");
  });

  it("cada linha da pauta vira um item com discussão e deliberação vazias", () => {
    const ata = novaAtaDeAssembleia(edital, condo);
    expect(ata.itens).toEqual([
      { titulo: "Prestação de contas;", discussao: "", deliberacao: "", votos: { favor: 0, contra: 0, abstencao: 0 } },
      { titulo: "Assuntos gerais.", discussao: "", deliberacao: "", votos: { favor: 0, contra: 0, abstencao: 0 } },
    ]);
    expect(ata.mesa).toEqual({ presidente: "", secretario: "" });
    expect(ata.presentes).toEqual([]);
  });

  it("um edital tem no máximo uma ata", () => {
    expect(validarNovaAta("e1", [{ id: "a1", assembleiaId: "e1" }])).toBe("Este edital já tem uma ata.");
    expect(validarNovaAta("e2", [{ id: "a1", assembleiaId: "e1" }])).toBeNull();
  });

  it("conta unidades diferentes na lista de presentes", () => {
    expect(
      contarUnidadesPresentes([
        { unidade: "101", nome: "Ana", procurador: false },
        { unidade: "101 ", nome: "João", procurador: false },
        { unidade: "", nome: "Sem unidade", procurador: false },
        { unidade: "202", nome: "Bia", procurador: true },
      ]),
    ).toBe(2);
  });

  it("ao salvar, descarta presentes e itens totalmente em branco", () => {
    const ata = prepararAta({
      ...novaAtaDeAssembleia(edital, condo),
      presentes: [
        { unidade: " ", nome: "", procurador: false },
        { unidade: "101", nome: "Ana", procurador: false },
      ],
      itens: [novoItemAta(), { ...novoItemAta(), votos: { favor: 3, contra: 0, abstencao: 0 } }],
    });
    expect(ata.presentes).toEqual([{ unidade: "101", nome: "Ana", procurador: false }]);
    expect(ata.itens).toHaveLength(1);
  });

  it("exige condomínio e data válida; horário, se informado, em hh:mm", () => {
    expect(validarAta({ condoId: "", data: "", hora: "" })).toEqual({ condoId: "Escolha o condomínio.", data: "Informe a data da assembleia." });
    expect(validarAta({ condoId: "c1", data: "31/10/2026", hora: "7" })).toEqual({ hora: "Horário inválido (hh:mm)." });
    expect(validarAta({ condoId: "c1", data: "2026-10-31", hora: "" })).toEqual({});
  });
});
