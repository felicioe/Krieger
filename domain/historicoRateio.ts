import { centavos } from "./demonstrativo";
import type { Exercicio, HistoricoRateio } from "./types";

/**
 * Histórico de rateios travados por condomínio/ano.
 *
 * Cada exercício cujo rateio foi "travado" gera uma linha no store `historico_rateios`.
 * É a fonte acumulativa que permite:
 *   (a) o relatório final mostrar o rateio do ano anterior;
 *   (b) o exercício seguinte herdar `rateioAtual` automaticamente;
 *   (c) calcular a variação % entre anos sem depender de recálculo.
 *
 * O valor travado é sempre **por unidade** (o rateio mensal que o condômino paga).
 */

/** Variação % de `atual` sobre `anterior`. `null` quando falta um dos dois. */
export function calcularVariacao(
  anterior: number | null,
  atual: number | null,
): number | null {
  if (anterior === null || atual === null || anterior === 0) return null;
  return Math.round((atual / anterior - 1) * 10000) / 100;
}

/** Linha de histórico a partir de um exercício cujo rateio foi travado. */
export function historicoDoExercicio(
  e: Pick<
    Exercicio,
    "id" | "condoId" | "condoNome" | "ano" | "rateioAtual" | "rateioAprovado"
  >,
  rateioSugerido: number | null,
  fonte: HistoricoRateio["fonte"],
  travadoEm: string,
): Omit<HistoricoRateio, "id"> {
  const aprovado = centavos(e.rateioAprovado ?? rateioSugerido ?? 0);
  return {
    condoId: e.condoId,
    condoNome: e.condoNome,
    ano: Number(e.ano),
    rateioAtual:
      e.rateioAtual === null || e.rateioAtual === undefined
        ? null
        : centavos(e.rateioAtual),
    rateioSugerido: rateioSugerido === null ? null : centavos(rateioSugerido),
    variacao: calcularVariacao(e.rateioAtual ?? null, aprovado),
    rateioAprovado: aprovado,
    travadoEm,
    fonte,
    exercicioId: e.id,
  };
}

/** Histórico de um condomínio, do ano mais antigo para o mais recente. */
export function historicoOrdenado(
  linhas: HistoricoRateio[],
  condoId: string,
): HistoricoRateio[] {
  return linhas
    .filter((l) => l.condoId === condoId)
    .sort((a, b) => Number(a.ano) - Number(b.ano));
}

/** Linha do ano pedido, se já foi travada. */
export function historicoDoAno(
  linhas: HistoricoRateio[],
  condoId: string,
  ano: number,
): HistoricoRateio | null {
  return (
    linhas.find(
      (l) => l.condoId === condoId && Number(l.ano) === Number(ano),
    ) ?? null
  );
}

/**
 * Rateio por unidade que serve de base para o exercício `ano`: o aprovado do ano anterior
 * travado no histórico. Cai para `null` quando não há ano anterior registrado.
 */
export function rateioBaseDoAno(
  linhas: HistoricoRateio[],
  condoId: string,
  ano: number,
): number | null {
  const anterior = historicoDoAno(linhas, condoId, Number(ano) - 1);
  return anterior ? anterior.rateioAprovado : null;
}

/**
 * Variação % do exercício `ano` sobre o ano anterior, usando o histórico travado.
 * Prefere o valor travado do próprio ano; se ainda não travou, usa o sugerido.
 */
export function variacaoDoAno(
  linhas: HistoricoRateio[],
  condoId: string,
  ano: number,
  rateioSugerido: number | null,
): number | null {
  const base = rateioBaseDoAno(linhas, condoId, ano);
  if (base === null) return null;
  const proprio = historicoDoAno(linhas, condoId, ano);
  const valor = proprio ? proprio.rateioAprovado : rateioSugerido;
  return calcularVariacao(base, valor);
}

/**
 * Mescla o histórico com o exercício: devolve o exercício com `rateioAtual` preenchido pelo
 * aprovado do ano anterior quando ele estiver vazio. Não sobrescreve valor já informado.
 */
export function aplicarRateioBase<
  T extends Pick<Exercicio, "condoId" | "ano" | "rateioAtual">,
>(e: T, linhas: HistoricoRateio[]): T {
  if (e.rateioAtual !== null && e.rateioAtual !== undefined) return e;
  const base = rateioBaseDoAno(linhas, e.condoId, Number(e.ano));
  return base === null ? e : { ...e, rateioAtual: base };
}

/**
 * Injeta a variação % nos parâmetros de previsão quando o exercício não tem variação explícita
 * (variacaoMetodo === "manual" e variacao === 0). Tenta primeiro o histórico de rateios; se não
 * houver dados suficientes (ex.: primeira prestação do condomínio), usa o rateioAtual e o
 * rateioAprovado do próprio exercício como fallback — sem isso, o previsto fica igual à base e
 * ignora o índice aprovado (caso Lago Negro 2026: R$ 851.955,11 sem acréscimo).
 *
 * Retorna uma cópia dos parâmetros com variacao/variacaoParam preenchidos; se já houver variação
 * definida ou não houver base para calcular, devolve os parâmetros originais.
 */
export function aplicarVariacaoDoHistorico<T extends {
  condoId?: string;
  ano?: number | string;
  variacao?: number | null;
  variacaoMetodo?: string;
  variacaoParam?: number | null;
  rateioAtual?: number | null;
  rateioAprovado?: number | null;
  demonstrativo?: { despesas?: { grupos?: { itens?: unknown[] }[] } } | null;
}>(params: T, linhas: HistoricoRateio[]): T {
  if (!params.condoId || params.ano == null) return params;
  // Só injeta quando não há variação explícita no exercício (valor diferente de zero).
  if (params.variacao && params.variacao !== 0) return params;
  if (params.variacaoParam && params.variacaoParam !== 0) return params;
  // Se o exercício já tem demonstrativo com despesas realizadas, não injeta variação do histórico.
  // O previsto deve ser igual ao realizado; a variação histórica serve apenas para projetar
  // exercícios futuros que ainda não têm dados. Caso Lago Negro 2026: aplicava 15,26% sobre
  // R$ 982.212,87 gerando R$ 1.132.098,55 em vez de manter R$ 982.212,87.
  const temDespesas = params.demonstrativo?.despesas?.grupos?.some(
    (g) => g.itens && g.itens.length > 0,
  );
  if (temDespesas) return params;

  // Busca a variação % já gravada na linha do exercício ANTERIOR (ano - 1). É esse índice
  // apurado que se aplica à previsão do exercício atual. Ex.: previsão de 2026 usa a variação
  // de ~15,26% calculada e travada em 2025, não um recálculo entre rateios.
  const linhaAnterior = historicoDoAno(linhas, params.condoId, Number(params.ano) - 1);
  let pct = linhaAnterior?.variacao ?? null;

  // Quando o campo variacao da linha anterior for null (ex.: primeira prestação sem base),
  // recalcula a partir dos rateios gravados naquela mesma linha. Usa rateioSugerido como
  // base quando rateioAtual for null — caso do Lago Negro 2025, onde só havia rateioAprovado
  // e rateioSugerido (=370) mas nenhum rateioAtual anterior para comparar.
  if ((pct === null || pct === 0) && linhaAnterior?.rateioAprovado) {
    const base = linhaAnterior.rateioAtual ?? linhaAnterior.rateioSugerido;
    if (base) pct = calcularVariacao(base, linhaAnterior.rateioAprovado);
  }

  // Último fallback: calcula a variação entre rateioAtual e rateioAprovado do próprio exercício.
  if ((pct === null || pct === 0) && params.rateioAtual && params.rateioAprovado) {
    pct = calcularVariacao(params.rateioAtual, params.rateioAprovado);
  }

  if (pct === null || pct === 0) return params;

  return {
    ...params,
    variacao: pct,
    variacaoMetodo: "percentual",
    variacaoParam: pct,
  };
}
