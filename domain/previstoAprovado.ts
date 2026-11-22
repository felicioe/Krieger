import { centavos } from "./demonstrativo";
import { percentualAprovadoDoHistorico } from "./historicoRateio";
import { resolverVariacao } from "./previsao";
import type {
  Condominio,
  ContaPrevistaAprovada,
  DePara,
  Demonstrativo,
  Exercicio,
  GrupoPrevistoAprovado,
  HistoricoRateio,
  PrevisaoAprovada,
} from "./types";

export type { ContaPrevistaAprovada, GrupoPrevistoAprovado };

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
 * O previsto é lido de `kr_previsoes_aprovadas` (`origem: "aprovado"`) quando o exercício está aberto e
 * existe registro para ele; exercício fechado usa o previsto congelado no fechamento. Sem registro, é
 * DERIVADO na leitura (`origem: "derivado"`) do exercício anterior — assim exercícios fechados antes
 * da tabela mantêm os números já emitidos.
 */

export type SituacaoPrevisto = "ok" | "sem_base" | "sem_percentual";

export interface PrevistoAprovado {
  condoId: string;
  exercicioDestino: number;
  situacao: SituacaoPrevisto;
  percentual: number | null;
  origemPercentual: "historico" | "exercicio" | null;
  totalPrevisto: number;
  grupos: GrupoPrevistoAprovado[];
  origem: "derivado" | "aprovado";
  /** Versão do registro persistido (só quando `origem` é "aprovado"). */
  versao?: number;
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
  for (const [chaveGrupo, g] of grupos.entries()) {
    const contas: ContaPrevistaAprovada[] = [...g.contas.entries()].map(([chave, c]) => ({
      grupo: g.nome,
      nome: c.nome,
      chave,
      realizadoOrigem: centavos(c.realizado),
      previsto: centavos(c.realizado * fator),
    }));
    const totalGrupo = centavos(contas.reduce((s, c) => s + c.previsto, 0));
    total += totalGrupo;
    resultado.push({ nome: g.nome, chave: chaveGrupo, contas, totalPrevisto: totalGrupo });
  }
  return { ...base, percentual, origemPercentual, totalPrevisto: centavos(total), grupos: resultado };
}

/** Converte o registro persistido na mesma estrutura usada pelas telas. */
export function previstoDeRegistro(reg: PrevisaoAprovada): PrevistoAprovado {
  return {
    condoId: reg.condoId,
    exercicioDestino: reg.exercicioDestino,
    situacao: "ok",
    percentual: reg.percentualAprovado,
    origemPercentual: "historico",
    totalPrevisto: reg.totalPrevisto,
    grupos: reg.grupos,
    origem: "aprovado",
    versao: reg.versao,
    avisos: [],
  };
}

export interface OpcoesPrevistoDoExercicio {
  /** Demonstrativo do exercício anterior (base). */
  demonstrativoBase?: Demonstrativo | null | undefined;
  historicoRateios?: HistoricoRateio[] | undefined;
  condominio?: Pick<Condominio, "mapeamento"> | null | undefined;
  /** Previstos aprovados gravados pelo servidor (store `previsoes_aprovadas`). */
  previsoesAprovadas?: PrevisaoAprovada[] | undefined;
}

/**
 * Previsto do exercício para as telas de comparação. Ordem: (1) exercício fechado com o previsto
 * congelado no fechamento; (2) exercício aberto com previsto aprovado gravado; (3) derivado do
 * exercício anterior e do histórico de rateios (em exercício fechado, com a base e o cadastro
 * congelados no fechamento).
 */
export function previstoDoExercicio(exercicio: Exercicio, opcoes: OpcoesPrevistoDoExercicio = {}): PrevistoAprovado {
  const congelado = exercicio.fechado ? exercicio.fechamento?.previstoAprovado : null;
  if (congelado) return previstoDeRegistro(congelado);
  if (!exercicio.fechado) {
    const gravado = opcoes.previsoesAprovadas?.find(
      (p) => p.condoId === exercicio.condoId && Number(p.exercicioDestino) === Number(exercicio.ano),
    );
    if (gravado) return previstoDeRegistro(gravado);
  }
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
