import { calcularPrevisao, expressaoDeducao } from "./previsao";
import { competenciaMensal, mesesDoExercicioSeguinte, chaveRotulo } from "./previstoRealizado";
import { centavos } from "./demonstrativo";
import type { Condominio, Demonstrativo, Exercicio, Mensal } from "./types";

export type CelulaMensal = { previsto: number; realizado: number; diferenca: number; horizontal: number | null; verticalPrevisto: number | null; verticalRealizado: number | null };
export type LinhaMensal = { grupo: string; mensal: CelulaMensal[]; total: CelulaMensal };
export type ResultadoMensalDetalhado = { meses: { posicao: number; rotulo: string; relatorios: number }[]; linhas: LinhaMensal[]; total: CelulaMensal; avisos: string[]; relatoriosUsados: number };

const pct = (n: number, base: number) => base === 0 ? null : Math.round((n / Math.abs(base)) * 10000) / 100;
const fechar = (previsto: number, realizado: number, totalPrevisto: number, totalRealizado: number): CelulaMensal => {
  const p = centavos(previsto), r = centavos(realizado);
  return { previsto: p, realizado: r, diferenca: centavos(r - p), horizontal: pct(r - p, p), verticalPrevisto: pct(p, totalPrevisto), verticalRealizado: pct(r, totalRealizado) };
};

export function compararPrevistoRealizadoMensal(
  exercicio: Exercicio,
  mensais: Mensal[],
  opcoes: {
    condominio?: Pick<Condominio, "unidades" | "mapeamento"> | null;
    inicio?: number;
    fim?: number;
    /** Base pra projetar a previsão (ver `demonstrativoBasePrevisao`, em `previsao.ts`) — o realizado
     * do exercício anterior. Sem isso, cai no demonstrativo do próprio `exercicio` (compatibilidade). */
    demonstrativoBase?: Demonstrativo | null;
  } = {},
): ResultadoMensalDetalhado {
  const janela = mesesDoExercicioSeguinte(exercicio);
  const inicio = Math.max(1, Math.min(12, opcoes.inicio ?? 1));
  const fim = Math.max(inicio, Math.min(12, opcoes.fim ?? 12));
  const selecionados = janela.slice(inicio - 1, fim);
  const ch = (m: { mes: number; ano: number }) => m.ano * 100 + m.mes;
  const porPos = new Map<number, Mensal[]>();
  const pos = new Map(janela.map((m, i) => [ch(m), i + 1]));
  for (const m of mensais) { if (m.condoId !== exercicio.condoId) continue; const c = competenciaMensal(m); const p = c ? pos.get(ch(c)) : undefined; if (p && p >= inicio && p <= fim) porPos.set(p, [...(porPos.get(p) ?? []), m]); }
  const prev = calcularPrevisao(opcoes.demonstrativoBase ?? exercicio.demonstrativo, { ...exercicio, indices: exercicio.consid?.indices, prev: { ...(exercicio.prev ?? { modo: "tradicional" }), modo: "detalhado" } }, opcoes.condominio?.unidades ?? null);
  const mapa = new Map((opcoes.condominio?.mapeamento ?? []).filter((x) => x.de?.trim()).map((x) => [chaveRotulo(x.de), x.para]));
  const nome = (s: string) => mapa.get(chaveRotulo(s)) ?? s;
  const grupos = new Map<string, { nome: string; previsto: number; realizado: number[] }>();
  for (const l of prev.linhas) { if (l.deduzida) continue; const g = nome(l.grupo); const x = grupos.get(chaveRotulo(g)) ?? { nome: g, previsto: 0, realizado: Array(selecionados.length).fill(0) }; x.previsto += l.previsto; grupos.set(chaveRotulo(g), x); }
  const re = expressaoDeducao(exercicio.deducaoRegex);
  let relatoriosUsados = 0;
  for (let i = 0; i < selecionados.length; i++) for (const m of porPos.get(inicio + i) ?? []) { relatoriosUsados++; for (const g of m.demonstrativo?.despesas?.grupos ?? []) { if (re?.test(g.nome)) continue; const key = chaveRotulo(nome(g.nome)); const x = grupos.get(key) ?? { nome: nome(g.nome), previsto: 0, realizado: Array(selecionados.length).fill(0) }; for (const it of g.itens ?? []) if (!re?.test(it.nome)) x.realizado[i] += Number(it.valor) || 0; grupos.set(key, x); } }
  const totalPrevisto = [...grupos.values()].reduce((s, g) => s + g.previsto, 0) / 12 * selecionados.length;
  const totalRealizado = [...grupos.values()].reduce((s, g) => s + g.realizado.reduce((a, b) => a + b, 0), 0);
  const linhas = [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((g) => { const p = g.previsto / 12; const r = g.realizado.reduce((a, b) => a + b, 0); return { grupo: g.nome, mensal: g.realizado.map((v) => fechar(p, v, totalPrevisto / selecionados.length, totalRealizado / selecionados.length)), total: fechar(p * selecionados.length, r, totalPrevisto, totalRealizado) }; });
  const meses = selecionados.map((m, i) => ({ posicao: inicio + i, rotulo: `${String(m.mes).padStart(2, "0")}/${m.ano}`, relatorios: porPos.get(inicio + i)?.length ?? 0 }));
  const avisos = meses.filter((m) => m.relatorios === 0).map((m) => m.rotulo);
  return { meses, linhas, total: fechar(totalPrevisto, totalRealizado, totalPrevisto, totalRealizado), avisos: avisos.length ? [`Sem relatório mensal em: ${avisos.join(", ")}. O realizado desses meses conta como zero.`] : [], relatoriosUsados };
}
