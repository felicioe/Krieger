/** Imagens para os documentos: tudo vira PNG (aceito pelos dois formatos). Só no navegador. */

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error("Não foi possível ler uma imagem do documento."));
    i.src = src;
  });
}

function desenhar(img: CanvasImageSource, w: number, h: number, fundoBranco: boolean): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador sem suporte a imagens.");
  if (fundoBranco) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export interface Png {
  dataUrl: string;
  largura: number;
  altura: number;
}

const cache = new Map<string, Promise<Png>>();

/** Converte qualquer data URL de imagem em PNG e informa o tamanho natural. */
export function carregarPng(dataUrl: string): Promise<Png> {
  let p = cache.get(dataUrl);
  if (!p) {
    p = carregar(dataUrl).then((img) => ({
      dataUrl: dataUrl.startsWith("data:image/png") ? dataUrl : desenhar(img, img.naturalWidth, img.naturalHeight, false),
      largura: img.naturalWidth,
      altura: img.naturalHeight,
    }));
    cache.set(dataUrl, p);
  }
  return p;
}

export const paraPng = async (dataUrl: string) => (await carregarPng(dataUrl)).dataUrl;

/** Bytes de uma data URL base64. */
export function bytesDe(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Rasteriza um SVG (gráficos) em PNG nítido, com fundo branco. */
export async function svgParaPng(svg: string, largura: number, altura: number, escala = 3): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await carregar(url);
    return desenhar(img, largura * escala, altura * escala, true);
  } finally {
    URL.revokeObjectURL(url);
  }
}
