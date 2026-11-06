import type { Condominio, Exercicio, IndiceCorrecao } from "./types";

/** Validação compartilhada do cadastro. Um reajuste anual pertence somente ao condomínio. */
export function validarIndicesCondominio(indices: IndiceCorrecao[]): IndiceCorrecao[] {
  const anos = new Set<number>();
  return indices.map((i) => {
    if (i.ano === null || !Number.isInteger(i.ano) || i.ano < 1900 || i.ano > 2999 || i.pct === null || !Number.isFinite(i.pct) || Math.abs(i.pct) > 999999.9999) {
      throw new Error("Informe ano e percentual válidos para cada índice.");
    }
    if (anos.has(i.ano)) throw new Error("Há mais de um índice para o mesmo ano. Revise o histórico antes de salvar.");
    anos.add(i.ano);
    return { ano: i.ano, pct: Math.round(i.pct * 10000) / 10000, noRelatorio: i.noRelatorio !== false };
  }).sort((a, b) => a.ano! - b.ano!);
}

/** Não sobrescreve cadastro mantido manualmente, nem recria índices excluídos pelo usuário. */
export function inicializarIndicesImportados(c: Condominio, e: Pick<Exercicio, "condoId" | "consid">): Condominio {
  if (c.id !== e.condoId || c.indicesInicializados || !e.consid.indices.length) return c;
  return { ...c, indices: validarIndicesCondominio(c.indices.length ? c.indices : e.consid.indices), indicesInicializados: true };
}
