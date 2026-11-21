import { centavos } from "./demonstrativo";
import { chaveRotulo, mesesDoExercicioSeguinte } from "./previstoRealizado";
import { competenciaMensal } from "./mensal";
import type { Condominio, DePara, Demonstrativo, Exercicio, Mensal } from "./types";

/**
 * Previsão para relatórios (menu Financeiro → Previsão para relatórios).
 *
 * Regras confirmadas pelo responsável (issue #282):
 * - Realizado = o que foi efetivamente lançado no exercício avaliado. Vem dos relatórios mensais
 *   (DRE mensal ou comparativo mensal) dentro do período do exercício. Sem nenhum mensal no período,
 *   usa o demonstrativo da própria prestação de contas e avisa a origem.
 * - Previsto = total realizado do exercício ANTERIOR × (1 + % considerado na prestação de contas),
 *   proporcional aos meses com realizado (anual × meses ÷ 12).
 * - Variação = (realizado − previsto) ÷ previsto — mesmo sentido de `classificar`
 *   (`previstoRealizado.ts`) e do restante do sistema.
 * - Sem exercício anterior (primeira prestação carregada) não há base histórica: o previsto e a
 *   variação não são calculados (`semBase`).
 * - Grupos e contas que só existem no ano anterior entram no previsto; os que só existem no
 *   realizado entram com previsto zero. Rubricas casam pelo nome (sem acento/maiúsculas), após o
 *   de-para do condomínio.
 * - Sem deduções, ajustes ou variação de despesas sugeridas (exclusivos do rateio).
 */

export interface LinhaPrevisaoRelatorio {
  grupo: string;
  nome: string;
  previsto: number;
  realizado: number;
  /** realizado − previsto. */
  diferenca: number;
  /** (realizado − previsto) ÷ previsto, em %; null sem previsto. */
  variacaoPct: number | null;
}

export interface GrupoPrevisaoRelatorio extends Omit<LinhaPrevisaoRelatorio, "grupo"> {
  contas: LinhaPrevisaoRelatorio[];
}

export type OrigemRealizado = "mensais" | "prestacao";

export interface ResultadoPrevisaoRelatorio {
  /** true quando não há exercício anterior com despesas: previsto e variação não se aplicam. */
  semBase: boolean;
  origemRealizado: OrigemRealizado;
  /** Meses considerados no previsto proporcional. */
  meses: number;
  /** Rótulo (mm/aaaa) do último mês com relatório mensal; null quando a origem é a prestação. */
  mesAte: string | null;
  /** Relatórios mensais somados no realizado. */
  relatoriosUsados: number;
  /** Percentual de reajuste aplicado sobre a base do ano anterior. */
  reajustePct: number;
  grupos: GrupoPrevisaoRelatorio[];
  total: Omit<LinhaPrevisaoRelatorio, "grupo" | "nome">;
  avisos: string[];
}

export interface OpcoesPrevisaoRelatorio {
  condominio?: Pick<Condominio, "mapeamento"> | null;
  /** Demonstrativo do exercício anterior (base do previsto); null/undefined = sem base. */
  demonstrativoBase?: Demonstrativo | null;
  /** Reajuste % resolvido pela previsão (`calcularPrevisao().variacaoPct`). */
  reajustePct: number;
  /** Método da variação do exercício; "valor" (R$ fixo) não se distribui por conta. */
  variacaoMetodo?: string;
}

/** Variação em %, 2 casas; null sem previsto. */
export function variacaoPct(realizado: number, previsto: number): number | null {
  if (previsto === 0) return null;
  return Math.round(((realizado - previsto) / Math.abs(previsto)) * 10000) / 100;
}

interface Acum {
  nome: string;
  base: number;
  realizado: number;
}

interface AcumGrupo {
  nome: string;
  contas: Map<string, Acum>;
}

const temDespesas = (d: Demonstrativo | null | undefined): d is Demonstrativo =>
  !!d?.despesas?.grupos?.some((g) => g.itens?.some((i) => (Number(i.valor) || 0) !== 0 || !!i.nome));

export function calcularPrevisaoParaRelatorios(
  exercicio: Exercicio,
  mensais: Mensal[],
  opcoes: OpcoesPrevisaoRelatorio,
): ResultadoPrevisaoRelatorio {
  let condominio = opcoes.condominio ?? null;
  let base = opcoes.demonstrativoBase ?? null;
  if (exercicio.fechado && exercicio.fechamento) {
    mensais = exercicio.fechamento.mensais;
    condominio = exercicio.fechamento.condominio;
    base = exercicio.fechamento.exercicioAnterior?.demonstrativo ?? base;
  }
  const avisos: string[] = [];
  const mapa = new Map(
    (condominio?.mapeamento ?? []).filter((d: DePara) => d.de?.trim()).map((d) => [chaveRotulo(d.de), d.para] as const),
  );
  const nomeDe = (s: string) => mapa.get(chaveRotulo(s)) ?? s;

  const semBase = !temDespesas(base);
  const fator = 1 + opcoes.reajustePct / 100;
  if (semBase) {
    avisos.push("Sem exercício anterior com despesas: não há base histórica, então o previsto e a variação não são calculados.");
  }
  if (opcoes.variacaoMetodo === "valor") {
    avisos.push("A variação do exercício é um valor fixo em R$, que não se distribui por conta: o previsto foi calculado sem reajuste percentual.");
  }

  // Janela e relatórios mensais do período do exercício.
  const janela = mesesDoExercicioSeguinte(exercicio);
  const chave = (m: { mes: number; ano: number }) => m.ano * 100 + m.mes;
  const posicaoPorMes = new Map(janela.map((m, i) => [chave(m), i + 1]));
  const porPosicao = new Map<number, Mensal[]>();
  let semPeriodo = 0;
  for (const m of mensais) {
    if (m.condoId !== exercicio.condoId) continue;
    const c = competenciaMensal(m);
    if (!c) {
      semPeriodo++;
      continue;
    }
    const pos = posicaoPorMes.get(chave(c));
    if (pos) porPosicao.set(pos, [...(porPosicao.get(pos) ?? []), m]);
  }
  const posicoesComRelatorio = [...porPosicao.keys()].sort((a, b) => a - b);
  const relatoriosUsados = posicoesComRelatorio.reduce((s, p) => s + (porPosicao.get(p)?.length ?? 0), 0);
  const origemRealizado: OrigemRealizado = relatoriosUsados > 0 ? "mensais" : "prestacao";
  if (semPeriodo > 0) avisos.push(`${semPeriodo} relatório(s) mensal(is) sem período informado ficaram de fora.`);

  let meses = janela.length;
  let mesAte: string | null = null;
  const fontes: Demonstrativo[] = [];
  if (origemRealizado === "mensais") {
    const posAte = posicoesComRelatorio[posicoesComRelatorio.length - 1]!;
    meses = posAte;
    const m = janela[posAte - 1]!;
    mesAte = `${String(m.mes).padStart(2, "0")}/${m.ano}`;
    const faltando = janela
      .slice(0, posAte)
      .filter((_, i) => !porPosicao.has(i + 1))
      .map((x) => `${String(x.mes).padStart(2, "0")}/${x.ano}`);
    if (faltando.length > 0) avisos.push(`Sem relatório mensal em: ${faltando.join(", ")}. O realizado desses meses conta como zero.`);
    const duplicados = janela
      .slice(0, posAte)
      .filter((_, i) => (porPosicao.get(i + 1)?.length ?? 0) > 1)
      .map((x) => `${String(x.mes).padStart(2, "0")}/${x.ano}`);
    if (duplicados.length > 0) avisos.push(`Mais de um relatório mensal em: ${duplicados.join(", ")}. Todos foram somados; confira se não há duplicidade.`);
    for (const p of posicoesComRelatorio) for (const r of porPosicao.get(p) ?? []) if (r.demonstrativo) fontes.push(r.demonstrativo);
  } else {
    if (exercicio.demonstrativo) fontes.push(exercicio.demonstrativo);
    avisos.push("Sem relatório mensal no período: o realizado vem do demonstrativo da prestação de contas.");
  }

  const grupos = new Map<string, AcumGrupo>();
  const conta = (grupo: string, nome: string): Acum => {
    const gk = chaveRotulo(grupo);
    let g = grupos.get(gk);
    if (!g) {
      g = { nome: grupo, contas: new Map() };
      grupos.set(gk, g);
    }
    const ck = chaveRotulo(nome);
    let c = g.contas.get(ck);
    if (!c) {
      c = { nome, base: 0, realizado: 0 };
      g.contas.set(ck, c);
    }
    return c;
  };

  if (!semBase) {
    for (const g of base!.despesas.grupos) {
      for (const it of g.itens ?? []) conta(nomeDe(g.nome), nomeDe(it.nome)).base += Number(it.valor) || 0;
    }
  }
  for (const d of fontes) {
    for (const g of d.despesas?.grupos ?? []) {
      for (const it of g.itens ?? []) conta(nomeDe(g.nome), nomeDe(it.nome)).realizado += Number(it.valor) || 0;
    }
  }

  const fecharLinha = (previsto: number, realizado: number) => {
    const p = semBase ? 0 : previsto;
    const r = centavos(realizado);
    return {
      previsto: centavos(p),
      realizado: r,
      diferenca: semBase ? 0 : centavos(r - p),
      variacaoPct: semBase ? null : variacaoPct(r, centavos(p)),
    };
  };

  const resultadoGrupos: GrupoPrevisaoRelatorio[] = [];
  let totalPrevisto = 0;
  let totalRealizado = 0;
  for (const g of grupos.values()) {
    const contas: LinhaPrevisaoRelatorio[] = [];
    let gp = 0;
    let gr = 0;
    for (const c of g.contas.values()) {
      const l = fecharLinha(centavos((c.base * fator * meses) / 12), c.realizado);
      contas.push({ grupo: g.nome, nome: c.nome, ...l });
      gp += l.previsto;
      gr += l.realizado;
    }
    const l = fecharLinha(gp, gr);
    resultadoGrupos.push({ nome: g.nome, ...l, contas });
    totalPrevisto += l.previsto;
    totalRealizado += l.realizado;
  }

  return {
    semBase,
    origemRealizado,
    meses,
    mesAte,
    relatoriosUsados,
    reajustePct: opcoes.reajustePct,
    grupos: resultadoGrupos,
    total: fecharLinha(totalPrevisto, totalRealizado),
    avisos,
  };
}
