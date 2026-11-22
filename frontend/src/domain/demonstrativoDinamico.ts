import { competenciaMensal, mesAnoDe, normalizarMensal, ordemCompetencia } from "./mensal";
import { mesesNoPeriodo, recalcularDemonstrativo } from "./demonstrativo";
import type { Demonstrativo, Mensal } from "./types";

/** Diagnóstico de uma consolidação pedida sobre o período da prestação. */
export interface ConsolidacaoPeriodo {
  demonstrativo: Demonstrativo;
  /** Meses mensais encontrados no período e quantos meses o período cobre. */
  usados: number;
  meses: number | null;
  /**
   * `completa` quando há um mensal para cada mês do período; `parcial` quando a série tem
   * buraco; `vazia` quando não há nenhum mensal do condomínio dentro do período.
   */
  estado: "completa" | "parcial" | "vazia";
  /** Mensagem pronta para a tela; `null` quando a consolidação é completa. */
  aviso: string | null;
}

/** Meses mensais do condomínio dentro do período da prestação, em ordem de competência. */
function mensaisNoPeriodo(base: Demonstrativo, mensais: Mensal[], condoId?: string): Mensal[] {
  const inicio = mesAnoDe(base.periodo.ini);
  const fim = mesAnoDe(base.periodo.fim);
  if (!inicio || !fim) return [];
  const inicioNumero = ordemCompetencia(inicio);
  const fimNumero = ordemCompetencia(fim);
  return mensais
    .filter((m) => {
      const n = ordemCompetencia(competenciaMensal(m));
      return (!condoId || m.condoId === condoId) && n >= inicioNumero && n <= fimNumero;
    })
    .map(normalizarMensal)
    .sort(
      (a, b) => ordemCompetencia(competenciaMensal(a)) - ordemCompetencia(competenciaMensal(b)),
    );
}

/**
 * Soma os relatórios mensais do período e devolve o demonstrativo resultante **com o diagnóstico
 * de cobertura**. Nunca é chamada sozinha pela tela: consolidar substitui as contas do salvo pelas
 * dos mensais, então quem chama decide (e avisa) em vez de trocar o demonstrativo em silêncio.
 *
 * Por que a cobertura importa: um único mensal (por exemplo o primeiro mês de um comparativo)
 * dentro de um exercício anual tem receitas, despesas e saldos de **um mês**. Somar só ele e
 * chamar de exercício apaga as contas que só o balanço traz e faz a reimportação do PDF acusar
 * dezenas de divergências — foi o caso do Lago Negro 2025 (1 mensal em 11 meses).
 */
export function consolidarPeriodo(
  base: Demonstrativo,
  mensais: Mensal[],
  condoId?: string,
): ConsolidacaoPeriodo {
  const usados = mensaisNoPeriodo(base, mensais, condoId);
  const meses = mesesNoPeriodo(base.periodo.ini, base.periodo.fim);
  if (usados.length === 0) {
    return {
      demonstrativo: base,
      usados: 0,
      meses,
      estado: "vazia",
      aviso: meses
        ? `Nenhum relatório mensal deste condomínio dentro do período (${meses} ${meses === 1 ? "mês" : "meses"}).`
        : "Nenhum relatório mensal deste condomínio dentro do período.",
    };
  }
  const completa = meses !== null && usados.length >= meses;
  if (!completa) {
    const primeiro = competenciaMensal(usados[0]!);
    const ultimo = competenciaMensal(usados.at(-1)!);
    return {
      demonstrativo: base,
      usados: usados.length,
      meses,
      estado: "parcial",
      aviso:
        `Cobertura incompleta: ${usados.length} ${usados.length === 1 ? "relatório mensal" : "relatórios mensais"}` +
        (primeiro && ultimo ? ` (${rotulo(primeiro)} a ${rotulo(ultimo)})` : "") +
        (meses ? ` em um período de ${meses} meses` : "") +
        ". Consolidar assim substituiria as contas do demonstrativo salvo pelas de poucos meses — o demonstrativo foi mantido.",
    };
  }
  return {
    demonstrativo: somarMensais(base, usados),
    usados: usados.length,
    meses,
    estado: "completa",
    aviso: null,
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");
const rotulo = (c: { mes: number; ano: number }) => `${p2(c.mes)}/${c.ano}`;

function somarMensais(base: Demonstrativo, usados: Mensal[]): Demonstrativo {
  const receitas = new Map<string, number>();
  const grupos = new Map<string, Map<string, number>>();
  for (const mensal of usados) {
    const d = mensal.demonstrativo!;
    for (const item of d.receitas.itens)
      receitas.set(item.nome, (receitas.get(item.nome) ?? 0) + item.valor);
    for (const grupo of d.despesas.grupos) {
      const itens = grupos.get(grupo.nome) ?? new Map<string, number>();
      for (const item of grupo.itens)
        itens.set(item.nome, (itens.get(item.nome) ?? 0) + item.valor);
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
      grupos: [...grupos].map(([nome, itens]) => ({
        nome,
        itens: [...itens].map(([itemNome, valor]) => ({ nome: itemNome, valor })),
      })),
    },
  });
}
