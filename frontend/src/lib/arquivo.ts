/** Lê o arquivo escolhido como data URL (mesmo formato do logotipo do escritório). */
export function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => (typeof leitor.result === "string" ? ok(leitor.result) : falha(new Error("Não foi possível ler o arquivo.")));
    leitor.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

/** Converte um data URL guardado de volta em arquivo, para baixar. */
export async function dataUrlParaBlob(dataUrl: string): Promise<Blob> {
  const resposta = await fetch(dataUrl);
  return resposta.blob();
}

/** Tamanho aproximado, em bytes, do arquivo guardado num data URL (base64). */
export function bytesDoDataUrl(dataUrl: string): number {
  const virgula = dataUrl.indexOf(",");
  const base64 = virgula >= 0 ? dataUrl.slice(virgula + 1) : dataUrl;
  const sobra = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - sobra);
}
