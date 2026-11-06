import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { assembleiaPadrao } from "@/domain/edital";
import type { ContextoBloco } from "@/domain/modeloTexto";
import { montarProcuracao } from "@/domain/procuracao";
import type { Condominio } from "@/domain/types";

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Jardim das Acácias", cnpj: "12.345.678/0001-90" };
const edital = {
  id: "e1",
  ...assembleiaPadrao({ condo, tipo: "ordinaria", data: "2026-11-10", cidade: "São Paulo" }),
  hora1: "19:00",
  modalidade: "presencial" as const,
  dataEmissao: "01/11/2026",
};
const contexto: ContextoBloco = { condominio: condo, assembleia: edital };

describe("montarProcuracao", () => {
  it("substitui as variáveis do condomínio e da assembleia no texto", () => {
    const texto = montarProcuracao(contexto);
    expect(texto).toContain("Jardim das Acácias");
    expect(texto).toContain("12.345.678/0001-90");
    expect(texto).toContain("Ordinária");
    expect(texto).toContain("10/11/2026");
    expect(texto).toContain("19:00h");
    expect(texto).toContain("Presencial");
    expect(texto).toContain("São Paulo, 01/11/2026.");
  });

  it("mantém os campos de preenchimento manual em branco", () => {
    const texto = montarProcuracao(contexto);
    expect(texto).toContain("Eu, ___");
    expect(texto).toContain("procurador(a) o(a) Sr(a). ___");
    expect(texto).toContain("Assinatura do outorgante");
  });
});
