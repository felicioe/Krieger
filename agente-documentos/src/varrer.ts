import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { classificarArquivo, type TipoDocumento } from "./filtro.js";

export interface ArquivoEncontrado {
  caminhoAbsoluto: string;
  caminhoRelativo: string;
  nomeArquivo: string;
  tipo: TipoDocumento;
}

/**
 * Varre recursivamente `raiz` olhando só os NOMES dos arquivos (readdir, sem ler conteúdo) —
 * por isso é barata mesmo num acervo de 160+ GB. Só os arquivos que batem com o padrão de
 * convenção/regimento/ata entram no resultado; tudo o mais é ignorado sem nunca ser aberto.
 */
export async function varrerPastaDocumentos(raiz: string): Promise<ArquivoEncontrado[]> {
  const encontrados: ArquivoEncontrado[] = [];

  async function visitar(pasta: string): Promise<void> {
    const itens = await readdir(pasta, { withFileTypes: true });
    for (const item of itens) {
      const caminhoAbsoluto = join(pasta, item.name);
      if (item.isDirectory()) {
        await visitar(caminhoAbsoluto);
        continue;
      }
      if (!item.isFile()) continue;
      const tipo = classificarArquivo(item.name);
      if (!tipo) continue;
      encontrados.push({
        caminhoAbsoluto,
        caminhoRelativo: relative(raiz, caminhoAbsoluto).split("\\").join("/"),
        nomeArquivo: item.name,
        tipo,
      });
    }
  }

  await visitar(raiz);
  return encontrados;
}
