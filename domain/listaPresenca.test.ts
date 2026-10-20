import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { assembleiaPadrao } from "@/domain/edital";
import { montarListaPresenca } from "@/domain/listaPresenca";
import type { Condominio } from "@/domain/types";

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Jardim das Acácias", unidades: 40 };

describe("montarListaPresenca", () => {
  it("usa linhasLista do edital quando informado", () => {
    const edital = { id: "e1", ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10" }), linhasLista: 12 };
    const lista = montarListaPresenca(condo, edital);
    expect(lista.linhas).toHaveLength(12);
    expect(lista.linhas[0]).toEqual({ numero: 1 });
    expect(lista.linhas[11]).toEqual({ numero: 12 });
  });

  it("cai para o nº de unidades do condomínio quando linhasLista é null", () => {
    const edital = { id: "e1", ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10" }), linhasLista: null };
    const lista = montarListaPresenca(condo, edital);
    expect(lista.linhas).toHaveLength(40);
  });

  it("não gera linhas negativas quando não há unidades nem linhasLista", () => {
    const semUnidades: Condominio = { ...condo, unidades: null };
    const edital = { id: "e1", ...assembleiaPadrao({ condo: semUnidades, tipo: "ordinaria", data: "2026-11-10" }), linhasLista: null };
    const lista = montarListaPresenca(semUnidades, edital);
    expect(lista.linhas).toHaveLength(0);
  });

  it("monta título e subtítulo com nome, tipo, modalidade e data", () => {
    const edital = { id: "e1", ...assembleiaPadrao({ condo, tipo: "extraordinaria", data: "2026-11-10" }), modalidade: "online" as const };
    const lista = montarListaPresenca(condo, edital);
    expect(lista.titulo).toBe("Lista de Presença — Jardim das Acácias");
    expect(lista.subtitulo).toBe("Assembleia Extraordinária (On-line) de 10/11/2026");
  });
});
