import { api } from "@/lib/api";
import { formatData } from "@/lib/format";
import type { RelatorioLido } from "@/domain/pdfParser";
import type { AnexoImportado, TipoAnexoImportacao } from "@/domain/types";

export const ROTULO_TIPO_ANEXO: Record<TipoAnexoImportacao, string> = {
  comparativo_financeiro: "Comparativo Financeiro",
};

/** Tamanho máximo do PDF anexado, definido pelo responsável: 10 MB. */
export const LIMITE_PDF_ANEXO = 10 * 1024 * 1024;
export const ERRO_PDF_GRANDE = "PDF maior que 10 MB — escolha um arquivo menor.";

/**
 * Exclui a prestação de contas e, antes, todos os anexos dela (decisão do responsável: cascata).
 * Os anexos saem primeiro: se algo falhar no meio, a prestação continua e a exclusão pode ser
 * repetida, sem deixar anexo órfão de uma prestação que já não existe.
 */
export async function excluirPrestacaoComAnexos(exercicioId: string): Promise<number> {
  const anexos = await api.listar<AnexoImportado>("anexos_importacao");
  const dela = anexos.filter((a) => a.exercicioId === exercicioId);
  for (const a of dela) await api.excluir("anexos_importacao", a.id);
  await api.excluir("exercicios", exercicioId);
  return dela.length;
}

/** Período lido do PDF, só para exibir ("07/2026 a 08/2026" ou "01/08/2026 a 31/08/2026"). */
export function textoPeriodo(rel: RelatorioLido): string {
  const p = rel.periodo;
  if (!p) return "Não identificado";
  if ("competenciaInicio" in p) return `${p.competenciaInicio} a ${p.competenciaFim}`;
  return `${formatData(p.inicio)} a ${formatData(p.fim)}`;
}

/** Condomínio como veio escrito no PDF ("(73) Estrelas do Mar · CNPJ …"). */
export function textoCondominioLido(rel: RelatorioLido): string {
  const c = rel.condominio;
  const partes = [c.codigo ? `(${c.codigo})` : "", c.nome ?? ""].filter(Boolean).join(" ");
  return [partes || "Sem nome", c.cnpj ? `CNPJ ${c.cnpj}` : ""].filter(Boolean).join(" · ");
}
