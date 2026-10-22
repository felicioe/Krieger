import { formatData } from "@/lib/format";
import type { RelatorioLido } from "@/domain/pdfParser";
import type { TipoAnexoImportacao } from "@/domain/types";

export const ROTULO_TIPO_ANEXO: Record<TipoAnexoImportacao, string> = {
  comparativo_financeiro: "Comparativo Financeiro",
};

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
