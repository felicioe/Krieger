import type { DestinoImportacao } from "@/domain/types";

/**
 * Registros que ACABARAM de ser criados a partir de um PDF nesta sessão do navegador.
 * Só serve para o editor saber, ao abrir logo depois da criação, que os totais atuais vieram do PDF
 * — assim o primeiro Salvar confere a divergência. Fica só na memória: recarregar a página ou abrir o
 * registro mais tarde não "inventa" uma importação que o usuário não acabou de fazer.
 */
const criados = new Set<string>();
const chave = (destino: DestinoImportacao, id: string) => `${destino}:${id}`;

export function marcarCriadoPorPdf(destino: DestinoImportacao, id: string): void {
  criados.add(chave(destino, id));
}

export function foiCriadoPorPdf(destino: DestinoImportacao, id: string): boolean {
  return criados.has(chave(destino, id));
}

export function esquecerCriadoPorPdf(destino: DestinoImportacao, id: string): void {
  criados.delete(chave(destino, id));
}
