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
 * Percentual aprovado gravado no histórico de rateios para o ano-base (a prestação que aprovou o
 * reajuste do exercício seguinte). Usa a variação gravada na linha; se ela estiver vazia, recalcula
 * entre o rateio atual (ou sugerido) e o aprovado da própria linha. `0` é um valor válido; `null`
 * significa que o histórico não traz percentual aprovado para o ano.
 */
export function percentualAprovadoDoHistorico(
  linhas: HistoricoRateio[],
  condoId: string,
  anoBase: number,
): number | null {
  const linha = historicoDoAno(linhas, condoId, anoBase);
  if (!linha) return null;
  if (typeof linha.variacao === "number" && Number.isFinite(linha.variacao)) return linha.variacao;
  const base = linha.rateioAtual ?? linha.rateioSugerido;
  return calcularVariacao(base ?? null, linha.rateioAprovado ?? null);
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
  // No fluxo normal, um demonstrativo com despesas já é a previsão consolidada e não pode
  // receber o índice outra vez. O modo "Previsão para relatórios" remove o demonstrativo antes
  // desta chamada e passa a base anterior separadamente, permitindo aplicar o índice uma única vez.
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

// ---------- Tela "Histórico de rateios" (issue #292) ----------

const arred6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Variação % de `atual` sobre `anterior` com a precisão gravada (6 casas), sem o arredondamento a 2
 * casas de `calcularVariacao`. Serve de sugestão para o usuário não perder as casas calculadas.
 */
export function variacaoCompleta(anterior: number | null, atual: number | null): number | null {
  if (anterior === null || atual === null || !Number.isFinite(anterior) || !Number.isFinite(atual) || anterior === 0)
    return null;
  return arred6((atual / anterior - 1) * 100);
}

/** Percentual no padrão brasileiro com até 6 casas (mínimo 2), sem zeros inúteis à direita. */
export function formatarPercentualCompleto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export interface EntradaLinhaHistorico {
  condoId: string;
  condoNome?: string;
  ano: number | null;
  rateioAtual: number | null;
  rateioAprovado: number | null;
  rateioSugerido: number | null;
  /** % digitado pelo usuário; vazio (null) = usar o calculado. */
  percentualInformado: number | null;
}

/** Sugestões de % com todas as casas: a do aprovado e a do sugerido do sistema, sobre o rateio atual. */
export function sugestoesPercentual(e: Pick<EntradaLinhaHistorico, "rateioAtual" | "rateioAprovado" | "rateioSugerido">) {
  return {
    doAprovado: variacaoCompleta(e.rateioAtual, e.rateioAprovado),
    doSugerido: variacaoCompleta(e.rateioAtual, e.rateioSugerido),
  };
}

/** Erros (por campo) e avisos (não bloqueantes) da linha de histórico em edição. */
export function validarLinhaHistorico(e: EntradaLinhaHistorico): {
  erros: Partial<Record<"condoId" | "ano" | "rateioAprovado" | "percentualInformado" | "rateioAtual", string>>;
  avisos: string[];
} {
  const erros: ReturnType<typeof validarLinhaHistorico>["erros"] = {};
  const avisos: string[] = [];
  if (!e.condoId) erros.condoId = "Escolha o condomínio.";
  if (!e.ano || !Number.isInteger(e.ano) || e.ano < 1900 || e.ano > 2999) erros.ano = "Informe o ano com 4 dígitos.";
  if (e.rateioAprovado === null || !Number.isFinite(e.rateioAprovado) || e.rateioAprovado < 0)
    erros.rateioAprovado = "Informe o rateio aprovado.";
  if (e.rateioAtual !== null && (!Number.isFinite(e.rateioAtual) || e.rateioAtual < 0))
    erros.rateioAtual = "O rateio atual não pode ser negativo.";
  if (e.percentualInformado !== null && (!Number.isFinite(e.percentualInformado) || e.percentualInformado < -100 || e.percentualInformado > 1000))
    erros.percentualInformado = "Informe um percentual entre −100% e 1.000%.";
  const calculado = variacaoCompleta(e.rateioAtual, e.rateioAprovado);
  const emUso = e.percentualInformado ?? calculado;
  if (emUso === null) avisos.push("Sem rateio atual não há % calculado: informe o % ou o rateio atual.");
  else if (emUso === 0) avisos.push("O % em uso é 0%. Confira se o rateio atual não foi copiado do aprovado.");
  if (e.percentualInformado !== null && calculado !== null && Math.abs(e.percentualInformado - calculado) > 0.005)
    avisos.push(`O % informado (${formatarPercentualCompleto(e.percentualInformado)}%) difere do calculado dos rateios (${formatarPercentualCompleto(calculado)}%). Vale o informado.`);
  return { erros, avisos };
}

/** Linha de histórico (sem id) a partir do formulário: o % informado vale mais que o calculado. */
export function montarLinhaHistorico(
  e: EntradaLinhaHistorico,
  base: { exercicioId?: string | null; travadoEm: string },
): Omit<HistoricoRateio, "id"> {
  const aprovado = centavos(e.rateioAprovado ?? 0);
  const informado = e.percentualInformado !== null;
  return {
    condoId: e.condoId,
    ...(e.condoNome ? { condoNome: e.condoNome } : {}),
    ano: Number(e.ano),
    rateioAtual: e.rateioAtual === null ? null : centavos(e.rateioAtual),
    rateioSugerido: e.rateioSugerido === null ? null : centavos(e.rateioSugerido),
    variacao: informado ? arred6(e.percentualInformado as number) : variacaoCompleta(e.rateioAtual, aprovado),
    variacaoOrigem: informado ? "informado" : "calculado",
    rateioAprovado: aprovado,
    travadoEm: base.travadoEm,
    fonte: "manual",
    exercicioId: base.exercicioId ?? null,
  };
}

/**
 * Ao travar o rateio na previsão, o % informado na tela de histórico não pode ser trocado pelo
 * calculado: mantém `variacao` e a origem da linha existente quando ela foi informada.
 */
export function preservarPercentualInformado<T extends Pick<HistoricoRateio, "variacao" | "variacaoOrigem">>(
  nova: T,
  existente: Pick<HistoricoRateio, "variacao" | "variacaoOrigem"> | null | undefined,
): T {
  if (existente?.variacaoOrigem !== "informado") return nova;
  return { ...nova, variacao: existente.variacao, variacaoOrigem: "informado" };
}

/**
 * Lê um percentual digitado: vírgula ou ponto como separador decimal (percentual não tem milhar, então
 * "8.932" é 8,932 e não 8.932). Vazio ou inválido = null.
 */
export function parsePercentualCompleto(texto: string | null | undefined): number | null {
  const s = (texto ?? "").replace(/%|\s/g, "").replace(",", ".");
  if (s === "" || s === "-" || !/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? arred6(n) : null;
}

