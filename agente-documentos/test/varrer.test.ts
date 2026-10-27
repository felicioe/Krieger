import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { varrerPastaDocumentos } from "../src/varrer.js";

describe("varrerPastaDocumentos", () => {
  let raiz: string;

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), "krieger-varrer-"));
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it("encontra só os arquivos que batem com o padrão, em subpastas misturadas com o resto", async () => {
    await writeFile(join(raiz, "Convenção.pdf"), "x");
    await writeFile(join(raiz, "Balancete Janeiro.pdf"), "x");
    const sub = join(raiz, "Assembleias", "2024");
    await mkdir(sub, { recursive: true });
    await writeFile(join(sub, "Ata AGO 2024.pdf"), "x");
    await writeFile(join(sub, "Convite.pdf"), "x");

    const encontrados = await varrerPastaDocumentos(raiz);
    const nomes = encontrados.map((a) => a.nomeArquivo).sort();

    expect(nomes).toEqual(["Ata AGO 2024.pdf", "Convenção.pdf"]);
  });

  it("monta o caminho relativo com barras normais, mesmo no Windows", async () => {
    const sub = join(raiz, "Assembleias");
    await mkdir(sub, { recursive: true });
    await writeFile(join(sub, "Ata 2024.pdf"), "x");

    const [achado] = await varrerPastaDocumentos(raiz);
    expect(achado.caminhoRelativo).toBe("Assembleias/Ata 2024.pdf");
    expect(achado.tipo).toBe("ata");
  });
});
