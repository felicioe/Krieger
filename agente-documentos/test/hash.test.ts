import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashArquivo } from "../src/hash.js";

describe("hashArquivo", () => {
  let pasta: string;

  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), "krieger-hash-"));
  });

  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("calcula o SHA-256 e o tamanho em bytes", async () => {
    const conteudo = "conteúdo de teste do arquivo";
    const caminho = join(pasta, "arquivo.txt");
    await writeFile(caminho, conteudo, "utf-8");

    const esperado = createHash("sha256").update(conteudo, "utf-8").digest("hex");
    const resultado = await hashArquivo(caminho);

    expect(resultado.hash).toBe(esperado);
    expect(resultado.tamanho).toBe(Buffer.byteLength(conteudo, "utf-8"));
  });

  it("produz hashes diferentes para conteúdos diferentes", async () => {
    const caminhoA = join(pasta, "a.txt");
    const caminhoB = join(pasta, "b.txt");
    await writeFile(caminhoA, "conteúdo A");
    await writeFile(caminhoB, "conteúdo B");

    const a = await hashArquivo(caminhoA);
    const b = await hashArquivo(caminhoB);
    expect(a.hash).not.toBe(b.hash);
  });
});
