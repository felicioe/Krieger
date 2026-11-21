import { centavos } from "./demonstrativo";
import { percentualAprovadoDoHistorico } from "./historicoRateio";
import { resolverVariacao } from "./previsao";
import type { Condominio, DePara, Demonstrativo, Exercicio, HistoricoRateio } from "./types";

/**
 * Previsto aprovado — fonte única do "previsto" para Previsão para relatórios, Previsto × Realizado,
 * Previsto × Realizado mensal e relatório final (issue #284).
 *
 * Regras confirmadas pelo responsável:
 * - Previsto SIMPLES: realizado da conta no exercício anterior × (1 + %), arredondado em centavos por
 *   linha; o total é a soma das linhas. Sem dedução, ajustes ou variação de despesas sugeridas (isso é
 *   da previsão do rateio, em `previsao.ts`).
 * - O percentual vem do histórico de rateios (ano-base = ano do exercício − 1). `0%` é válido. Sem
 *   histórico, cai na variação explícita do exercício (com aviso); sem ambos, o previsto fica pendente.
 * - Sem exercício anterior com despesas não há base histórica: "sem previsão aprovada".
 *
 * Hoje o previsto é DERIVADO na leitura (`origem: "derivado"`). A etapa 3 (#285) passa a lê-lo de
 * `kr_previsoes_aprovadas`, sem mudar quem consome esta estrutura.
 */

export interface ContaPrevistaAprovada {
  grupo: string;
  nome: string;
  /** Realizado de origem (exercício anterior) desta conta. */
  realizadoOrigem: number;
  /** Previsto anual aprovado da conta, em centavos. */
  previsto: number;
}

export interface GrupoPrevistoAprovado {
  nome: string;
  contas: ContaPrevistaAprovada[];
  totalPrevisto: number;
}

export type SituacaoPrevisto = "ok" | "sem_base" | "sem_percentual";

export interface PrevistoAprovado {
  condoId: string;
  exercicioDestino: number;
  situacao: SituacaoPrevisto;
  percentual: number | null;
  origemPercentual: "historico" | "exercicio" | null;
  totalPrevisto: number;
  grupos: GrupoPrevistoAprovado[];
  origem: "derivado";
  avisos: string[];
}

/** Chave de comparação de rótulos: sem acentos, minúsculas, espaços simples. */
export function chaveConta(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const temDespesas = (d: Demonstrativo | null | undefined): d is Demonstrativo =>
  !!d?.despesas?.grupos?.some((g) => g.itens?.some((i) => !!i.nome || (Number(i.valor) || 0) !== 0));

/** Variação explícita do exercício, só quando informada (≠ 0) e em %; senão null. */
export function percentualExplicitoDoExercicio(
  e: Pick<Exercicio, "variacao" | "variacaoMetodo" | "variacaoParam"> & { consid?: { indices?: Exercicio["consid"]["indices"] } },
): number | null {
  if (e.variacaoMetodo === "valor") return null;
  const { pct } = resolverVariacao({ ...e, indices: e.consid?.indices ?? [] });
  return Number.isFinite(pct) && pct !== 0 ? pct : null;
}

export interface EntradaPrevisto {
  condoId: string;
  /** Ano do exercício cujo previsto se quer (destino). */
  anoDestino: number;
  /** Demonstrativo do exercício ANTERIOR (base); null = sem base. */
  demonstrativoBase: Demonstrativo | null | undefined;
  historicoRateios?: HistoricoRateio[] | undefined;
  /** Variação explícita do exercício, usada só quando o histórico não traz percentual. */
  percentualExercicio?: number | null | undefined;
  mapeamento?: DePara[] | undefined;
}

export function previstoAprovadoDerivado(entrada: EntradaPrevisto): PrevistoAprovado {
  const avisos: string[] = [];
  const base: PrevistoAprovado = {
    condoId: entrada.condoId,
    exercicioDestino: entrada.anoDestino,
    situacao: "ok",
    percentual: null,
    origemPercentual: null,
    totalPrevisto: 0,
    grupos: [],
    origem: "derivado",
    avisos,
  };
  if (!temDespesas(entrada.demonstrativoBase)) {
    avisos.push("Sem previsão aprovada: não há exercício anterior com despesas (base histórica).");
    return { ...base, situacao: "sem_base" };
  }

  const doHistorico = percentualAprovadoDoHistorico(entrada.historicoRateios ?? [], entrada.condoId, entrada.anoDestino - 1);
  let percentual: number | null = doHistorico;
  let origemPercentual: PrevistoAprovado["origemPercentual"] = doHistorico === null ? null : "historico";
  if (percentual === null && entrada.percentualExercicio != null && Number.isFinite(entrada.percentualExercicio)) {
    percentual = entrada.percentualExercicio;
    origemPercentual = "exercicio";
    avisos.push("Percentual aprovado não encontrado no histórico de rateios: usada a variação informada no exercício.");
  }
  if (percentual === null) {
    avisos.push(`Percentual aprovado não encontrado no histórico de rateios de ${entrada.anoDestino - 1}: o previsto não foi calculado.`);
    return { ...base, situacao: "sem_percentual" };
  }

  const mapa = new Map((entrada.mapeamento ?? []).filter((d) => d.de?.trim()).map((d) => [chaveConta(d.de), d.para] as const));
  const nomeDe = (s: string) => mapa.get(chaveConta(s)) ?? s;
  const fator = 1 + percentual / 100;

  const grupos = new Map<string, { nome: string; contas: Map<string, { nome: string; realizado: number }> }>();
  for (const g of entrada.demonstrativoBase.despesas.grupos) {
    const nomeGrupo = nomeDe(g.nome);
    const gk = chaveConta(nomeGrupo);
    const grupo = grupos.get(gk) ?? { nome: nomeGrupo, contas: new Map() };
    grupos.set(gk, grupo);
    for (const it of g.itens ?? []) {
      const nomeConta = nomeDe(it.nome);
      const ck = chaveConta(nomeConta);
      const conta = grupo.contas.get(ck) ?? { nome: nomeConta, realizado: 0 };
      conta.realizado += Number(it.valor) || 0;
      grupo.contas.set(ck, conta);
    }
  }

  let total = 0;
  const resultado: GrupoPrevistoAprovado[] = [];
  for (const g of grupos.values()) {
    const contas: ContaPrevistaAprovada[] = [...g.contas.values()].map((c) => ({
      grupo: g.nome,
      nome: c.nome,
      realizadoOrigem: centavos(c.realizado),
      previsto: centavos(c.realizado * fator),
    }));
    const totalGrupo = centavos(contas.reduce((s, c) => s + c.previsto, 0));
    total += totalGrupo;
    resultado.push({ nome: g.nome, contas, totalPrevisto: totalGrupo });
  }
  return { ...base, percentual, origemPercentual, totalPrevisto: centavos(total), grupos: resultado };
}

export interface OpcoesPrevistoDoExercicio {
  /** Demonstrativo do exercício anterior (base). */
  demonstrativoBase?: Demonstrativo | null | undefined;
  historicoRateios?: HistoricoRateio[] | undefined;
  condominio?: Pick<Condominio, "mapeamento"> | null | undefined;
}

/**
 * Previsto do exercício para as telas de comparação. Em exercício fechado usa a base e o cadastro
 * congelados no fechamento; senão, a base informada (exercício anterior) e o histórico de rateios.
 */
export function previstoDoExercicio(exercicio: Exercicio, opcoes: OpcoesPrevistoDoExercicio = {}): PrevistoAprovado {
  let base = opcoes.demonstrativoBase ?? null;
  let condominio = opcoes.condominio ?? null;
  if (exercicio.fechado && exercicio.fechamento) {
    base = exercicio.fechamento.exercicioAnterior?.demonstrativo ?? base;
    condominio = exercicio.fechamento.condominio;
  }
  return previstoAprovadoDerivado({
    condoId: exercicio.condoId,
    anoDestino: Number(exercicio.ano),
    demonstrativoBase: base,
    historicoRateios: opcoes.historicoRateios,
    percentualExercicio: percentualExplicitoDoExercicio(exercicio),
    mapeamento: condominio?.mapeamento,
  });
}
