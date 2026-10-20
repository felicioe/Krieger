import type { Demonstrativo, LinhaValor } from "./types";

/** Arredonda para centavos (evita resíduos de ponto flutuante). */
export function centavos(n: number): number {
  const r = Math.round(Math.abs(n) * 100 + 1e-7) / 100;
  return n < 0 ? -r : r;
}

export const somar = (linhas: LinhaValor[] | undefined): number =>
  centavos((linhas ?? []).reduce((s, l) => s + (Number(l.valor) || 0), 0));

export function demonstrativoVazio(condominio = ""): Demonstrativo {
  return {
    condominio,
    periodo: { ini: "", fim: "" },
    saldoAnterior: { contas: [], total: 0 },
    receitas: { itens: [], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [], subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: [], total: 0 },
    totais: { saldoAnterior: 0, receitas: 0, despesas: 0, saldoAtual: 0 },
    avisos: [],
    erros: [],
  };
}

/** Completa um demonstrativo vindo da API/backup com a estrutura mínima. */
export function normalizarDemonstrativo(raw: Partial<Demonstrativo> | null | undefined, condominio = ""): Demonstrativo {
  const v = demonstrativoVazio(condominio);
  if (!raw) return v;
  return recalcularDemonstrativo({
    ...v,
    ...raw,
    periodo: { ...v.periodo, ...raw.periodo },
    saldoAnterior: { ...v.saldoAnterior, ...raw.saldoAnterior, contas: raw.saldoAnterior?.contas ?? [] },
    receitas: { ...v.receitas, ...raw.receitas, itens: raw.receitas?.itens ?? [] },
    despesas: {
      ...v.despesas,
      ...raw.despesas,
      grupos: (raw.despesas?.grupos ?? []).map((g) => ({ nome: g.nome ?? "", itens: g.itens ?? [] })),
    },
    saldoAtual: { ...v.saldoAtual, ...raw.saldoAtual, contas: raw.saldoAtual?.contas ?? [] },
    avisos: raw.avisos ?? [],
    erros: raw.erros ?? [],
  });
}

/**
 * Recalcula subtotais e totais a partir das linhas e confere o fechamento:
 * saldo anterior + receitas − despesas deve ser igual ao saldo atual informado.
 */
export function recalcularDemonstrativo(d: Demonstrativo): Demonstrativo {
  const saldoAnterior = somar(d.saldoAnterior.contas);
  const receitas = somar(d.receitas.itens);
  const despesas = centavos(d.despesas.grupos.reduce((s, g) => s + somar(g.itens), 0));
  const saldoAtual = somar(d.saldoAtual.contas);
  const totalComSaldo = centavos(saldoAnterior + receitas);
  const saldoRestante = centavos(totalComSaldo - despesas);

  const avisos: string[] = [];
  if (d.saldoAtual.contas.length > 0 && Math.abs(saldoRestante - saldoAtual) >= 0.01) {
    avisos.push(
      `O saldo atual informado difere do calculado (saldo anterior + receitas − despesas) em ${formatar(centavos(saldoAtual - saldoRestante))}.`,
    );
  }

  return {
    ...d,
    saldoAnterior: { ...d.saldoAnterior, total: saldoAnterior },
    receitas: { ...d.receitas, subtotal: receitas, totalComSaldo },
    despesas: { ...d.despesas, subtotal: despesas, saldoRestante },
    saldoAtual: { ...d.saldoAtual, total: saldoAtual },
    totais: { saldoAnterior, receitas, despesas, saldoAtual },
    avisos,
  };
}

function formatar(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
