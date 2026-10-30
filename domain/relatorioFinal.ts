import { formatBRL } from "../lib/format";
import { centavos } from "./demonstrativo";
import { normalizarMensal, competenciaMensal, ordemCompetencia, rotuloCompetencia, unidadesDoUltimoRelatorio } from "./mensal";
import { calcularPrevisao, expressaoDeducao, type ResultadoPrevisao } from "./previsao";
import {
  calcularPrevisaoSugerida,
  calcularPrevisaoSugeridaPorUnidade,
  type ResultadoPrevisaoSugerida,
  type ResultadoPrevisaoSugeridaPorUnidade,
} from "./previsaoSugerida";
import { compararPrevistoRealizado, type ResultadoComparativo } from "./previstoRealizado";
import type { Condominio, ConfigEscritorio, Demonstrativo, Exercicio, Mensal } from "./types";

/**
 * Relatório final da prestação de contas: monta, a partir de um exercício, todas as seções
 * do documento e a conferência dos totais. Só monta os dados; a prévia é desenhada na tela
 * e a geração do PDF fica para depois.
 *
 * Interpretação a confirmar com o escritório (troque só em `mensaisDoRelatorio`):
 * - "relatórios mensais do exercício" = os mesmos meses usados no Previsto × Realizado
 *   (os 12 meses seguintes ao período do demonstrativo, até o mês escolhido).
 */

export type SecaoId =
  | "capa"
  | "demonstrativo"
  | "consideracoes"
  | "previsao"
  | "previstoRealizado"
  | "analise"
  | "inadimplencia"
  | "notas"
  | "assinatura";

export const SECOES: { id: SecaoId; titulo: string }[] = [
  { id: "capa", titulo: "Capa" },
  { id: "demonstrativo", titulo: "Demonstrativo" },
  { id: "consideracoes", titulo: "Considerações finais" },
  { id: "previsao", titulo: "Previsão orçamentária" },
  { id: "previstoRealizado", titulo: "Previsto × Realizado" },
  { id: "analise", titulo: "Análise gráfica" },
  { id: "inadimplencia", titulo: "Inadimplência" },
  { id: "notas", titulo: "Notas explicativas" },
  { id: "assinatura", titulo: "Assinatura" },
];

export type Secoes = Record<SecaoId, boolean>;

/** Seções incluídas: "Análise gráfica" usa `mostrarAnalise`; as demais, `relatorioFinal.secoes` (ausente = incluída). */
export function secoesIncluidas(e: Pick<Exercicio, "mostrarAnalise" | "relatorioFinal">): Secoes {
  const salvas = e.relatorioFinal?.secoes ?? {};
  const r = {} as Secoes;
  for (const s of SECOES) r[s.id] = s.id === "analise" ? e.mostrarAnalise !== false : salvas[s.id] !== false;
  return r;
}

/** Alteração do exercício para incluir/excluir uma seção. */
export function alternarSecao(e: Pick<Exercicio, "relatorioFinal">, id: SecaoId, incluir: boolean): Partial<Exercicio> {
  if (id === "analise") return { mostrarAnalise: incluir };
  return { relatorioFinal: { ...e.relatorioFinal, secoes: { ...e.relatorioFinal?.secoes, [id]: incluir } } };
}

/** Relatórios mensais do condomínio dentro da janela do Previsto × Realizado (até o mês escolhido). */
export function mensaisDoRelatorio(condoId: string, mensais: Mensal[], comparativo: ResultadoComparativo): Mensal[] {
  const janela = new Set(
    comparativo.meses.filter((m) => m.posicao <= comparativo.mesAte.posicao).map((m) => m.ano * 100 + m.mes),
  );
  return mensais
    .filter((m) => m.condoId === condoId)
    .map((m) => normalizarMensal(m))
    .filter((m) => janela.has(ordemCompetencia(competenciaMensal(m))))
    .sort((a, b) => ordemCompetencia(competenciaMensal(a)) - ordemCompetencia(competenciaMensal(b)));
}

export interface LinhaInadimplencia {
  mes: string;
  unidades: number | null;
  valor: number | null;
}

/** Contas a receber mês a mês. A posição final é a do último mês com valor informado (não é somada). */
export function inadimplencia(mensais: Mensal[]): { linhas: LinhaInadimplencia[]; final: LinhaInadimplencia | null } {
  const linhas = mensais.map((m) => ({
    mes: rotuloCompetencia(competenciaMensal(m)),
    unidades: m.receber.unidades,
    valor: m.receber.valor,
  }));
  const final = [...linhas].reverse().find((l) => l.valor !== null || l.unidades !== null) ?? null;
  return { linhas, final };
}

export interface PontoEvolucaoMensal {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

/** Receitas, despesas e saldo mês a mês (gráfico de evolução); meses sem demonstrativo ficam de fora. */
export function evolucaoMensal(mensais: Mensal[]): PontoEvolucaoMensal[] {
  return mensais
    .filter((m) => m.demonstrativo)
    .map((m) => ({
      mes: rotuloCompetencia(competenciaMensal(m)),
      receitas: m.demonstrativo!.totais.receitas,
      despesas: m.demonstrativo!.totais.despesas,
      saldo: m.demonstrativo!.totais.saldoAtual,
    }));
}

export interface NotaConsolidada {
  mes: string;
  rubrica: string;
  texto: string;
  valor: number | null;
}

/** Notas explicativas de todos os relatórios mensais, em ordem de mês (notas vazias ficam de fora). */
export function notasConsolidadas(mensais: Mensal[]): NotaConsolidada[] {
  return mensais.flatMap((m) =>
    m.notas
      .filter((n) => n.rubrica.trim() || n.texto.trim())
      .map((n) => ({ mes: rotuloCompetencia(competenciaMensal(m)), rubrica: n.rubrica.trim(), texto: n.texto.trim(), valor: n.valor })),
  );
}

/** Despesas do demonstrativo cuja rubrica casa com `aguaRubrica`; o valor manual, se informado, prevalece. */
export function consumoAgua(e: Pick<Exercicio, "demonstrativo" | "consid">): { valor: number; manual: boolean; rubricas: string[] } {
  if (typeof e.consid.consumoAguaManual === "number") return { valor: e.consid.consumoAguaManual, manual: true, rubricas: [] };
  const re = expressaoDeducao(e.consid.aguaRubrica);
  const itens = re ? (e.demonstrativo?.despesas.grupos ?? []).flatMap((g) => g.itens).filter((i) => re.test(i.nome)) : [];
  return { valor: centavos(itens.reduce((s, i) => s + (Number(i.valor) || 0), 0)), manual: false, rubricas: itens.map((i) => i.nome) };
}

/** Total de despesas por grupo (gráfico de pizza). */
export function despesasPorGrupo(d: Demonstrativo | null): { nome: string; valor: number }[] {
  return (d?.despesas.grupos ?? [])
    .map((g) => ({ nome: g.nome || "Sem grupo", valor: centavos(g.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0)) }))
    .filter((g) => g.valor !== 0);
}

export type SituacaoConferencia = "ok" | "aviso" | "erro";
export interface ItemConferencia {
  titulo: string;
  situacao: SituacaoConferencia;
  detalhe: string;
}

export interface RelatorioFinal {
  secoes: Secoes;
  demonstrativo: Demonstrativo | null;
  previsao: ResultadoPrevisao;
  /**
   * Previsão orçamentária sugerida (folha do PDF do Systemar, menu próprio — ver
   * domain/previsaoSugerida.ts). `null` quando o exercício não tem essa folha (não veio do PDF, ou
   * o PDF não trazia essa página) — nesse caso a seção "Previsão orçamentária" do relatório mostra
   * só `previsao` (cálculo a partir do demonstrativo do próprio exercício).
   */
  previsaoSugerida: ResultadoPrevisaoSugerida | null;
  previsaoSugeridaPorUnidade: ResultadoPrevisaoSugeridaPorUnidade | null;
  /**
   * De onde veio o nº de unidades usado nos dois cálculos "por unidade" acima: do cadastro do
   * condomínio (`Condominio.unidades`, manual) ou, na falta dele, do relatório mensal mais recente
   * que já traz essa informação (lida automaticamente do PDF). `null` quando nenhuma das duas existe
   * — nesse caso os blocos "por unidade" do relatório ficam ocultos (ver `mostrarPrevisaoPorUnidade`).
   */
  unidadesOrigem: "cadastro" | "relatorioMensal" | null;
  comparativo: ResultadoComparativo;
  mensais: Mensal[];
  inadimplencia: ReturnType<typeof inadimplencia>;
  evolucaoMensal: PontoEvolucaoMensal[];
  notas: NotaConsolidada[];
  agua: ReturnType<typeof consumoAgua>;
  despesasGrupo: { nome: string; valor: number }[];
  conferencia: ItemConferencia[];
}


/** Monta todas as seções do relatório e a conferência dos totais. */
export function montarRelatorioFinal(entrada: {
  exercicio: Exercicio;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
  mensais: Mensal[];
}): RelatorioFinal {
  const { exercicio: e, condominio, escritorio } = entrada;
  const secoes = secoesIncluidas(e);
  const unidadesCadastro = condominio?.unidades ?? null;
  const unidadesRelatorioMensal = unidadesCadastro ? null : unidadesDoUltimoRelatorio(e.condoId, entrada.mensais);
  const unidades = unidadesCadastro ?? unidadesRelatorioMensal;
  const unidadesOrigem: RelatorioFinal["unidadesOrigem"] = unidadesCadastro ? "cadastro" : unidadesRelatorioMensal ? "relatorioMensal" : null;
  const previsao = calcularPrevisao(e.demonstrativo, { ...e, indices: e.consid.indices }, unidades);
  const previsaoSugerida = e.previsaoSugerida ? calcularPrevisaoSugerida(e.previsaoSugerida) : null;
  const previsaoSugeridaPorUnidade = previsaoSugerida
    ? calcularPrevisaoSugeridaPorUnidade(previsaoSugerida.rateioMensalSugerido, unidades, e.prev?.fundoReservaPct ?? 0, e.arredondamento)
    : null;
  const comparativo = compararPrevistoRealizado(e, entrada.mensais, {
    condominio,
    mesAte: e.relatorioFinal?.prAte ?? null,
  });
  const mensais = mensaisDoRelatorio(e.condoId, entrada.mensais, comparativo);
  const inad = inadimplencia(mensais);
  const evolucao = evolucaoMensal(mensais);
  const notas = notasConsolidadas(mensais);

  const c: ItemConferencia[] = [];
  const d = e.demonstrativo;
  if (!d) {
    c.push({ titulo: "Demonstrativo", situacao: "erro", detalhe: "A prestação de contas não tem demonstrativo." });
  } else {
    const t = d.totais;
    const dif = centavos(t.saldoAnterior + t.receitas - t.despesas - t.saldoAtual);
    c.push(
      dif === 0
        ? { titulo: "Saldo do demonstrativo", situacao: "ok", detalhe: `Saldo anterior + receitas − despesas = saldo atual (${formatBRL(t.saldoAtual)}).` }
        : { titulo: "Saldo do demonstrativo", situacao: "erro", detalhe: `Não fecha: diferença de ${formatBRL(dif)} entre o calculado e o saldo atual informado.` },
    );
    c.push(
      d.periodo.ini && d.periodo.fim
        ? { titulo: "Período", situacao: "ok", detalhe: `${d.periodo.ini} a ${d.periodo.fim}.` }
        : { titulo: "Período", situacao: "aviso", detalhe: "Período do demonstrativo não informado." },
    );
  }

  if (secoes.previsao) {
    if (previsaoSugerida) {
      // Com a previsão sugerida (menu próprio, folha do PDF do Systemar), ela é quem manda nesta
      // conferência — substitui o cálculo antigo a partir do demonstrativo (domain/previsao.ts).
      const valorUnidade = previsaoSugeridaPorUnidade?.valorUnidade ?? null;
      if (valorUnidade === null) {
        c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: "Sem valor por unidade (faltam unidades no cadastro do condomínio)." });
      } else if (e.rateioAprovado == null) {
        c.push({
          titulo: "Previsão orçamentária",
          situacao: "aviso",
          detalhe: `Valor por unidade calculado ${formatBRL(valorUnidade)} (rateio mensal sugerido ${formatBRL(previsaoSugerida.rateioMensalSugerido)}); rateio aprovado ainda não informado.`,
        });
      } else if (centavos(e.rateioAprovado) !== centavos(valorUnidade)) {
        c.push({
          titulo: "Previsão orçamentária",
          situacao: "aviso",
          detalhe: `Rateio aprovado (${formatBRL(e.rateioAprovado)}) diferente do valor por unidade calculado (${formatBRL(valorUnidade)}).`,
        });
      } else {
        c.push({
          titulo: "Previsão orçamentária",
          situacao: "ok",
          detalhe: `Rateio mensal sugerido ${formatBRL(previsaoSugerida.rateioMensalSugerido)}; valor por unidade ${formatBRL(valorUnidade)} = rateio aprovado.`,
        });
      }
    } else if (previsao.rateioSugerido === null) {
      c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: "Sem valor por unidade (faltam unidades no cadastro do condomínio)." });
    } else if (e.rateioAprovado == null) {
      c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: `Valor por unidade calculado ${formatBRL(previsao.rateioSugerido)}; rateio aprovado ainda não informado.` });
    } else if (centavos(e.rateioAprovado) !== centavos(previsao.rateioSugerido)) {
      c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: `Rateio aprovado (${formatBRL(e.rateioAprovado)}) diferente do valor calculado (${formatBRL(previsao.rateioSugerido)}).` });
    } else {
      c.push({ titulo: "Previsão orçamentária", situacao: "ok", detalhe: `Anual ajustado ${formatBRL(previsao.totalAnual)}; valor por unidade ${formatBRL(previsao.rateioSugerido)} = rateio aprovado.` });
    }
  }

  if (secoes.previstoRealizado || secoes.analise) {
    c.push(
      comparativo.avisos.length
        ? { titulo: "Previsto × Realizado", situacao: "aviso", detalhe: comparativo.avisos.join(" ") }
        : { titulo: "Previsto × Realizado", situacao: "ok", detalhe: `${comparativo.relatoriosUsados} relatório(s) mensal(is) até ${comparativo.mesAte.rotulo}.` },
    );
  }
  if (secoes.inadimplencia) {
    c.push(
      inad.final
        ? { titulo: "Inadimplência", situacao: "ok", detalhe: `Posição em ${inad.final.mes}: ${formatBRL(inad.final.valor ?? 0)}${inad.final.unidades !== null ? ` (${inad.final.unidades} unidades)` : ""}.` }
        : { titulo: "Inadimplência", situacao: "aviso", detalhe: "Nenhum relatório mensal com contas a receber no período." },
    );
  }
  if (secoes.notas) {
    c.push(
      notas.length
        ? { titulo: "Notas explicativas", situacao: "ok", detalhe: `${notas.length} nota(s) dos relatórios mensais.` }
        : { titulo: "Notas explicativas", situacao: "aviso", detalhe: "Nenhuma nota explicativa nos relatórios mensais do período." },
    );
  }
  if (secoes.capa) {
    const faltam = [!e.cidade.trim() && "cidade", !e.dataEmissao.trim() && "data de emissão"].filter(Boolean);
    c.push(
      faltam.length
        ? { titulo: "Capa", situacao: "aviso", detalhe: `Falta informar: ${faltam.join(" e ")}.` }
        : { titulo: "Capa", situacao: "ok", detalhe: `${e.cidade}, ${e.dataEmissao}.` },
    );
  }
  if (secoes.assinatura) {
    const faltam = [!escritorio?.nome?.trim() && "nome", !escritorio?.assinatura?.trim() && "assinatura"].filter(Boolean);
    c.push(
      faltam.length
        ? { titulo: "Assinatura", situacao: "aviso", detalhe: `Cadastro do Escritório sem ${faltam.join(" e ")}.` }
        : { titulo: "Assinatura", situacao: "ok", detalhe: escritorio!.nome },
    );
  }
  if (!Object.values(secoes).some(Boolean)) {
    c.push({ titulo: "Seções", situacao: "erro", detalhe: "Nenhuma seção incluída no relatório." });
  }

  return {
    secoes,
    demonstrativo: d,
    previsao,
    previsaoSugerida,
    previsaoSugeridaPorUnidade,
    unidadesOrigem,
    comparativo,
    mensais,
    inadimplencia: inad,
    evolucaoMensal: evolucao,
    notas,
    agua: consumoAgua(e),
    despesasGrupo: despesasPorGrupo(d),
    conferencia: c,
  };
}
