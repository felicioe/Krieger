import { centavos } from "./demonstrativo";
import {
  compararPrevistoRealizado,
  competenciaMensal,
  mesesDoExercicioSeguinte,
  chaveRotulo,
  type OpcoesComparativo,
} from "./previstoRealizado";
import type { Demonstrativo, Mensal } from "./types";

export type CelulaMensal = { previsto: number; realizado: number; diferenca: number; horizontal: number | null; verticalPrevisto: number | null; verticalRealizado: number | null };
export type LinhaMensal = { grupo: string; mensal: CelulaMensal[]; total: CelulaMensal };
export type ResultadoMensalDetalhado = {
  meses: { posicao: number; rotulo: string; relatorios: number }[];
  linhas: LinhaMensal[];
  total: CelulaMensal;
  avisos: string[];
  relatoriosUsados: number;
  /** Situação do previsto aprovado usado (ok, sem_base ou sem_percentual). */
  situacaoPrevisto: "ok" | "sem_base" | "sem_percentual";
};

const pct = (n: number, base: number) => base === 0 ? null : Math.round((n / Math.abs(base)) * 10000) / 100;
const fechar = (previsto: number, realizado: number, totalPrevisto: number, totalRealizado: number): CelulaMensal => {
  const p = centavos(previsto), r = centavos(realizado);
  return { previsto: p, realizado: r, diferenca: centavos(r - p), horizontal: pct(r - p, p), verticalPrevisto: pct(p, totalPrevisto), verticalRealizado: pct(r, totalRealizado) };
};

/**
 * Previsto × Realizado mês a mês. Usa a MESMA premissa do comparativo anual (base = ano anterior,
 * previsto = base × (1 + variação% da prestação), realizado = relatórios mensais do período): o
 * previsto anual de cada grupo vem de `compararPrevistoRealizado` e é dividido em 12; o realizado
 * de cada mês é o do relatório daquele mês. Assim o total do período fecha com o relatório anual.
 */
export function compararPrevistoRealizadoMensal(
  exercicio: Parameters<typeof compararPrevistoRealizado>[0],
  mensais: Mensal[],
  opcoes: OpcoesComparativo & { inicio?: number; fim?: number } = {},
): ResultadoMensalDetalhado {
  const anual = compararPrevistoRealizado(exercicio, mensais, opcoes);
  const janela = mesesDoExercicioSeguinte(exercicio);
  const inicio = Math.max(1, Math.min(12, opcoes.inicio ?? 1));
  const fim = Math.max(inicio, Math.min(12, opcoes.fim ?? 12));
  const selecionados = janela.slice(inicio - 1, fim);
  const ch = (m: { mes: number; ano: number }) => m.ano * 100 + m.mes;
  const pos = new Map(janela.map((m, i) => [ch(m), i + 1]));
  const fonte = exercicio.fechado && exercicio.fechamento ? exercicio.fechamento.mensais : mensais;
  const porPos = new Map<number, Mensal[]>();
  for (const m of fonte) {
    if (m.condoId !== exercicio.condoId) continue;
    const c = competenciaMensal(m);
    const p = c ? pos.get(ch(c)) : undefined;
    if (p && p >= inicio && p <= fim) porPos.set(p, [...(porPos.get(p) ?? []), m]);
  }

  let relatoriosUsados = 0;
  const realizadoPorGrupo = new Map<string, number[]>();
  for (let i = 0; i < selecionados.length; i++) {
    for (const m of porPos.get(inicio + i) ?? []) {
      relatoriosUsados++;
      for (const g of m.demonstrativo?.despesas?.grupos ?? []) {
        const k = chaveRotulo(g.nome);
        const serie = realizadoPorGrupo.get(k) ?? Array(selecionados.length).fill(0);
        for (const it of g.itens ?? []) serie[i] += Number(it.valor) || 0;
        realizadoPorGrupo.set(k, serie);
      }
    }
  }

  // Grupos do comparativo anual (já sem as deduções e com o previsto pulverizado). Grupos que só
  // aparecem no realizado de um mês sem previsto entram com previsto zero, como no anual.
  const grupos = anual.grupos.map((g) => ({
    nome: g.nome,
    previstoAnual: g.totais.previstoAnual,
    serie: realizadoPorGrupo.get(chaveRotulo(g.nome)) ?? Array<number>(selecionados.length).fill(0),
  }));
  const conhecidos = new Set(grupos.map((g) => chaveRotulo(g.nome)));
  for (const [k, serie] of realizadoPorGrupo) {
    if (conhecidos.has(k) || serie.every((v) => v === 0)) continue;
    grupos.push({ nome: k, previstoAnual: 0, serie });
  }

  let situacaoPrevisto: "ok" | "sem_base" | "sem_percentual" = "ok";
  if (!opcoes.demonstrativoBase || !temGruposComDespesas(opcoes.demonstrativoBase)) {
    situacaoPrevisto = "sem_base";
  }
  let totalPrevisto = grupos.reduce((s, g) => s + g.previstoAnual, 0) / 12 * selecionados.length;
  const totalRealizado = grupos.reduce((s, g) => s + g.serie.reduce((a, b) => a + b, 0), 0);
  // Quando não há demonstrativo base explícito, previsto não se aplica: zerar totais.
  if (situacaoPrevisto === "sem_base") totalPrevisto = 0;
  const mediaPrev = totalPrevisto / Math.max(1, selecionados.length);
  const mediaReal = totalRealizado / Math.max(1, selecionados.length);
  const linhas: LinhaMensal[] = grupos
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((g) => {
      const p = g.previstoAnual / 12;
      const r = g.serie.reduce((a, b) => a + b, 0);
      return {
        grupo: g.nome,
        mensal: g.serie.map((v) => fechar(p, v, mediaPrev, mediaReal)),
        total: fechar(p * selecionados.length, r, totalPrevisto, totalRealizado),
      };
    });
  const meses = selecionados.map((m, i) => ({
    posicao: inicio + i,
    rotulo: `${String(m.mes).padStart(2, "0")}/${m.ano}`,
    relatorios: porPos.get(inicio + i)?.length ?? 0,
  }));
  const avisos = meses.filter((m) => m.relatorios === 0).map((m) => m.rotulo);
  return {
    meses,
    linhas,
    total: fechar(totalPrevisto, totalRealizado, totalPrevisto, totalRealizado),
    avisos: avisos.length ? [`Sem relatório mensal em: ${avisos.join(", ")}. O realizado desses meses conta como zero.`] : [],
    relatoriosUsados,
    situacaoPrevisto,
  };
}

function temGruposComDespesas(demo: Demonstrativo | undefined): boolean {
  return !!demo?.despesas?.grupos?.some((g) => g.itens?.some((i) => !!i.nome || (Number(i.valor) || 0) !== 0));
}
