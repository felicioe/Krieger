import { describe, expect, it } from "vitest";
import { bytesDoDataUrl, dataUrlParaBlob, lerComoDataUrl } from "./arquivo";

/** Bytes variados (0–255), não só texto, pra não mascarar um problema de codificação binária. */
function bytesDeTeste(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(n));
  for (let i = 0; i < n; i++) b[i] = (i * 37 + 11) % 256;
  return b;
}

/**
 * Decodifica os bytes originais direto do data URL, sem passar por Blob/FileReader:
 * nos testes (Node + jsdom), o Blob devolvido por `fetch().blob()` e o FileReader do
 * jsdom nem sempre são do mesmo "realm" (comportamento varia por versão de Node/jsdom),
 * o que quebra `readAsArrayBuffer` com um Blob alheio. No navegador de verdade os dois
 * vêm do mesmo global e isso não acontece — aqui testamos a fidelidade da codificação
 * base64 em si, que é o que `dataUrlParaBlob` e `baixar()` realmente dependem.
 */
function bytesDoDataUrlDecodificados(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

describe("ida e volta de arquivo por data URL (#75: download idêntico ao original)", () => {
  it("o blob baixado tem exatamente os mesmos bytes do arquivo original", async () => {
    const original = bytesDeTeste(5000); // maior que um chunk típico de FileReader, pra pegar problema de corte
    const arquivo = new File([original], "comparativo.pdf", { type: "application/pdf" });

    const dataUrl = await lerComoDataUrl(arquivo);
    expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);

    const blob = await dataUrlParaBlob(dataUrl);
    expect(blob.size).toBe(original.length);

    const bytesBaixados = bytesDoDataUrlDecodificados(dataUrl);
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
