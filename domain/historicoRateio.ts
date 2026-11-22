import { centavos } from "./demonstrativo";
import type { Exercicio, HistoricoRateio, PrevisaoAprovada } from "./types";

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
  /** Motivo ou observação da linha (opcional). */
  observacao?: string;
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
    ...(e.observacao?.trim() ? { observacao: e.observacao.trim() } : {}),
    fonte: "manual",
    exercicioId: base.exercicioId ?? null,
  };
}

/**
 * Ao travar o rateio na previsão, o % informado na tela de histórico não pode ser trocado pelo
 * calculado: mantém `variacao` e a origem da linha existente quando ela foi informada.
 */
export function preservarPercentualInformado<
  T extends Pick<HistoricoRateio, "variacao" | "variacaoOrigem" | "observacao">,
>(
  nova: T,
  existente: Pick<HistoricoRateio, "variacao" | "variacaoOrigem" | "observacao"> | null | undefined,
): T {
  if (!existente) return nova;
  let r = nova;
  if (existente.variacaoOrigem === "informado")
    r = { ...r, variacao: existente.variacao, variacaoOrigem: "informado" };
  // A observação da linha também sobrevive ao travar o rateio.
  if (existente.observacao && !r.observacao) r = { ...r, observacao: existente.observacao };
  return r;
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

// ---------- Histórico de rateios dentro do cadastro do condomínio (issue #297) ----------

/** Linha editável do histórico no cadastro do condomínio. */
export interface LinhaRateioForm {
  /** Id da linha gravada; null em linha nova. */
  idExistente: string | null;
  ano: number | null;
  rateioAtual: number | null;
  rateioAprovado: number | null;
  /** Sugestão do sistema gravada na linha (só leitura na tela). */
  rateioSugerido: number | null;
  /** % digitado; vazio = usar o calculado. */
  textoPercentual: string;
  /** % gravado e sua origem, para mostrar o que está em uso numa linha que ninguém mexeu. */
  variacaoGravada: number | null;
  origemGravada: "calculado" | "informado";
  fonte: HistoricoRateio["fonte"];
  exercicioId: string | null;
  /** Motivo ou observação da linha (opcional). */
  observacao: string;
}

export const linhaRateioDe = (h: HistoricoRateio): LinhaRateioForm => ({
  idExistente: h.id,
  ano: Number(h.ano),
  rateioAtual: h.rateioAtual,
  rateioAprovado: h.rateioAprovado,
  rateioSugerido: h.rateioSugerido,
  textoPercentual:
    h.variacaoOrigem === "informado" && h.variacao !== null ? formatarPercentualCompleto(h.variacao) : "",
  variacaoGravada: h.variacao,
  origemGravada: h.variacaoOrigem === "informado" ? "informado" : "calculado",
  fonte: h.fonte,
  exercicioId: h.exercicioId,
  observacao: h.observacao ?? "",
});

export const linhaRateioNova = (ano: number | null = null): LinhaRateioForm => ({
  idExistente: null,
  ano,
  rateioAtual: null,
  rateioAprovado: null,
  rateioSugerido: null,
  textoPercentual: "",
  variacaoGravada: null,
  origemGravada: "calculado",
  fonte: "manual",
  exercicioId: null,
  observacao: "",
});

/** Linhas do condomínio, da mais recente para a mais antiga. */
export const linhasRateioDoCondominio = (historico: HistoricoRateio[], condoId: string): LinhaRateioForm[] =>
  historico
    .filter((h) => h.condoId === condoId)
    .sort((a, b) => Number(b.ano) - Number(a.ano))
    .map(linhaRateioDe);

/** A linha mudou em relação ao que está gravado (só estes campos são editáveis). */
export const linhaRateioAlterada = (a: LinhaRateioForm, b: LinhaRateioForm): boolean =>
  a.ano !== b.ano ||
  a.rateioAtual !== b.rateioAtual ||
  a.rateioAprovado !== b.rateioAprovado ||
  a.textoPercentual.trim() !== b.textoPercentual.trim() ||
  a.observacao.trim() !== b.observacao.trim();

const paraEntrada = (l: LinhaRateioForm, condoId: string, condoNome?: string): EntradaLinhaHistorico => ({
  condoId,
  ...(condoNome ? { condoNome } : {}),
  ano: l.ano,
  rateioAtual: l.rateioAtual,
  rateioAprovado: l.rateioAprovado,
  rateioSugerido: l.rateioSugerido,
  percentualInformado: parsePercentualCompleto(l.textoPercentual),
  observacao: l.observacao,
});

/** % em uso: o informado; senão, o gravado numa linha inalterada; senão, o calculado dos rateios. */
export function percentualEmUsoDaLinha(
  l: LinhaRateioForm,
  inalterada: boolean,
): { valor: number | null; origem: "calculado" | "informado" } {
  const informado = parsePercentualCompleto(l.textoPercentual);
  if (informado !== null) return { valor: informado, origem: "informado" };
  if (inalterada && l.idExistente) return { valor: l.variacaoGravada, origem: l.origemGravada };
  return { valor: variacaoCompleta(l.rateioAtual, l.rateioAprovado), origem: "calculado" };
}

/** Erros por linha (mesma ordem) e gerais; anos repetidos e campos inválidos impedem salvar. */
export function validarLinhasRateio(
  linhas: LinhaRateioForm[],
  condoId: string,
): { porLinha: (string | null)[]; ok: boolean } {
  const vistos = new Map<number, number>();
  const porLinha = linhas.map((l, i) => {
    const textoInvalido = l.textoPercentual.trim() !== "" && parsePercentualCompleto(l.textoPercentual) === null;
    const { erros } = validarLinhaHistorico(paraEntrada(l, condoId || "x"));
    const msg = textoInvalido ? "Digite o percentual como número, por exemplo 8,93." : (Object.values(erros)[0] ?? null);
    if (msg) return msg;
    const ano = l.ano as number;
    if (vistos.has(ano)) return `O ano ${ano} aparece mais de uma vez.`;
    vistos.set(ano, i);
    return null;
  });
  return { porLinha, ok: porLinha.every((m) => m === null) };
}

export interface PlanoHistorico {
  salvar: (Omit<HistoricoRateio, "id"> & { id: string })[];
  excluir: string[];
}

/**
 * O que gravar ao salvar o cadastro: só linhas novas ou alteradas (linhas antigas não são
 * reescritas), exclui as removidas e, se o ano de uma linha gravada mudou, exclui a antiga e cria
 * outra (a chave única é condomínio + ano). Exclusões vêm antes das gravações.
 */
export function planejarHistorico(
  iniciais: LinhaRateioForm[],
  atuais: LinhaRateioForm[],
  ctx: { condoId: string; condoNome?: string; agora: string; novoId: () => string },
): PlanoHistorico {
  const inicialPorId = new Map(iniciais.filter((l) => l.idExistente).map((l) => [l.idExistente as string, l]));
  const mantidos = new Set<string>();
  const plano: PlanoHistorico = { salvar: [], excluir: [] };
  for (const l of atuais) {
    const antiga = l.idExistente ? inicialPorId.get(l.idExistente) : undefined;
    if (antiga && !linhaRateioAlterada(antiga, l)) {
      mantidos.add(antiga.idExistente as string);
      continue;
    }
    const mudouAno = antiga && antiga.ano !== l.ano;
    if (antiga && !mudouAno) mantidos.add(antiga.idExistente as string);
    const linha = montarLinhaHistorico(paraEntrada(l, ctx.condoId, ctx.condoNome), {
      exercicioId: mudouAno ? null : l.exercicioId,
      travadoEm: ctx.agora,
    });
    plano.salvar.push({ ...linha, id: antiga && !mudouAno ? (l.idExistente as string) : ctx.novoId() });
  }
  for (const [id] of inicialPorId) if (!mantidos.has(id)) plano.excluir.push(id);
  return plano;
}

/** Avisos de uma linha: previsto do ano seguinte já gravado com % diferente e exercício seguinte fechado. */
export function avisosDaLinhaRateio(
  ano: number | null,
  emUso: number | null,
  previsoes: Pick<PrevisaoAprovada, "condoId" | "exercicioDestino" | "percentualAprovado" | "versao">[],
  exerciciosFechados: { condoId: string; ano: number | string }[],
  condoId: string,
): string[] {
  if (ano === null) return [];
  const avisos: string[] = [];
  const previsto = previsoes.find((p) => p.condoId === condoId && Number(p.exercicioDestino) === ano + 1);
  if (previsto && emUso !== null && Math.abs(previsto.percentualAprovado - emUso) > 0.005) {
    avisos.push(
      `O previsto de ${ano + 1} já está gravado com ${formatarPercentualCompleto(previsto.percentualAprovado)}% (v${previsto.versao}) e não muda ao salvar aqui. Para atualizá-lo, reabra e feche o exercício de ${ano}.`,
    );
  }
  if (exerciciosFechados.some((e) => e.condoId === condoId && Number(e.ano) === ano + 1)) {
    avisos.push(
      `O exercício de ${ano + 1} está fechado: relatórios dele que ainda derivam o previsto do histórico mudam com este percentual.`,
    );
  }
  return avisos;
}

/**
 * Continuidade do histórico: o rateio atual de um ano deveria ser o rateio aprovado do ano anterior.
 * Quando diferem (edição do histórico, importação com valor diferente), o % calculado muda sem aviso;
 * devolve um aviso por ano com o % que sairia usando o aprovado anterior (issue #299).
 */
export function avisosContinuidadeRateio(linhas: LinhaRateioForm[]): string[] {
  const avisos: string[] = [];
  const porAno = new Map<number, LinhaRateioForm>();
  for (const l of linhas) if (l.ano !== null) porAno.set(l.ano, l);
  for (const [ano, l] of [...porAno.entries()].sort((a, b) => b[0] - a[0])) {
    const anterior = porAno.get(ano - 1);
    if (l.rateioAtual === null || !anterior || anterior.rateioAprovado === null) continue;
    if (Math.abs(l.rateioAtual - anterior.rateioAprovado) <= 0.005) continue;
    const alternativa = variacaoCompleta(anterior.rateioAprovado, l.rateioAprovado);
    avisos.push(
      `${ano}: o rateio atual (${formatarBRL(l.rateioAtual)}) difere do rateio aprovado de ${ano - 1} (${formatarBRL(anterior.rateioAprovado)}).` +
        (alternativa === null
          ? ""
          : ` Com o aprovado de ${ano - 1} o percentual calculado seria ${formatarPercentualCompleto(alternativa)}%.`),
    );
  }
  return avisos;
}

const formatarBRL = (v: number): string =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- Histórico na Previsão Orçamentária (issue #294) ----------

type ExercicioParaTravar = Pick<Exercicio, "id" | "condoId" | "condoNome" | "ano" | "rateioAtual" | "rateioAprovado">;

export interface PlanoTravamento {
  /** Linha do histórico do ano do exercício, já com id (o da existente, se houver). */
  linha: Omit<HistoricoRateio, "id"> & { id: string };
  /** Exercício seguinte sem rateio atual, que passa a ter o aprovado como base; null se não há. */
  proximo: { id: string; rateioAtual: number } | null;
}

/**
 * Travar o rateio na Previsão: a linha do histórico do ano (herdando o rateio atual do ano anterior
 * e preservando o % informado e a observação da linha existente) e a propagação do aprovado como
 * `rateioAtual` do exercício seguinte, quando ele existe e ainda não tem um.
 */
export function planejarTravamentoRateio(entrada: {
  exercicio: ExercicioParaTravar;
  aprovado: number;
  historico: HistoricoRateio[];
  exercicios: Pick<Exercicio, "id" | "condoId" | "ano" | "rateioAtual">[];
  agora: string;
  novoId: () => string;
}): PlanoTravamento {
  const { exercicio, aprovado, historico, exercicios, agora, novoId } = entrada;
  const comBase = aplicarRateioBase(exercicio, historico);
  const nova = historicoDoExercicio({ ...comBase, rateioAprovado: aprovado }, aprovado, "calculo", agora);
  const existente = historico.find((h) => h.condoId === nova.condoId && Number(h.ano) === nova.ano);
  const linha = { ...preservarPercentualInformado(nova, existente), id: existente?.id ?? novoId() };
  const proximo = exercicios.find(
    (x) =>
      x.condoId === exercicio.condoId &&
      Number(x.ano) === Number(exercicio.ano) + 1 &&
      (x.rateioAtual === null || x.rateioAtual === undefined),
  );
  return { linha, proximo: proximo ? { id: proximo.id, rateioAtual: aprovado } : null };
}

/** Linha do ano anterior (a base da previsão): a gravada ou uma nova, vazia e editável. */
export function linhaAnoAnterior(historico: HistoricoRateio[], condoId: string, ano: number): LinhaRateioForm {
  const existente = historicoDoAno(historico, condoId, ano - 1);
  return existente ? linhaRateioDe(existente) : linhaRateioNova(ano - 1);
}

/** Plano para gravar a linha do ano anterior editada na Previsão (cria ou atualiza só ela). */
export function planejarAnoAnterior(
  historico: HistoricoRateio[],
  editada: LinhaRateioForm,
  ctx: { condoId: string; condoNome?: string; agora: string; novoId: () => string },
): PlanoHistorico {
  const gravada = historicoDoAno(historico, ctx.condoId, (editada.ano ?? 0));
  const iniciais = gravada ? [linhaRateioDe(gravada)] : [];
  const atuais = [gravada ? { ...editada, idExistente: gravada.id } : { ...editada, idExistente: null }];
  return planejarHistorico(iniciais, atuais, ctx);
}

