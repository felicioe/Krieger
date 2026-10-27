export type TipoDocumento = "convencao" | "regimento" | "ata";

const PADROES: Array<[RegExp, TipoDocumento]> = [
  [/convenc/i, "convencao"],
  [/regiment/i, "regimento"],
  [/\batas?\b/i, "ata"],
  [/assemble/i, "ata"],
];

function removerAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Classifica um arquivo pelo nome, sem ler o conteúdo — é o que permite varrer 160 GB
 * misturados sem nunca abrir os arquivos que não interessam (ver agente-documentos/README.md).
 * Retorna null para qualquer coisa que não seja PDF ou não bata com nenhum padrão.
 */
export function classificarArquivo(nomeArquivo: string): TipoDocumento | null {
  if (!/\.pdf$/i.test(nomeArquivo)) return null;
  const normalizado = removerAcentos(nomeArquivo);
  for (const [padrao, tipo] of PADROES) {
    if (padrao.test(normalizado)) return tipo;
  }
  return null;
}
