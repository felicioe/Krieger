/** Formato devolvido por `documentos_manifesto` (snake_case, igual ao SELECT em lib_documentos.php). */
export interface ItemManifesto {
  id: string;
  caminho_relativo: string;
  hash: string;
  tamanho: number;
}

export interface CandidatoLocal {
  caminhoRelativo: string;
  hash: string;
  tamanho: number;
}

/**
 * Decide quais candidatos locais precisam ser (re)enviados: os que não existem ainda no
 * manifesto remoto, ou cujo hash mudou desde a última indexação. Nunca reenvia o que já
 * está igual — é o que mantém a varredura rápida mesmo com o acervo crescendo.
 */
export function precisaReenviar(candidatos: CandidatoLocal[], remoto: ItemManifesto[]): CandidatoLocal[] {
  const porCaminho = new Map(remoto.map((item) => [item.caminho_relativo, item]));
  return candidatos.filter((c) => {
    const existente = porCaminho.get(c.caminhoRelativo);
    return !existente || existente.hash !== c.hash;
  });
}
