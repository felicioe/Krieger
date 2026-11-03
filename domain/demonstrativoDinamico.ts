import { competenciaMensal, mesAnoDe, normalizarMensal, ordemCompetencia } from "./mensal";
import { recalcularDemonstrativo } from "./demonstrativo";
import type { Demonstrativo, Mensal } from "./types";

/** Consolida os relatórios mensais existentes dentro do período da prestação. */
export function demonstrativoDoPeriodo(base: Demonstrativo, mensais: Mensal[], condoId?: string): Demonstrativo {
  const inicio = mesAnoDe(base.periodo.ini);
  const fim = mesAnoDe(base.periodo.fim);
  if (!inicio || !fim) return base;
  const inicioNumero = ordemCompetencia(inicio);
  const fimNumero = ordemCompetencia(fim);
  const usados = mensais
    .filter((m) => {
      const n = ordemCompetencia(competenciaMensal(m));
      return (!condoId || m.condoId === condoId) && n >= inicioNumero && n <= fimNumero;
    })
    .map(normalizarMensal)
    .sort((a, b) => ordemCompetencia(competenciaMensal(a)) - ordemCompetencia(competenciaMensal(b)));
  if (usados.length === 0) return base;

  const receitas = new Map<string, number>();
  const grupos = new Map<string, Map<string, number>>();
  for (const mensal of usados) {
    const d = mensal.demonstrativo!;
    for (const item of d.receitas.itens) receitas.set(item.nome, (receitas.get(item.nome) ?? 0) + item.valor);
    for (const grupo of d.despesas.grupos) {
      const itens = grupos.get(grupo.nome) ?? new Map<string, number>();
      for (const item of grupo.itens) itens.set(item.nome, (itens.get(item.nome) ?? 0) + item.valor);
      grupos.set(grupo.nome, itens);
    }
  }
  const primeiro = usados[0]!.demonstrativo!;
  const ultimo = usados.at(-1)!.demonstrativo!;
  return recalcularDemonstrativo({
    ...base,
    saldoAnterior: primeiro.saldoAnterior,
    saldoAtual: ultimo.saldoAtual,
    receitas: { ...base.receitas, itens: [...receitas].map(([nome, valor]) => ({ nome, valor })) },
    despesas: {
      ...base.despesas,
      grupos: [...grupos].map(([nome, itens]) => ({ nome, itens: [...itens].map(([itemNome, valor]) => ({ nome: itemNome, valor })) })),
    },
  });
}
