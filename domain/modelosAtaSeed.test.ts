import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modelosAtaSemente } from "./modelosAtaSeed";

/**
 * A semente é escrita em três lugares: domain/modelosAtaSeed.ts, a migration
 * 20261110_modelos_ata_lago_negro.sql e o bloco espelhado em schema.sql. Este teste confere que
 * os três (e o documento de origem) continuam iguais.
 */

const raiz = new URL("../", import.meta.url);

function blocosDoDocumento(): string[] {
  const doc = readFileSync(new URL("docs/MODELOS-ATA-LAGO-NEGRO.md", raiz), "utf8");
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
  const regex = /^ {2}\('(mod-ata-lago-negro-[a-z]+)', '(.*)', NOW\(\)\)[,;]$/gm;
  let achado: RegExpExecArray | null;
  while ((achado = regex.exec(sql)) !== null) {
    const [, id, escapado] = achado;
    const json = (escapado ?? "").replace(/''/g, "'").replace(/\\\\/g, "\\");
    mapa.set(id ?? "", JSON.parse(json) as Record<string, unknown>);
  }
  return mapa;
}

describe("semente dos modelos de ata", () => {
  it("traz os dois modelos do Lago Negro, com cidade e tipo preenchidos", () => {
    const modelos = modelosAtaSemente();
    expect(modelos).toHaveLength(2);
    expect(modelos.map((m) => m.tipo)).toEqual(["ordinaria", "extraordinaria"]);
    for (const m of modelos) {
      expect(m.cidade).toBe("Rancho Queimado");
      expect(m.cartorio).toBe("");
      expect(m.ativo).toBe(true);
      expect(m.logoEscritorio).toBe(true);
      expect(m.texto.length).toBeGreaterThan(1000);
    }
  });

  it("mantém o texto idêntico ao documento de origem", () => {
    const textos = blocosDoDocumento();
    expect(textos).toHaveLength(2);
    expect(modelosAtaSemente().map((m) => m.texto)).toEqual(textos);
  });

  it("mantém a migration igual à semente", () => {
    const sql = readFileSync(new URL("migrations/20261110_modelos_ata_lago_negro.sql", raiz), "utf8");
    const registros = registrosDoSql(sql);
    expect(registros.size).toBe(2);
    for (const m of modelosAtaSemente()) {
      expect(registros.get(m.id)).toEqual(JSON.parse(JSON.stringify(m)) as Record<string, unknown>);
    }
  });

  it("mantém o bloco do schema.sql igual à semente", () => {
    const sql = readFileSync(new URL("schema.sql", raiz), "utf8");
    const registros = registrosDoSql(sql);
    expect(registros.size).toBe(2);
    for (const m of modelosAtaSemente()) {
      expect(registros.get(m.id)).toEqual(JSON.parse(JSON.stringify(m)) as Record<string, unknown>);
    }
  });
});
