import { centavos, mesesNoPeriodo } from "./demonstrativo";
import type { AjustePrevisao, Arredondamento, Demonstrativo, Exercicio, IndiceCorrecao } from "./types";

/**
 * Previsão orçamentária do exercício seguinte.
 *
 * Regra (definida pelo escritório):
 *   anual ajustado = base − dedução + variação + Σ ajustes "+" − Σ ajustes "−"
 * onde
 *   base      = total das despesas realizadas no demonstrativo;
 *   dedução   = despesas cujo nome (ou grupo) casa com `deducaoRegex`;
 *   variação  = (base − dedução) × variação % — exceto no método "valor", onde variação é um R$
 *               direto (ajuste subjetivo da empresa), somado sem multiplicar pela base.
 * A partir do anual ajustado (regra do escritório — a reserva NÃO é somada ao mensal antes de dividir):
 *   mensal              = anual ajustado ÷ 12
 *   cota por unidade    = anual ajustado ÷ 12 ÷ unidades
 *   reserva por unidade = cota por unidade × % do fundo de reserva
 *   valor por unidade   = cota por unidade + reserva por unidade (com o arredondamento escolhido)
 *   índice              = compara o valor por unidade com o rateio atual (valor ÷ rateio atual − 1)
 * Ex.: 120.000 anual → 10.000/mês; 100 unidades → 100,00; reserva 10% → 10,00; total 110,00.
 */

export interface LinhaPrevisao {
  grupo: string;
  nome: string;
  realizado: number;
  previsto: number;
  /** true quando a linha (ou parte dela) foi retirada pela dedução. */
  deduzida: boolean;
}

export interface ResultadoPrevisao {
  modo: "tradicional" | "detalhado";
  linhas: LinhaPrevisao[];
  ajustes: AjustePrevisao[];
  base: number;
  deducao: number;
  linhasDeducao: { grupo: string; nome: string; valor: number }[];
  baseLiquida: number;
  /** 0 quando o método é "valor" (variação em R$ direto, sem percentual associado). */
  variacaoPct: number;
  variacaoValor: number;
  /** Variação de despesas sugeridas, separada dos ajustes por grupo. */
  variacaoDespesasValor: number;
  ajustesMais: number;
  ajustesMenos: number;
  /** Anual ajustado. */
  totalAnual: number;
  /** Quantidade de meses coberta pelo período analisado. */
  mesesAnalisados: number;
  /** Anual ajustado ÷ mesesAnalisados. */
  mensal: number;
  fundoReservaPct: number;
  /** Anual ajustado ÷ 12 ÷ unidades (null sem unidades). */
  cotaUnidade: number | null;
  /** Cota por unidade × % do fundo de reserva (null sem unidades). */
  reservaUnidade: number | null;
  unidades: number | null;
  /** Valor por unidade, já arredondado. */
  rateioSugerido: number | null;
  rateioAtual: number | null;
  /** Reajuste % sobre o rateio atual (null sem rateio atual ou unidades). */
  indice: number | null;
  avisos: string[];
}

export type ParametrosPrevisao = Pick<
  Exercicio,
  "variacao" | "variacaoMetodo" | "variacaoParam" | "arredondamento" | "prev" | "deducaoRegex" | "rateioAtual"
> & { indices?: IndiceCorrecao[] };

/** Aplica o arredondamento do condomínio ao valor por unidade. */
export function arredondarValor(valor: number, modo: Arredondamento): number {
  const v = centavos(valor);
  if (modo === "truncar") return Math.trunc(v);
  if (modo === "arredondar") return Math.round(v);
  return v;
}

/** Monta a expressão de dedução; texto inválido como expressão vira busca literal. */
export function expressaoDeducao(texto: string | null | undefined): RegExp | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  try {
    return new RegExp(t, "i");
  } catch {
    return new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}

/**
 * Variação conforme o método do exercício. "valor" devolve `valorFixo` (R$, somado direto à base
 * líquida, sem percentual) — os demais devolvem `pct` (percentual aplicado sobre a base líquida).
 */
export function resolverVariacao(
  p: Pick<ParametrosPrevisao, "variacao" | "variacaoMetodo" | "variacaoParam" | "indices">,
): { pct: number; valorFixo?: number; aviso?: string } {
  if (p.variacaoMetodo === "valor") return { pct: 0, valorFixo: p.variacaoParam ?? 0 };
  if (p.variacaoMetodo === "percentual") return { pct: p.variacaoParam ?? p.variacao ?? 0 };
  if (p.variacaoMetodo === "mediaIndices") {
    const validos = (p.indices ?? [])
      .filter((i): i is { ano: number | null; pct: number } => typeof i.pct === "number" && Number.isFinite(i.pct))
      .sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
    const n = p.variacaoParam && p.variacaoParam > 0 ? Math.trunc(p.variacaoParam) : validos.length;
    const usados = validos.slice(0, n);
    if (usados.length === 0) return { pct: 0, aviso: "Nenhum índice de correção informado para calcular a média." };
    const media = usados.reduce((s, i) => s + i.pct, 0) / usados.length;
    return { pct: Math.round(media * 10000) / 10000 };
  }
  return { pct: p.variacao ?? 0 };
}

export function somarAjustes(ajustes: AjustePrevisao[] | undefined) {
  let mais = 0;
  let menos = 0;
  for (const a of ajustes ?? []) {
    const v = Math.abs(Number(a.valor) || 0);
    if (a.sinal === "-") menos += v;
    else mais += v;
  }
  return { mais: centavos(mais), menos: centavos(menos) };
}

/** Base financeira pra projetar a previsão de um exercício: o realizado do exercício anterior
 * (já fechado) — nunca o demonstrativo do próprio exercício, que vai sendo preenchido ao longo do
 * ano e não pode servir de base móvel pra uma previsão que precisa ficar estável. Sem exercício
 * anterior (primeira prestação do condomínio), cai no demonstrativo do próprio. Usada por todo
 * consumidor da previsão (editor, relatório final, previsto × realizado, listagens) pra nunca
 * divergir sobre de onde ela parte. */
export function demonstrativoBasePrevisao(
  exercicio: Pick<Exercicio, "demonstrativo">,
  exercicioAnterior: Pick<Exercicio, "demonstrativo"> | null | undefined,
): Demonstrativo | null {
  return exercicioAnterior?.demonstrativo ?? exercicio.demonstrativo;
}

export function calcularPrevisao(
  demonstrativo: Demonstrativo | null,
  parametros: ParametrosPrevisao,
  unidades: number | null,
): ResultadoPrevisao {
  const avisos: string[] = [];
  const modo = parametros.prev?.modo ?? "tradicional";
  const ajustes = (parametros.prev?.ajustes ?? []).filter((a) => a.descricao.trim().toLocaleLowerCase("pt-BR") !== "água");
  const variacaoDespesas = parametros.prev?.variacaoDespesas;
  const re = expressaoDeducao(parametros.deducaoRegex);
  const { pct, valorFixo, aviso } = resolverVariacao(parametros);
  if (aviso) avisos.push(aviso);
  const ehValorFixo = parametros.variacaoMetodo === "valor";
  // Variação fora de uma faixa plausível (ex.: valor em R$ digitado onde se esperava %) produziria
  // um total sem sentido sem isso — avisa em vez de só calcular silenciosamente. Não se aplica ao
  // método "valor": ali a variação já é um R$ direto, não um percentual.
  if (!ehValorFixo && Math.abs(pct) > 100) {
    avisos.push(`Variação de ${pct}% é incomum para um reajuste anual — confira se não foi digitado um valor em R$ no lugar do percentual.`);
  }
  // No método "valor" a variação é um acréscimo/redução de R$ sobre o total, não distribuído por
  // despesa (como os ajustes) — por isso o fator de cada linha/grupo fica em 1 (sem variação).
  const fator = ehValorFixo ? 1 : 1 + pct / 100;

  const grupos = demonstrativo?.despesas.grupos ?? [];
  if (!demonstrativo || grupos.every((g) => g.itens.length === 0)) {
    avisos.push("O demonstrativo ainda não tem despesas lançadas.");
  }

  const linhas: LinhaPrevisao[] = [];
  const linhasDeducao: ResultadoPrevisao["linhasDeducao"] = [];
  let base = 0;
  let deducao = 0;

  for (const g of grupos) {
    const grupoDeduzido = !!re && re.test(g.nome);
    let realizadoGrupo = 0;
    let deduzidoGrupo = 0;
    for (const it of g.itens) {
      const valor = Number(it.valor) || 0;
      const deduzido = grupoDeduzido || (!!re && re.test(it.nome));
      realizadoGrupo += valor;
      if (deduzido) {
        deduzidoGrupo += valor;
        linhasDeducao.push({ grupo: g.nome, nome: it.nome, valor: centavos(valor) });
      }
      if (modo === "detalhado") {
        linhas.push({
          grupo: g.nome,
          nome: it.nome,
          realizado: centavos(valor),
          previsto: deduzido ? 0 : centavos(valor * fator),
          deduzida: deduzido,
        });
      }
    }
    base += realizadoGrupo;
    deducao += deduzidoGrupo;
    if (modo === "tradicional") {
      linhas.push({
        grupo: g.nome,
        nome: g.nome,
        realizado: centavos(realizadoGrupo),
        previsto: centavos((realizadoGrupo - deduzidoGrupo) * fator),
        deduzida: deduzidoGrupo !== 0,
      });
    }
  }

  base = centavos(base);
  deducao = centavos(deducao);
  const baseLiquida = centavos(base - deducao);
  const variacaoValor = ehValorFixo ? centavos(valorFixo ?? 0) : centavos(baseLiquida * (pct / 100));
  const ajustesTotais = somarAjustes(ajustes);
  const variacaoDespesasValor = variacaoDespesas && variacaoDespesas.valor > 0
    ? centavos((variacaoDespesas.sinal === "-" ? -1 : 1) * variacaoDespesas.valor)
    : 0;
  const mais = ajustesTotais.mais;
  const menos = ajustesTotais.menos;
  const totalAnual = centavos(baseLiquida + variacaoValor + mais - menos);
  const totalComVariacaoDespesas = centavos(totalAnual + variacaoDespesasValor);

  const mesesAnalisados = demonstrativo?.periodo.ini && demonstrativo.periodo.fim ? mesesNoPeriodo(demonstrativo.periodo.ini, demonstrativo.periodo.fim) ?? 12 : 12;
  const mensal = centavos(totalComVariacaoDespesas / mesesAnalisados);
  const fundoReservaPct = parametros.prev?.fundoReservaPct ?? 0;

  const temUnidades = typeof unidades === "number" && unidades > 0;
  if (!temUnidades) avisos.push("Informe a quantidade de unidades no cadastro do condomínio para calcular o valor por unidade.");
  // Sem arredondar as etapas intermediárias; o arredondamento vale só para o valor final por unidade.
  const cota = temUnidades ? totalComVariacaoDespesas / mesesAnalisados / unidades : null;
  const reserva = cota !== null ? cota * (fundoReservaPct / 100) : null;
  const rateioSugerido = cota !== null && reserva !== null ? arredondarValor(cota + reserva, parametros.arredondamento) : null;

  const rateioAtual = parametros.rateioAtual ?? null;
  const indice =
    rateioSugerido !== null && rateioAtual && rateioAtual > 0
      ? Math.round((rateioSugerido / rateioAtual - 1) * 1000000) / 10000
      : null;

  return {
    modo,
    linhas,
    ajustes,
    base,
    deducao,
    linhasDeducao,
    baseLiquida,
    variacaoPct: pct,
    variacaoValor,
    ajustesMais: mais,
    ajustesMenos: menos,
    totalAnual: totalComVariacaoDespesas,
    variacaoDespesasValor,
    mesesAnalisados,
    mensal,
    fundoReservaPct,
    cotaUnidade: cota !== null ? centavos(cota) : null,
    reservaUnidade: reserva !== null ? centavos(reserva) : null,
    unidades: temUnidades ? unidades : null,
    rateioSugerido,
    rateioAtual,
    indice,
    avisos,
  };
}

export interface DesvioAnoAnterior {
  /** O que o exercício anterior projetou pra este ano (`totalAnual` dele, já com a variação) —
   * ajustado proporcionalmente ao período do exercício atual quando ele cobrir menos (ou mais) de
   * 12 meses, pra comparar maçã com maçã. */
  previsto: number;
  /** O que este exercício realmente gastou, líquido da mesma dedução usada no previsto (ex.:
   * "fundo de caixa p/ obras") — senão uma despesa deduzida do previsto, mas presente no
   * realizado, infla o desvio sem ter ficado mais cara de verdade. */
  realizado: number;
  /** (realizado ÷ previsto − 1), em %. Base sugerida — nunca aplicada sozinha — pra variação do
   * próximo exercício, e referência pro reajuste da taxa condominial. */
  desvioPct: number;
}

/**
 * Compara o previsto que o exercício anterior calculou pra este ano (prorrateado ao período do
 * exercício atual, caso ele não cubra os 12 meses cheios — o sistema aceita exercícios mais
 * curtos, ver `mesesNoPeriodo`) com o que este exercício realmente realizou, líquido da mesma
 * dedução (`parametrosAnterior.deducaoRegex`) usada no previsto. `null` quando falta um dos dois
 * lados (exercício atual ainda sem despesas lançadas — especificamente despesas, não qualquer
 * lançamento: um demonstrativo só com receitas ou saldos não é "realizado" pra fins de desvio —
 * ou anterior sem previsto válido) — nada a sugerir ainda.
 */
export function calcularDesvioAnoAnterior(
  demonstrativoAnterior: Demonstrativo | null,
  parametrosAnterior: ParametrosPrevisao,
  demonstrativoAtual: Demonstrativo | null,
): DesvioAnoAnterior | null {
  if (!demonstrativoAtual?.despesas.grupos.some((g) => g.itens.length > 0)) return null;
  const previstoAnual = calcularPrevisao(demonstrativoAnterior, parametrosAnterior, null).totalAnual;
  if (previstoAnual <= 0) return null;
  const meses = mesesNoPeriodo(demonstrativoAtual.periodo.ini, demonstrativoAtual.periodo.fim);
  const previsto = meses && meses > 0 && meses !== 12 ? centavos((previstoAnual * meses) / 12) : previstoAnual;
  const re = expressaoDeducao(parametrosAnterior.deducaoRegex);
  const realizado = centavos(
    demonstrativoAtual.despesas.grupos.reduce((soma, g) => {
      const grupoDeduzido = !!re && re.test(g.nome);
      const totalGrupo = g.itens.reduce((s, it) => {
        const deduzido = grupoDeduzido || (!!re && re.test(it.nome));
        return deduzido ? s : s + (Number(it.valor) || 0);
      }, 0);
      return soma + totalGrupo;
    }, 0),
  );
  const desvioPct = Math.round((realizado / previsto - 1) * 10000) / 100;
  return { previsto, realizado, desvioPct };
}
