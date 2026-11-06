import { formatBRL } from "../lib/format";
import { centavos } from "./demonstrativo";
import { normalizarMensal, competenciaMensal, mesAnoDe, ordemCompetencia, rotuloCompetencia } from "./mensal";
import { calcularPrevisao, demonstrativoBasePrevisao, expressaoDeducao, type ResultadoPrevisao } from "./previsao";
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

/**
 * Relatórios que pertencem ao período do demonstrativo da prestação.
 * É usado como fallback quando ainda não existem relatórios no período seguinte
 * do Previsto × Realizado; meses ausentes continuam simplesmente fora da lista.
 */
export function mensaisDoPeriodoExercicio(condoId: string, mensais: Mensal[], e: Pick<Exercicio, "demonstrativo">): Mensal[] {
  const ini = mesAnoDe(e.demonstrativo?.periodo?.ini);
  const fim = mesAnoDe(e.demonstrativo?.periodo?.fim);
  if (!ini || !fim) return [];
  const inicio = ini.ano * 100 + ini.mes;
  const termino = fim.ano * 100 + fim.mes;
  return mensais
    .filter((m) => m.condoId === condoId)
    .map((m) => normalizarMensal(m))
    .filter((m) => {
      const competencia = ordemCompetencia(competenciaMensal(m));
      return competencia >= inicio && competencia <= termino;
    })
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

export interface ConsumoServico {
  /** Valor que vale no relatório: o manual, se houver, senão o automático. */
  valor: number;
  manual: boolean;
  rubricas: string[];
  /** Cálculo a partir do demonstrativo, sempre, mesmo quando um valor manual está substituindo-o no relatório. */
  automatico: { valor: number; rubricas: string[] };
}

/** Despesas do demonstrativo cuja rubrica casa com `rubrica`; o valor manual, se informado, prevalece no relatório. */
function consumoPorRubrica(demonstrativo: Demonstrativo | null, rubrica: string, manual: number | null | undefined): ConsumoServico {
  const re = expressaoDeducao(rubrica);
  const itens = re ? (demonstrativo?.despesas.grupos ?? []).flatMap((g) => g.itens).filter((i) => re.test(i.nome)) : [];
  const automatico = { valor: centavos(itens.reduce((s, i) => s + (Number(i.valor) || 0), 0)), rubricas: itens.map((i) => i.nome) };
  if (typeof manual === "number") return { valor: manual, manual: true, rubricas: [], automatico };
  return { valor: automatico.valor, manual: false, rubricas: automatico.rubricas, automatico };
}

/** Despesas do demonstrativo cuja rubrica casa com `aguaRubrica`; o valor manual, se informado, prevalece. */
export function consumoAgua(e: Pick<Exercicio, "demonstrativo" | "consid">): ConsumoServico {
  return consumoPorRubrica(e.demonstrativo, e.consid.aguaRubrica, e.consid.consumoAguaManual);
}

/** Mesmo mecanismo da água, para a linha "Energia elétrica" do consumo de serviços. */
export function consumoEnergia(e: Pick<Exercicio, "demonstrativo" | "consid">): ConsumoServico {
  return consumoPorRubrica(e.demonstrativo, e.consid.energiaRubrica, e.consid.consumoEnergiaManual);
}

/** Mesmo mecanismo da água, para a linha "Elevadores" do consumo de serviços. */
export function consumoElevador(e: Pick<Exercicio, "demonstrativo" | "consid">): ConsumoServico {
  return consumoPorRubrica(e.demonstrativo, e.consid.elevadorRubrica, e.consid.consumoElevadorManual);
}

/** Total de despesas por grupo (gráfico de pizza). */
export function despesasPorGrupo(d: Demonstrativo | null): { nome: string; valor: number }[] {
  return (d?.despesas.grupos ?? [])
    .map((g) => ({ nome: g.nome || "Sem grupo", valor: centavos(g.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0)) }))
    .filter((g) => g.valor !== 0);
}

export interface SerieReceita {
  nome: string;
  pontos: { mes: string; valor: number }[];
}

/**
 * Evolução de cada categoria de receita (nome do item do demonstrativo) mês a mês — um
 * mini-gráfico por categoria, cada um com sua própria escala, porque a Taxa condominial costuma
 * ser bem maior que as outras receitas (ver `GraficoReceitasCategoria`, no frontend). Categorias
 * na ordem em que aparecem pela primeira vez nos relatórios mensais; meses sem aquela receita
 * entram como zero. Item sem nome (linha nova do editor do demonstrativo nasce `nome: ""`) entra
 * agrupado em "Outras receitas" — mesmo padrão de `despesasPorGrupo` ("Sem grupo") — em vez de
 * sumir silenciosamente do gráfico.
 */
export function receitasPorCategoria(mensais: Mensal[]): SerieReceita[] {
  const comDemonstrativo = mensais.filter((m) => m.demonstrativo);
  const rotulo = (nome: string) => nome.trim() || "Outras receitas";
  const nomes: string[] = [];
  for (const m of comDemonstrativo) {
    for (const i of m.demonstrativo!.receitas.itens) {
      const nome = rotulo(i.nome);
      if (!nomes.includes(nome)) nomes.push(nome);
    }
  }
  return nomes
    .map((nome) => ({
      nome,
      pontos: comDemonstrativo.map((m) => ({
        mes: rotuloCompetencia(competenciaMensal(m)),
        valor: centavos(
          m.demonstrativo!.receitas.itens.filter((i) => rotulo(i.nome) === nome).reduce((s, i) => s + (Number(i.valor) || 0), 0),
        ),
      })),
    }))
    .filter((s) => s.pontos.some((p) => p.valor !== 0));
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
  /** Origem explícita da base, inclusive quando preservada no fechamento. */
  origemBasePrevisao: string;
  /** Aviso compartilhado entre conferência, prévia e PDF/Word; não converte dados. */
  avisoRateioAprovado: string | null;
  /** Referência histórica importada; nunca substitui o cálculo principal do Krieger. */
  previsaoSugerida: ResultadoPrevisaoSugerida | null;
  previsaoSugeridaPorUnidade: ResultadoPrevisaoSugeridaPorUnidade | null;
  comparativo: ResultadoComparativo;
  mensais: Mensal[];
  inadimplencia: ReturnType<typeof inadimplencia>;
  evolucaoMensal: PontoEvolucaoMensal[];
  receitasPorCategoria: SerieReceita[];
  notas: NotaConsolidada[];
  agua: ConsumoServico;
  energia: ConsumoServico;
  elevador: ConsumoServico;
  despesasGrupo: { nome: string; valor: number }[];
  conferencia: ItemConferencia[];
}


/** Monta todas as seções do relatório e a conferência dos totais. */
export function montarRelatorioFinal(entrada: {
  exercicio: Exercicio;
  /** Exercício anterior do mesmo condomínio — base da previsão deste (ver `demonstrativoBasePrevisao`,
   * em `previsao.ts`). Sem isso, a previsão cai no demonstrativo do próprio exercício. */
  exercicioAnterior?: Pick<Exercicio, "demonstrativo"> | null;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
  mensais: Mensal[];
}): RelatorioFinal {
  const congelado = entrada.exercicio.fechado ? entrada.exercicio.fechamento : undefined;
  if (congelado) entrada = { ...entrada, condominio: congelado.condominio, escritorio: congelado.escritorio, mensais: congelado.mensais, exercicioAnterior: congelado.exercicioAnterior };
  const { exercicio: entradaExercicio, condominio, escritorio } = entrada;
  // Compatibilidade com prestações antigas criadas antes de o período ser herdado:
  // quando os meses já foram importados, o intervalo deles é a fonte segura para
  // montar a prestação até que o usuário salve um período explícito.
  const mensaisDoCondominio = entrada.mensais
    .filter((m) => m.condoId === entradaExercicio.condoId)
    .map((m) => normalizarMensal(m))
    .sort((a, b) => ordemCompetencia(competenciaMensal(a)) - ordemCompetencia(competenciaMensal(b)));
  const periodoVazio = !entradaExercicio.demonstrativo?.periodo?.ini || !entradaExercicio.demonstrativo?.periodo?.fim;
  const primeiro = mensaisDoCondominio[0];
  const ultimo = mensaisDoCondominio.at(-1);
  const e = periodoVazio && primeiro && ultimo
    ? {
        ...entradaExercicio,
        demonstrativo: {
          ...entradaExercicio.demonstrativo!,
          periodo: {
            ini: primeiro.demonstrativo?.periodo.ini ?? primeiro.demonstrativo?.periodo.fim ?? "",
            fim: ultimo.demonstrativo?.periodo.fim ?? ultimo.demonstrativo?.periodo.ini ?? "",
          },
        },
      }
    : entradaExercicio;
  const secoes = secoesIncluidas(e);
  // `Mensal.receber.unidades` é "unidades inadimplentes" (contas a receber), não o total do
  // condomínio — não serve de alternativa aqui. A única fonte do total é o cadastro (achado do
  // Codex no PR #108, que pegou uma leitura errada desse campo antes de publicar).
  const unidades = condominio?.unidades ?? null;
  const demonstrativoBase = demonstrativoBasePrevisao(e, entrada.exercicioAnterior);
  const previsao = calcularPrevisao(demonstrativoBase, { ...e, indices: e.consid.indices }, unidades);
  const previsaoSugerida = e.previsaoSugerida ? calcularPrevisaoSugerida(e.previsaoSugerida) : null;
  const previsaoSugeridaPorUnidade = previsaoSugerida
    ? calcularPrevisaoSugeridaPorUnidade(previsaoSugerida.rateioMensalSugerido, unidades, e.prev?.fundoReservaPct ?? 0, e.arredondamento)
    : null;
  const baseAnterior = entrada.exercicioAnterior?.demonstrativo != null;
  const anoBase = baseAnterior ? Number(e.ano) - 1 : e.ano;
  const periodoBase = demonstrativoBase?.periodo;
  const origemBasePrevisao = `Base: realizado do exercício ${anoBase}${periodoBase?.ini && periodoBase.fim ? ` · ${periodoBase.ini} a ${periodoBase.fim}` : ""}${congelado ? " · fontes preservadas no fechamento" : ""}.`;
  const aprovado = e.rateioAprovado;
  const sugerido = previsao.rateioSugerido;
  const avisoRateioAprovado = aprovado != null && sugerido != null && centavos(aprovado) !== centavos(sugerido)
    ? `Atenção: rateio aprovado por unidade informado (${formatBRL(aprovado)}) difere da sugestão do Krieger (${formatBRL(sugerido)}). Confira se foi informado o total mensal do condomínio (${formatBRL(previsao.mensal)}) neste campo. Nenhuma conversão foi aplicada.`
    : null;
  const comparativo = compararPrevistoRealizado(e, entrada.mensais, {
    condominio,
    mesAte: e.relatorioFinal?.prAte ?? null,
    demonstrativoBase,
  });
  const mensaisDoComparativo = mensaisDoRelatorio(e.condoId, entrada.mensais, comparativo);
  // Uma prestação pode ser fechada antes de todos os meses do exercício seguinte
  // existirem. Nesse caso, mostrar os relatórios já lançados do próprio exercício
  // (por exemplo, janeiro a agosto) é mais útil do que tratar o período como vazio.
  const mensais = mensaisDoComparativo.length > 0
    ? mensaisDoComparativo
    : mensaisDoPeriodoExercicio(e.condoId, entrada.mensais, e);
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
    if (previsao.rateioSugerido === null) {
      c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: "Sem valor por unidade (faltam unidades no cadastro do condomínio)." });
    } else if (e.rateioAprovado == null) {
      c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: `Valor por unidade calculado ${formatBRL(previsao.rateioSugerido)}; rateio aprovado ainda não informado.` });
    } else if (centavos(e.rateioAprovado) !== centavos(previsao.rateioSugerido)) {
      c.push({ titulo: "Previsão orçamentária", situacao: "aviso", detalhe: avisoRateioAprovado! });
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
    origemBasePrevisao,
    avisoRateioAprovado,
    previsaoSugerida,
    previsaoSugeridaPorUnidade,
    comparativo,
    mensais,
    inadimplencia: inad,
    evolucaoMensal: evolucao,
    receitasPorCategoria: receitasPorCategoria(mensais),
    notas,
    agua: consumoAgua(e),
    energia: consumoEnergia(e),
    elevador: consumoElevador(e),
    despesasGrupo: despesasPorGrupo(d),
    conferencia: c,
  };
}
