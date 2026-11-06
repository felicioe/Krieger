/** Lê uma imagem e a reduz para no máximo `larguraMax` px de largura (base64). */
export async function redimensionarImagem(
  arquivo: File,
  larguraMax = 900,
): Promise<{ dataUrl: string; ratio: number }> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não foi possível ler a imagem."));
      i.src = url;
    });
    const escala = Math.min(1, larguraMax / img.naturalWidth);
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Navegador sem suporte a imagens.");
    ctx.drawImage(img, 0, 0, w, h);
    const tipo = arquivo.type === "image/jpeg" ? "image/jpeg" : "image/png";
    return { dataUrl: canvas.toDataURL(tipo, 0.9), ratio: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
