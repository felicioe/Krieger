import { centavos } from "./demonstrativo";
import { calcularPrevisao, expressaoDeducao } from "./previsao";
import { competenciaMensal, mesAnoDe } from "./mensal";
import type { Condominio, DePara, Exercicio, Mensal } from "./types";

/**
 * Comparativo Previsto × Realizado.
 *
 * Previsto  = previsão orçamentária do exercício N (calcularPrevisao, já com os ajustes),
 *             aberta por rubrica e grupo. Previsto até o mês = anual × meses ÷ 12.
 * Realizado = soma das despesas dos relatórios mensais do exercício N+1,
 *             do primeiro mês até o mês escolhido.
 * Diferença = realizado − previsto até o mês; % sobre o previsto até o mês.
 * Situação  = "dentro" quando |%| ≤ tolerância; senão "acima" ou "abaixo".
 *
 * Interpretações a confirmar com o escritório (fáceis de trocar aqui):
 * - o exercício N+1 começa no mês seguinte ao fim do período do demonstrativo N
 *   (sem período, janeiro a dezembro de ano + 1);
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
  /** 1 a 12 dentro do exercício N+1. */
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
}

const p2 = (n: number) => String(n).padStart(2, "0");

export { competenciaMensal, mesAnoDe };

/** Os 12 meses do exercício N+1. */
export function mesesDoExercicioSeguinte(e: Pick<Exercicio, "ano" | "demonstrativo">): { mes: number; ano: number }[] {
  const fim = mesAnoDe(e.demonstrativo?.periodo?.fim);
  let mes = 1;
  let ano = Number(e.ano) + 1;
  if (fim) {
    mes = fim.mes === 12 ? 1 : fim.mes + 1;
    ano = fim.mes === 12 ? fim.ano + 1 : fim.ano;
  }
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((mes - 1 + i) % 12) + 1;
    const a = ano + Math.floor((mes - 1 + i) / 12);
    return { mes: m, ano: a };
  });
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
}

export function compararPrevistoRealizado(
  exercicio: Exercicio,
  mensais: Mensal[],
  opcoes: OpcoesComparativo = {},
): ResultadoComparativo {
  const avisos: string[] = [];
  const tolerancia = Math.abs(opcoes.tolerancia ?? TOLERANCIA_PADRAO);
  const mapa = new Map((opcoes.condominio?.mapeamento ?? []).filter((d: DePara) => d.de?.trim()).map((d) => [chaveRotulo(d.de), d.para] as const));
  const re = expressaoDeducao(exercicio.deducaoRegex);

  // Previsão do exercício N, aberta por despesa (os totais por grupo são os mesmos do modo tradicional).
  const prev = calcularPrevisao(
    exercicio.demonstrativo,
    {
      ...exercicio,
      indices: exercicio.consid?.indices,
      prev: { ...(exercicio.prev ?? { modo: "tradicional" }), modo: "detalhado" },
    },
    opcoes.condominio?.unidades ?? null,
  );

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
  const ultimoComRelatorio = [...meses].reverse().find((m) => m.relatorios > 0)?.posicao ?? 12;
  const posAte = Math.min(12, Math.max(1, Math.trunc(opcoes.mesAte ?? ultimoComRelatorio)));
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

  for (const l of prev.linhas) {
    const a = linha(aplicarDePara(l.grupo, mapa), aplicarDePara(l.nome, mapa), "rubrica");
    a.previstoAnual += l.previsto;
    if (l.deduzida) a.deduzida = true;
  }
  const gruposPrevisao = new Set(prev.linhas.map((l) => chaveRotulo(aplicarDePara(l.grupo, mapa))));
  for (const aj of prev.ajustes) {
    const grupo = aj.grupo && gruposPrevisao.has(chaveRotulo(aplicarDePara(aj.grupo, mapa))) ? aplicarDePara(aj.grupo, mapa) : GRUPO_AJUSTES_GERAIS;
    const a = linha(grupo, aj.descricao || "Ajuste sem descrição", "ajuste");
    const v = Math.abs(Number(aj.valor) || 0);
    a.previstoAnual += aj.sinal === "-" ? -v : v;
    a.sinal = aj.sinal;
  }

  let relatoriosUsados = 0;
  for (let pos = 1; pos <= posAte; pos++) {
    for (const m of porPosicao.get(pos) ?? []) {
      relatoriosUsados++;
      for (const g of m.demonstrativo?.despesas?.grupos ?? []) {
        const grupoDeduzido = !!re && re.test(g.nome);
        for (const it of g.itens ?? []) {
          const grupo = aplicarDePara(g.nome, mapa);
          const nome = aplicarDePara(it.nome, mapa);
          // Uma despesa realizada com o mesmo nome de um ajuste do grupo é comparada com ele.
          const gk = grupos.get(chaveRotulo(grupo));
          const tipo = gk?.linhas.has(`ajuste:${chaveRotulo(nome)}`) && !gk.linhas.has(`rubrica:${chaveRotulo(nome)}`) ? "ajuste" : "rubrica";
          const a = linha(grupo, nome, tipo);
          a.realizado += Number(it.valor) || 0;
          if (grupoDeduzido || (!!re && re.test(it.nome))) a.deduzida = true;
        }
      }
    }
  }
  if (relatoriosUsados === 0) avisos.push(`Nenhum relatório mensal de ${meses[0]!.rotulo} a ${mesAte.rotulo} para este condomínio.`);

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
    avisos: [...prev.avisos.filter((a) => !a.startsWith("Informe a quantidade de unidades")), ...avisos],
  };
}
