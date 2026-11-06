import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

export interface HashArquivo {
  hash: string;
  tamanho: number;
}

/** SHA-256 + tamanho de um arquivo, lendo em stream (nunca carrega o arquivo inteiro na memória). */
export async function hashArquivo(caminho: string): Promise<HashArquivo> {
  const info = await stat(caminho);
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const leitura = createReadStream(caminho);
    leitura.on("data", (pedaco) => hash.update(pedaco));
    leitura.on("end", () => resolve());
    leitura.on("error", reject);
  });
  return { hash: hash.digest("hex"), tamanho: info.size };
}
