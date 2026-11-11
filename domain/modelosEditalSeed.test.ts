import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modelosEditalSemente } from "./modelosEditalSeed";
import { normalizarModelo, prepararModelo, validarModelo } from "./modelo";
import { montarBlocos } from "./modeloTexto";
import { assembleiaPadrao } from "./edital";
import type { Condominio } from "./types";

/**
 * A semente é escrita em três lugares: domain/modelosEditalSeed.ts, o bloco espelhado em
 * schema.sql e a migration 20261111_modelos_edital_por_cidade.sql. Este teste confere que os
 * três continuam iguais — editar um sem os outros quebra aqui.
 */

const raiz = new URL("../", import.meta.url);

const IDS = [
  "mod-edital-balneario-camboriu",
  "mod-edital-camboriu-ordinaria",
  "mod-edital-camboriu-extraordinaria",
  "mod-edital-itajai",
];

/** Lê os pares id/JSON de um trecho SQL gerado (REPLACE INTO kr_modelos ... VALUES ...). */
function registrosDoSql(sql: string): Map<string, Record<string, unknown>> {
  const mapa = new Map<string, Record<string, unknown>>();
  const regex = /^ {2}\('(mod-edital-[a-z0-9-]+)', '([\s\S]*?)', NOW\(\)\)[,;]\r?$/gm;
  let achado: RegExpExecArray | null;
  while ((achado = regex.exec(sql)) !== null) {
    const [, id, escapado] = achado;
    const json = (escapado ?? "").replace(/''/g, "'").replace(/\\\\/g, "\\");
    mapa.set(id ?? "", JSON.parse(json) as Record<string, unknown>);
  }
  return mapa;
}

function sqlDaMigration(): string {
  return readFileSync(new URL("migrations/20261111_modelos_edital_por_cidade.sql", raiz), "utf8");
}

/** O schema inteiro serve: o filtro de id da semente (`mod-edital-`) já separa estes dos de ata. */
function sqlDoSchema(): string {
  const schema = readFileSync(new URL("schema.sql", raiz), "utf8");
  if (!schema.includes("REPLACE INTO kr_modelos (id, dados, atualizado_em) VALUES")) return "";
  return schema;
}

function condo(enderecoEdital: string): Condominio {
  return {
    id: "c1",
    codigo: "C1",
    nome: "Condomínio Teste",
    cnpj: "",
    endereco: "",
    enderecoEdital,
    cidade: "",
    uf: "SC",
    cep: "",
    sindico: "",
    administracao: [{ id: "a1", nome: "Maria Souza", cargo: "Síndica", email: "", telefone: "" }],
    telefone: "",
    email: "",
    ativo: true,
    criadoEm: "",
    atualizadoEm: "",
  } as unknown as Condominio;
}

describe("modelos de edital prontos", () => {
  it("entrega os quatro modelos, com ids estáveis", () => {
    expect(modelosEditalSemente().map((m) => m.id)).toEqual(IDS);
  });

  it("todos passam na validação do cadastro", () => {
    for (const m of modelosEditalSemente()) {
      expect(validarModelo(m), m.id).toBeNull();
    }
  });

  it("a migration e o schema.sql têm exatamente os modelos da semente", () => {
    const daSemente = new Map(modelosEditalSemente().map((m) => [m.id, m]));
    for (const [rotulo, sql] of [
      ["migration", sqlDaMigration()],
      ["schema.sql", sqlDoSchema()],
    ] as const) {
      const doSql = registrosDoSql(sql);
      expect([...doSql.keys()].sort(), rotulo).toEqual([...daSemente.keys()].sort());
      for (const [id, esperado] of daSemente) {
        expect(doSql.get(id), `${rotulo}/${id}`).toEqual(JSON.parse(JSON.stringify(esperado)));
      }
    }
  });

  it("depois de normalizados continuam iguais à semente", () => {
    for (const m of modelosEditalSemente()) {
      expect(normalizarModelo(m)).toEqual(m);
    }
  });

  it("a semente separa cidade e tipo como o cadastro grava", () => {
    const modelos = modelosEditalSemente();
    expect(modelos.filter((m) => m.cidade === "Camboriú")).toHaveLength(2);
    expect(modelos.filter((m) => m.cidade === "Balneário Camboriú")).toHaveLength(1);
    expect(modelos.filter((m) => m.cidade === "Itajaí")).toHaveLength(1);
    // Balneário Camboriú e Itajaí praticam o mesmo texto nos dois tipos: um modelo só.
    expect(modelos.find((m) => m.cidade === "Balneário Camboriú")?.tipo).toBe("");
    expect(modelos.find((m) => m.cidade === "Itajaí")?.tipo).toBe("");
    expect(modelos.filter((m) => m.cidade === "Camboriú").map((m) => m.tipo).sort()).toEqual([
      "extraordinaria",
      "ordinaria",
    ]);
  });

  it("renderiza sem deixar variável ou condição crua no texto", () => {
    const c = condo("Rua Joaquim Garcia, nº 1764, Centro, em Camboriú/SC");
    const a = { ...assembleiaPadrao({ condo: c, tipo: "ordinaria", data: "2026-12-15" }), id: "a1" };
    for (const m of modelosEditalSemente()) {
      const texto = montarBlocos(m, { condominio: c, assembleia: a })
        .map((b) => b.texto)
        .join("\n");
      expect(texto, m.id).not.toMatch(/\{\{|\}\}/);
      expect(texto, m.id).not.toMatch(/\bundefined\b/);
      expect(texto.length, m.id).toBeGreaterThan(200);
    }
  });
});
