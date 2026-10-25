import { describe, expect, it } from "vitest";
import { bytesDoDataUrl, dataUrlParaBlob, lerComoDataUrl } from "./arquivo";

/** Bytes variados (0–255), não só texto, pra não mascarar um problema de codificação binária. */
function bytesDeTeste(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(n));
  for (let i = 0; i < n; i++) b[i] = (i * 37 + 11) % 256;
  return b;
}

/** blob.arrayBuffer() não existe no jsdom desta versão; lê via FileReader. */
function lerBlob(blob: Blob): Promise<Uint8Array> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.onerror = () => falha(new Error("Não foi possível ler o blob."));
    leitor.readAsArrayBuffer(blob);
  });
}

describe("ida e volta de arquivo por data URL (#75: download idêntico ao original)", () => {
  it("o blob baixado tem exatamente os mesmos bytes do arquivo original", async () => {
    const original = bytesDeTeste(5000); // maior que um chunk típico de FileReader, pra pegar problema de corte
    const arquivo = new File([original], "comparativo.pdf", { type: "application/pdf" });

    const dataUrl = await lerComoDataUrl(arquivo);
    expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);

    const blob = await dataUrlParaBlob(dataUrl);
    const bytesBaixados = await lerBlob(blob);

    expect(bytesBaixados.length).toBe(original.length);
    expect(Array.from(bytesBaixados)).toEqual(Array.from(original));
  });

  it("bytesDoDataUrl acerta o tamanho real, incluindo padding de base64", async () => {
    for (const tamanho of [1, 2, 3, 4, 100, 5000]) {
      const arquivo = new File([bytesDeTeste(tamanho)], "x.pdf", { type: "application/pdf" });
      const dataUrl = await lerComoDataUrl(arquivo);
      expect(bytesDoDataUrl(dataUrl)).toBe(tamanho);
    }
  });

  it("arquivo vazio não quebra a ida e volta", async () => {
    const arquivo = new File([], "vazio.pdf", { type: "application/pdf" });
    const dataUrl = await lerComoDataUrl(arquivo);
    const blob = await dataUrlParaBlob(dataUrl);
    expect(blob.size).toBe(0);
  });
});
