import { centavos } from "./demonstrativo";
import { aplicarVariacaoDoHistorico } from "./historicoRateio";
import { calcularPrevisao, expressaoDeducao } from "./previsao";

import { competenciaMensal, mesAnoDe } from "./mensal";
import type { Condominio, DePara, Demonstrativo, Exercicio, HistoricoRateio, Mensal } from "./types";

/**
 * Comparativo Previsto × Realizado.
 *
 * Segue o padrão de "Previsão para relatórios" (modo `relatorios` do editor):
 *  - Anual previsto = realizado do exercício ANTERIOR (demonstrativo dele) × (1 + variação% da
 *    prestação de contas). A variação % vem do índice aprovado no histórico de rateios, a mesma
 *    calculada na prestação de contas — nunca o demonstrativo do próprio exercício como base.
 *  - O anual previsto é pulverizado nas rubricas do REALIZADO seguindo os pesos do realizado, de
 *    forma que a soma das rubricas feche o total do grupo.
 * Realizado = soma das despesas dos relatórios mensais dentro do período
 *             informado na prestação, do primeiro mês até o mês escolhido.
 * Previsto até o mês = anual × meses ÷ 12.
 * Diferença = realizado − previsto até o mês; % sobre o previsto até o mês.
 * Situação  = "dentro" quando |%| ≤ tolerância; senão "acima" ou "abaixo".
 *
 * Interpretações a confirmar com o escritório (fáceis de trocar aqui):
 * - a janela de análise é exatamente o período do demonstrativo da prestação;
 * - sem período informado, mantém-se a compatibilidade com o comportamento antigo;
 * - o mês de cada relatório mensal é o da data final do período (ou da inicial);
 * - rubricas casam pelo nome (sem acento/maiúsculas), após o de-para do condomínio;
 * - despesas que casam com a dedução ficam fora da comparação (como na previsão);
 * - ajustes com grupo existente entram no grupo; os demais, em "Ajustes gerais".
 */

export type Situacao = "dentro" | "acima" | "abaixo";

export const TOLERANCIA_PADRAO = 5;
export const GRUPO_AJUSTES_GERAIS = "Ajustes gerais";

export interface Totais {
  previstoAnual: number;
  previstoMensal: number;
  /** Previsto acumulado até o mês escolhido. */
  previsto: number;
  /** Realizado acumulado até o mês escolhido. */
  realizado: number;
  diferenca: number;
  pct: number | null;
  situacao: Situacao | null;
}

export interface LinhaComparativo extends Totais {
  grupo: string;
  nome: string;
  tipo: "rubrica" | "ajuste";
  sinal?: "+" | "-";
}

export interface GrupoComparativo {
  nome: string;
  linhas: LinhaComparativo[];
  totais: Totais;
}

export interface MesCompetencia {
  /** Posição do mês dentro do período da prestação. */
  posicao: number;
  mes: number;
  ano: number;
  rotulo: string;
  relatorios: number;
}

export interface ResultadoComparativo {
  meses: MesCompetencia[];
  mesAte: MesCompetencia;
  grupos: GrupoComparativo[];
  /** Despesas retiradas pela dedução (fora dos totais). */
  deduzidas: { grupo: string; nome: string; previstoAnual: number; realizado: number }[];
  total: Totais;
  tolerancia: number;
  relatoriosUsados: number;
  avisos: string[];
}

export interface OpcoesComparativo {
  condominio?: Pick<Condominio, "unidades" | "mapeamento"> | null;
  /** Posição do mês (1–12) no exercício N+1; padrão: último mês com relatório. */
  mesAte?: number | null;
  /** Faixa em % considerada "dentro" do previsto. */
  tolerancia?: number | null;
  /** Base pra projetar a previsão (ver `demonstrativoBasePrevisao`, em `previsao.ts`) — o realizado
   * do exercício anterior. Sem isso, cai no demonstrativo do próprio `exercicio` (compatibilidade). */
  demonstrativoBase?: Demonstrativo | null;
  /** Histórico de rateios — fonte do índice anual aprovado quando o exercício não tem variação explícita. */
  historicoRateios?: HistoricoRateio[];
}

const p2 = (n: number) => String(n).padStart(2, "0");

export { competenciaMensal, mesAnoDe };

/** Meses de competência contidos no período informado da prestação. Quando há período com datas
 * inicial e final válidas, devolve todos os meses desse intervalo (seja dentro de um único ano
 * civil ou cruzando anos). Sem período válido, cai em jan-dez do ano SEGUINTE ao exercício
 * (compatibilidade com exercícios abertos cujos relatórios mensais são do ano seguinte). */
export function mesesDoExercicioSeguinte(e: Pick<Exercicio, "ano" | "demonstrativo">): { mes: number; ano: number }[] {
  const inicio = mesAnoDe(e.demonstrativo?.periodo?.ini);
  const fim = mesAnoDe(e.demonstrativo?.periodo?.fim);
  if (inicio && fim) {
    const primeiro = inicio.ano * 12 + inicio.mes - 1;
    const ultimo = fim.ano * 12 + fim.mes - 1;
    if (ultimo >= primeiro) {
      return Array.from({ length: Math.min(120, ultimo - primeiro + 1) }, (_, i) => {
        const n = primeiro + i;
        return { mes: (n % 12) + 1, ano: Math.floor(n / 12) };
      });
    }
  }
  // Sem período: janela é jan-dez do ano SEGUINTE (exercício N → relatórios de N+1).
  const ano = Number(e.ano) + 1;
  return Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, ano }));
}

/** Chave de comparação de rótulos: sem acentos, minúsculas, espaços simples. */
export function chaveRotulo(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function aplicarDePara(nome: string, mapa: Map<string, string>): string {
  return mapa.get(chaveRotulo(nome)) ?? nome;
}

export function classificar(diferenca: number, previsto: number, tolerancia: number): { pct: number | null; situacao: Situacao } {
  if (previsto === 0) {
    return { pct: null, situacao: diferenca > 0 ? "acima" : diferenca < 0 ? "abaixo" : "dentro" };
  }
  const pct = Math.round((diferenca / Math.abs(previsto)) * 10000) / 100;
  const situacao: Situacao = pct > tolerancia ? "acima" : pct < -tolerancia ? "abaixo" : "dentro";
  return { pct, situacao };
}

function fecharTotais(previstoAnual: number, realizado: number, meses: number, tolerancia: number): Totais {
  const anual = centavos(previstoAnual);
  const previsto = centavos((anual * meses) / 12);
  const real = centavos(realizado);
  const diferenca = centavos(real - previsto);
  const { pct, situacao } = classificar(diferenca, previsto, tolerancia);
  return { previstoAnual: anual, previstoMensal: centavos(anual / 12), previsto, realizado: real, diferenca, pct, situacao };
}

interface Acum {
  grupo: string;
  nome: string;
  tipo: "rubrica" | "ajuste";
  sinal?: "+" | "-";
  previstoAnual: number;
  realizado: number;
  deduzida: boolean;
  /** Linha só da base anterior, sem realizado no período (mostra o previsto, realizado zero). */
  semRealizado?: boolean;
}

export function compararPrevistoRealizado(
  exercicio: Exercicio,
  mensais: Mensal[],
  opcoes: OpcoesComparativo = {},
): ResultadoComparativo {
  if (exercicio.fechado && exercicio.fechamento) {
    const anterior = exercicio.fechamento.exercicioAnterior?.demonstrativo ?? null;
    mensais = exercicio.fechamento.mensais;
    opcoes = {
      ...opcoes,
      condominio: exercicio.fechamento.condominio,
      // No fechamento só usa a base anterior congelada quando existe; sem ela, mantém a que veio
      // do fechado ou, em último caso, o próprio demonstrativo (primeira prestação).
      demonstrativoBase: anterior ?? opcoes.demonstrativoBase ?? exercicio.demonstrativo,
    };
  }
  const avisos: string[] = [];
  const tolerancia = Math.abs(opcoes.tolerancia ?? TOLERANCIA_PADRAO);
  const mapa = new Map((opcoes.condominio?.mapeamento ?? []).filter((d: DePara) => d.de?.trim()).map((d) => [chaveRotulo(d.de), d.para] as const));
  const re = expressaoDeducao(exercicio.deducaoRegex);
  const deduzidasRealizado = new Set<string>();

  // Mesma regra do modo "relatorios" do editor de previsão: a base é o realizado do exercício
  // ANTERIOR e a variação % é a da prestação de contas (histórico de rateios), aplicada uma única
  // vez sobre essa base. O demonstrativo do próprio exercício já pode ter o índice embutido e não
  // serve de base (o editor remove `demonstrativo` antes de injetar o histórico pelo mesmo motivo).
  const exercicioComHistorico = aplicarVariacaoDoHistorico(
    { ...exercicio, demonstrativo: null },
    opcoes.historicoRateios ?? [],
  );
  const variacaoPct = calcularPrevisao(
    null,
    { ...exercicioComHistorico, indices: exercicioComHistorico.consid?.indices },
    opcoes.condominio?.unidades ?? null,
  ).variacaoPct;
  const fator = 1 + variacaoPct / 100;
  const demonstrativoBase = opcoes.demonstrativoBase ?? exercicio.demonstrativo;

  // Janela do exercício N+1 e relatórios mensais por mês.
  const janela = mesesDoExercicioSeguinte(exercicio);
  const chaveMes = (m: { mes: number; ano: number }) => m.ano * 100 + m.mes;
  const posicaoPorMes = new Map(janela.map((m, i) => [chaveMes(m), i + 1]));
  const porPosicao = new Map<number, Mensal[]>();
  let semPeriodo = 0;
  for (const m of mensais) {
    if (m.condoId !== exercicio.condoId) continue;
    const c = competenciaMensal(m);
    if (!c) {
      semPeriodo++;
      continue;
    }
    const pos = posicaoPorMes.get(chaveMes(c));
    if (!pos) continue;
    porPosicao.set(pos, [...(porPosicao.get(pos) ?? []), m]);
  }
  const meses: MesCompetencia[] = janela.map((m, i) => ({
    posicao: i + 1,
    ...m,
    rotulo: `${p2(m.mes)}/${m.ano}`,
    relatorios: porPosicao.get(i + 1)?.length ?? 0,
  }));
  // A janela pode ter menos que 12 meses (período da prestação menor que um ano). Limitar a 12
  // deixava `meses[posAte - 1]` indefinido e quebrava a tela do relatório final ao ler `.rotulo`.
  const ultimoComRelatorio = [...meses].reverse().find((m) => m.relatorios > 0)?.posicao ?? meses.length;
  const posAte = Math.min(meses.length, Math.max(1, Math.trunc(opcoes.mesAte ?? ultimoComRelatorio)));
  const mesAte = meses[posAte - 1]!;

  if (semPeriodo > 0) avisos.push(`${semPeriodo} relatório(s) mensal(is) sem período informado ficaram de fora.`);
  const faltando = meses.slice(0, posAte).filter((m) => m.relatorios === 0).map((m) => m.rotulo);
  if (faltando.length > 0) avisos.push(`Sem relatório mensal em: ${faltando.join(", ")}. O realizado desses meses conta como zero.`);
  const duplicados = meses.slice(0, posAte).filter((m) => m.relatorios > 1).map((m) => m.rotulo);
  if (duplicados.length > 0) avisos.push(`Mais de um relatório mensal em: ${duplicados.join(", ")}. Todos foram somados; confira se não há duplicidade.`);

  // Acumula previsto e realizado por grupo e rubrica.
  const grupos = new Map<string, { nome: string; linhas: Map<string, Acum> }>();
  const linha = (grupo: string, nome: string, tipo: Acum["tipo"]): Acum => {
    const gk = chaveRotulo(grupo);
    let g = grupos.get(gk);
    if (!g) {
      g = { nome: grupo, linhas: new Map() };
      grupos.set(gk, g);
    }
    const lk = `${tipo}:${chaveRotulo(nome)}`;
    let l = g.linhas.get(lk);
    if (!l) {
      l = { grupo: g.nome, nome, tipo, previstoAnual: 0, realizado: 0, deduzida: false };
      g.linhas.set(lk, l);
    }
    return l;
  };

  // Previsto anual por grupo de cada base, na ordem em que os grupos aparecem.
  const norm = (s: string) => chaveRotulo(s);
  const anuaisBase = new Map<string, number>();
  const nomesBase: string[] = [];
  for (const g of demonstrativoBase?.despesas.grupos ?? []) {
    const k = norm(g.nome);
    if (!anuaisBase.has(k)) nomesBase.push(g.nome);
    anuaisBase.set(k, (anuaisBase.get(k) ?? 0) + g.itens.reduce((s, it) => s + (Number(it.valor) || 0), 0));
  }
  // Deduções da previsão ficam fora da comparação (como no editor).
  const deducaoBase = new Map<string, number>();
  for (const g of demonstrativoBase?.despesas.grupos ?? []) {
    const grupoDeduzido = !!re && re.test(g.nome);
    for (const it of g.itens) {
      if (grupoDeduzido || (!!re && re.test(it.nome))) {
        const k = norm(g.nome);
        deducaoBase.set(k, (deducaoBase.get(k) ?? 0) + (Number(it.valor) || 0));
      }
    }
  }
  const previstoGrupo = (nome: string) => {
    const k = norm(nome);
    const baseAnterior = anuaisBase.get(k) ?? 0;
    return (baseAnterior - (deducaoBase.get(k) ?? 0)) * fator;
  };
  const gruposBaseUsados = new Set<string>();
  let relatoriosUsados = 0;
  // Realizado por grupo (chave normalizada) → valor por conta normalizada, na ordem de aparição,
  // pra depois pulverizar o previsto do grupo pelos pesos do realizado.
  const realizado = new Map<string, { nome: string; itens: Map<string, { nome: string; valor: number }> }>();
  for (let pos = 1; pos <= posAte; pos++) {
    for (const m of porPosicao.get(pos) ?? []) {
      relatoriosUsados++;
      for (const g of m.demonstrativo?.despesas?.grupos ?? []) {
        const grupoDeduzido = !!re && re.test(g.nome);
        const grupo = aplicarDePara(g.nome, mapa);
        const gk = chaveRotulo(grupo);
        if (!realizado.has(gk)) realizado.set(gk, { nome: grupo, itens: new Map() });
        const acc = realizado.get(gk)!;
        for (const it of g.itens ?? []) {
          const nome = aplicarDePara(it.nome, mapa);
          const ik = chaveRotulo(nome);
          if (!acc.itens.has(ik)) acc.itens.set(ik, { nome, valor: 0 });
          acc.itens.get(ik)!.valor += Number(it.valor) || 0;
          if (grupoDeduzido || (!!re && re.test(it.nome))) deduzidasRealizado.add(`${gk}\u0000${ik}`);
        }
      }
    }
  }
  if (relatoriosUsados === 0) avisos.push(`Nenhum relatório mensal de ${meses[0]!.rotulo} a ${mesAte.rotulo} para este condomínio.`);

  // Previsto: nas contas do REALIZADO, cada uma com seu peso no realizado do grupo; o último item
  // recebe o restante, pra soma das rubricas fechar exatamente o previsto do grupo.
  for (const [gk, acc] of realizado) {
    gruposBaseUsados.add(gk);
    const total = acc.itens.size ? [...acc.itens.values()].reduce((s, it) => s + it.valor, 0) : 0;
    const pg = previstoGrupo(acc.nome);
    let acumulado = 0;
    let i = 0;
    for (const it of acc.itens.values()) {
      const a = linha(acc.nome, it.nome, "rubrica");
      a.realizado += it.valor;
      a.deduzida = deduzidasRealizado.has(`${gk}\u0000${chaveRotulo(it.nome)}`) || (!!re && re.test(it.nome));
      let p: number;
      if (i === acc.itens.size - 1) p = pg - acumulado;
      else if (total > 0) p = (it.valor / total) * pg;
      else p = 0;
      acumulado += p;
      a.previstoAnual += p;
      i++;
    }
  }
  // Grupos da base que não têm nenhuma despesa realizada no período: aparecem com realizado zero,
  // pra que o total previsto seja o da previsão inteira.
  for (const nome of nomesBase) {
    const gk = chaveRotulo(nome);
    if (gruposBaseUsados.has(gk)) continue;
    const a = linha(nome, nome, "rubrica");
    a.previstoAnual += previstoGrupo(nome);
    a.semRealizado = true;
  }

  // Fecha linhas e totais (gerais por último).
  const ordenados = [...grupos.values()].sort(
    (a, b) => Number(a.nome === GRUPO_AJUSTES_GERAIS) - Number(b.nome === GRUPO_AJUSTES_GERAIS),
  );
  const deduzidas: ResultadoComparativo["deduzidas"] = [];
  const resultadoGrupos: GrupoComparativo[] = [];
  let totalPrevisto = 0;
  let totalRealizado = 0;
  for (const g of ordenados) {
    const linhas: LinhaComparativo[] = [];
    let gp = 0;
    let gr = 0;
    for (const a of g.linhas.values()) {
      if (a.deduzida) {
        deduzidas.push({ grupo: a.grupo, nome: a.nome, previstoAnual: centavos(a.previstoAnual), realizado: centavos(a.realizado) });
        continue;
      }
      const t = fecharTotais(a.previstoAnual, a.realizado, posAte, tolerancia);
      // Ajuste sem despesa realizada correspondente não tem situação própria.
      if (a.tipo === "ajuste" && t.realizado === 0) t.situacao = null;
      linhas.push({ grupo: g.nome, nome: a.nome, tipo: a.tipo, ...(a.sinal ? { sinal: a.sinal } : {}), ...t });
      gp += a.previstoAnual;
      gr += a.realizado;
    }
    if (linhas.length === 0) continue;
    totalPrevisto += gp;
    totalRealizado += gr;
    resultadoGrupos.push({ nome: g.nome, linhas, totais: fecharTotais(gp, gr, posAte, tolerancia) });
  }

  return {
    meses,
    mesAte,
    grupos: resultadoGrupos,
    deduzidas,
    total: fecharTotais(totalPrevisto, totalRealizado, posAte, tolerancia),
    tolerancia,
    relatoriosUsados,
    avisos,
  };
}
