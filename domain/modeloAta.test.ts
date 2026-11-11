import { describe, expect, it } from "vitest";
import {
  cidadeDoCondominio,
  escolherModeloAta,
  normalizarModeloAta,
  novoModeloAta,
  renderizarTextoModeloAta,
  validarModeloAta,
} from "@/domain/modeloAta";
import type { ModeloAta } from "@/domain/types";

const modelo = (parcial: Partial<ModeloAta>): ModeloAta => ({
  ...novoModeloAta(parcial.nome ?? "Modelo"),
  ...parcial,
  id: parcial.id ?? "m1",
});

describe("modelos de ata", () => {
  it("normalizarModeloAta preenche os padrões e preserva o que veio", () => {
    const m = normalizarModeloAta({ id: "m1", nome: "Cartório", cidade: "Rancho Queimado", texto: "x" });
    expect(m.id).toBe("m1");
    expect(m.cidade).toBe("Rancho Queimado");
    expect(m.logoEscritorio).toBe(true);
    expect(m.bordaPagina).toBe(false);
    expect(m.ativo).toBe(true);
  });

  it("normalizarModeloAta respeita logo/borda desligados", () => {
    const m = normalizarModeloAta({ id: "m1", nome: "n", texto: "t", logoEscritorio: false, bordaPagina: true });
    expect(m.logoEscritorio).toBe(false);
    expect(m.bordaPagina).toBe(true);
  });

  it("normalizarModeloAta trata entrada inválida sem quebrar", () => {
    expect(() => normalizarModeloAta(null)).not.toThrow();
    expect(normalizarModeloAta(null).texto).toBe("");
  });

  it("validarModeloAta exige nome e texto", () => {
    expect(validarModeloAta({ nome: "", texto: "" })).toEqual({
      nome: "Nome é obrigatório.",
      texto: "Texto da ata é obrigatório.",
    });
    expect(validarModeloAta({ nome: "Ok", texto: "Texto" })).toEqual({});
  });

  it("escolherModeloAta prioriza cidade+cartório, depois cidade, depois geral", () => {
    const geral = modelo({ id: "geral", cidade: "", cartorio: "" });
    const porCidade = modelo({ id: "cidade", cidade: "Rancho Queimado", cartorio: "" });
    const exato = modelo({ id: "exato", cidade: "Rancho Queimado", cartorio: "1º Ofício" });
    const modelos = [geral, porCidade, exato];

    expect(escolherModeloAta(modelos, "Rancho Queimado", "1º Ofício")?.id).toBe("exato");
    expect(escolherModeloAta(modelos, "Rancho Queimado", "Outro")?.id).toBe("cidade");
    expect(escolherModeloAta(modelos, "Outra cidade", "")?.id).toBe("geral");
  });

  it("escolherModeloAta ignora modelos inativos", () => {
    const inativo = modelo({ id: "i", cidade: "", cartorio: "", ativo: false });
    expect(escolherModeloAta([inativo], "X", "")).toBeNull();
  });

  it("escolherModeloAta devolve null sem modelos", () => {
    expect(escolherModeloAta([], "X", "")).toBeNull();
  });

  it("renderizarTextoModeloAta troca variáveis de vários níveis", () => {
    const ctx = {
      ata: { tipo: "Ordinária", mesa: { presidente: "Fulano", secretario: "Ciclana" } },
      condominio: { nomeRelatorio: "Lago Negro", cnpj: "19.741.383/0001-87" },
      cidade: "Rancho Queimado",
    };
    const texto = renderizarTextoModeloAta(
      "{{ata.tipo}} do {{condominio.nomeRelatorio}} ({{condominio.cnpj}}) em {{cidade}} — mesa: {{ata.mesa.presidente}} / {{ata.mesa.secretario}}.",
      ctx,
    );
    expect(texto).toBe(
      "Ordinária do Lago Negro (19.741.383/0001-87) em Rancho Queimado — mesa: Fulano / Ciclana.",
    );
  });

  it("renderizarTextoModeloAta apaga variável ausente, junta lista e converte número", () => {
    const ctx = { ata: { unidades: ["A 01", "A 02"], quorum: 12, vazio: null } };
    expect(renderizarTextoModeloAta("[{{ata.unidades}}] ({{ata.quorum}}) [{{ata.vazio}}] [{{nao.existe}}]", ctx)).toBe(
      "[A 01, A 02] (12) [] []",
    );
  });

  it("renderizarTextoModeloAta aceita espaços dentro das chaves", () => {
    expect(renderizarTextoModeloAta("{{ ata.tipo }}", { ata: { tipo: "Extraordinária" } })).toBe("Extraordinária");
  });

  it("cidadeDoCondominio lê a cidade do endereço e devolve vazio sem endereço", () => {
    expect(cidadeDoCondominio("Rua Augusto Wolf, s/n, Vargedo, Rancho Queimado/SC")).toBe("Rancho Queimado");
    expect(cidadeDoCondominio("")).toBe("");
    expect(cidadeDoCondominio("Rua sem cidade no formato")).toBe("");
  });

  it("escolherModeloAta separa ordinária de extraordinária na mesma cidade", () => {
    const ordinaria = modelo({ id: "ord", cidade: "Rancho Queimado", tipo: "ordinaria" });
    const extraordinaria = modelo({ id: "ext", cidade: "Rancho Queimado", tipo: "extraordinaria" });
    const modelos = [ordinaria, extraordinaria];

    expect(escolherModeloAta(modelos, "Rancho Queimado", "", "ordinaria")?.id).toBe("ord");
    expect(escolherModeloAta(modelos, "Rancho Queimado", "", "extraordinaria")?.id).toBe("ext");
    // Tipo desconhecido na assembleia aceita qualquer um dos dois.
    expect(escolherModeloAta(modelos, "Rancho Queimado", "", "")?.id).toBe("ord");
  });

  it("escolherModeloAta ignora modelo de outro tipo e cai no geral", () => {
    const ordinaria = modelo({ id: "ord", cidade: "Rancho Queimado", tipo: "ordinaria" });
    const geral = modelo({ id: "geral", cidade: "", tipo: "" });

    expect(escolherModeloAta([ordinaria, geral], "Rancho Queimado", "", "extraordinaria")?.id).toBe("geral");
    expect(escolherModeloAta([ordinaria], "Rancho Queimado", "", "extraordinaria")).toBeNull();
  });

  it("escolherModeloAta coloca o cartório exato antes da cidade, mesmo com tipo", () => {
    // Cenário da #256: um cartório tem modelo próprio para o tipo da assembleia
    // e a cidade tem outro. O cartório vence, ainda que o da cidade também tenha tipo.
    const porCidade = modelo({ id: "cidade", cidade: "Rancho Queimado", cartorio: "", tipo: "ordinaria" });
    const porCartorio = modelo({
      id: "cartorio",
      cidade: "Rancho Queimado",
      cartorio: "1º Ofício",
      tipo: "ordinaria",
    });

    expect(escolherModeloAta([porCidade, porCartorio], "Rancho Queimado", "1º Ofício", "ordinaria")?.id).toBe(
      "cartorio",
    );
  });

  it("escolherModeloAta usa o cartório sem tipo antes da cidade com tipo", () => {
    // O tipo desempata dentro de cada nível, nunca por cima do cartório exato.
    const porCidade = modelo({ id: "cidade", cidade: "Rancho Queimado", cartorio: "", tipo: "ordinaria" });
    const porCartorio = modelo({ id: "cartorio", cidade: "Rancho Queimado", cartorio: "1º Ofício", tipo: "" });

    expect(escolherModeloAta([porCidade, porCartorio], "Rancho Queimado", "1º Ofício", "ordinaria")?.id).toBe(
      "cartorio",
    );
  });

  it("escolherModeloAta prefere cidade+cartório+tipo ao modelo só da cidade", () => {
    const porCidade = modelo({ id: "cidade", cidade: "Rancho Queimado", tipo: "ordinaria" });
    const porCartorio = modelo({ id: "cartorio", cidade: "Rancho Queimado", cartorio: "1º Ofício", tipo: "ordinaria" });

    expect(escolherModeloAta([porCidade, porCartorio], "Rancho Queimado", "1º Ofício", "ordinaria")?.id).toBe(
      "cartorio",
    );
  });
});
