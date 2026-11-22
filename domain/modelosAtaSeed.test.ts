import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modelosAtaSemente } from "./modelosAtaSeed";

/**
 * A semente é escrita em quatro lugares: domain/modelosAtaSeed.ts, o documento de origem
 * docs/MODELOS-ATA-POR-CIDADE.md (os oito modelos), a migration
 * 20261110_modelos_ata_lago_negro.sql e o bloco espelhado em schema.sql. Este teste confere que
 * todos continuam iguais.
 *
 * Enquanto o espelho SQL dos seis modelos novos não for gerado, os dois últimos testes falham de
 * propósito — é o lembrete de que a migration e o schema.sql ainda precisam ser atualizados.
 */

const raiz = new URL("../", import.meta.url);

const IDS = [
  "mod-ata-lago-negro-ordinaria",
  "mod-ata-lago-negro-extraordinaria",
  "mod-ata-balneario-camboriu-ordinaria",
  "mod-ata-balneario-camboriu-extraordinaria",
  "mod-ata-camboriu-ordinaria",
  "mod-ata-camboriu-extraordinaria",
  "mod-ata-itajai-ordinaria",
  "mod-ata-itajai-extraordinaria",
];

/** Cidades que têm par ordinária/extraordinária na semente. */
const CIDADES = ["Rancho Queimado", "Balneário Camboriú", "Camboriú", "Itajaí"];

/** Blocos de código do documento de origem que contêm texto de modelo de ata, na ordem. */
function blocosDoDocumento(): string[] {
  const doc = readFileSync(new URL("docs/MODELOS-ATA-POR-CIDADE.md", raiz), "utf8");
  const blocos: string[] = [];
  let atual: string[] | null = null;
  for (const linha of doc.split(/\r?\n/)) {
    if (linha.trim() === "```") {
      if (atual === null) atual = [];
      else {
        blocos.push(atual.join("\n"));
        atual = null;
      }
    } else if (atual !== null) {
      atual.push(linha);
    }
  }
  return blocos.filter((b) => b.startsWith("# ATA DA ASSEMBLEIA GERAL"));
}

/** Lê os pares id/JSON de um trecho SQL gerado (REPLACE INTO kr_modelos_ata ... VALUES ...). */
function registrosDoSql(sql: string): Map<string, Record<string, unknown>> {
  const mapa = new Map<string, Record<string, unknown>>();
  const regex = /^ {2}\('(mod-ata-[a-z0-9-]+)', '(.*)', NOW\(\)\)[,;]$/gm;
  let achado: RegExpExecArray | null;
  while ((achado = regex.exec(sql)) !== null) {
    const [, id, escapado] = achado;
    const json = (escapado ?? "").replace(/''/g, "'").replace(/\\\\/g, "\\");
    mapa.set(id ?? "", JSON.parse(json) as Record<string, unknown>);
  }
  return mapa;
}

describe("semente dos modelos de ata", () => {
  it("traz os oito modelos, com ids, cidades e tipos na ordem esperada", () => {
    const modelos = modelosAtaSemente();
    expect(modelos).toHaveLength(8);
    expect(modelos.map((m) => m.id)).toEqual(IDS);
    expect(modelos.map((m) => m.cidade)).toEqual([
      "Rancho Queimado",
      "Rancho Queimado",
      "Balneário Camboriú",
      "Balneário Camboriú",
      "Camboriú",
      "Camboriú",
      "Itajaí",
      "Itajaí",
    ]);
    expect(modelos.map((m) => m.tipo)).toEqual([
      "ordinaria",
      "extraordinaria",
      "ordinaria",
      "extraordinaria",
      "ordinaria",
      "extraordinaria",
      "ordinaria",
      "extraordinaria",
    ]);
  });

  it("cada cidade tem ordinária e extraordinária, sem cartório fixo", () => {
    const modelos = modelosAtaSemente();
    for (const cidade of CIDADES) {
      const daCidade = modelos.filter((m) => m.cidade === cidade);
      expect(daCidade.map((m) => m.tipo).sort()).toEqual(["extraordinaria", "ordinaria"]);
    }
    for (const m of modelos) {
      expect(m.cartorio).toBe("");
      expect(m.ativo).toBe(true);
    }
  });

  it("todos os modelos saem sem logo do escritório e com borda de página", () => {
    for (const m of modelosAtaSemente()) {
      expect(m.logoEscritorio).toBe(false);
      expect(m.bordaPagina).toBe(true);
    }
  });

  it("todo texto passa de 1000 caracteres e usa as variáveis da ata", () => {
    for (const m of modelosAtaSemente()) {
      expect(m.texto.length).toBeGreaterThan(1000);
      expect(m.texto).toContain("{{condominio.nomeRelatorio}}");
      expect(m.texto).toContain("{{condominio.enderecoEdital}}");
      expect(m.texto).toContain("{{ata.dataExtenso}}");
      expect(m.texto).toContain("{{ata.unidades}}");
      expect(m.texto).toContain("{{ata.itensTexto}}");
      expect(m.texto).toContain("{{ata.mesa.presidente}}");
      expect(m.texto).toContain("{{ata.mesa.secretario}}");
    }
  });

  it("os modelos dos três municípios usam prosa corrida, sem seções intermediárias", () => {
    const corrida = modelosAtaSemente().filter((m) => m.cidade !== "Rancho Queimado");
    for (const m of corrida) {
      expect(m.texto).not.toMatch(/^## Unidades presentes$/m);
      expect(m.texto).not.toMatch(/^## Ordem do dia$/m);
      expect(m.texto).not.toMatch(/^## Encerramento$/m);
      expect(m.texto).not.toMatch(/^## Observações$/m);
    }
  });

  it("mantém o texto idêntico ao documento de origem", () => {
    const textos = blocosDoDocumento();
    expect(textos).toHaveLength(8);
    expect(modelosAtaSemente().map((m) => m.texto)).toEqual(textos);
  });

  it("mantém a migration igual à semente", () => {
    const sql = readFileSync(new URL("migrations/20261111_modelos_ata_por_cidade.sql", raiz), "utf8");
    const registros = registrosDoSql(sql);
    expect(registros.size).toBe(8);
    for (const m of modelosAtaSemente()) {
      expect(registros.get(m.id)).toEqual(JSON.parse(JSON.stringify(m)) as Record<string, unknown>);
    }
  });

  it("mantém o bloco do schema.sql igual à semente", () => {
    const sql = readFileSync(new URL("schema.sql", raiz), "utf8");
    const registros = registrosDoSql(sql);
    expect(registros.size).toBe(8);
    for (const m of modelosAtaSemente()) {
      expect(registros.get(m.id)).toEqual(JSON.parse(JSON.stringify(m)) as Record<string, unknown>);
    }
  });
});
