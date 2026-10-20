import { parseData, dataParaISO } from "../lib/format";
import type { Assembleia, Condominio } from "./types";

export type TipoVencimento = "seguro" | "extintores" | "vistoria" | "mandato";

export interface Vencimento {
  condoId: string;
  condoNome: string;
  tipo: TipoVencimento;
  descricao: string;
  data: Date;
  /** dias até o vencimento (negativo = vencido) */
  dias: number;
}

const DIA = 24 * 60 * 60 * 1000;

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diasEntre(hoje: Date, alvo: Date) {
  return Math.round((inicioDoDia(alvo).getTime() - inicioDoDia(hoje).getTime()) / DIA);
}

/** Data da próxima vistoria técnica: 31/12 de (vistoriaAno + vistoriaIntervalo). */
export function dataVistoria(c: Pick<Condominio, "vistoriaAno" | "vistoriaIntervalo">): Date | null {
  const ano = Number(c.vistoriaAno);
  if (!ano) return null;
  const intervalo = Number(c.vistoriaIntervalo) || 3;
  return new Date(ano + intervalo, 11, 31);
}

/**
 * Lista os vencimentos (seguro, extintores, vistoria e fim de mandato) que
 * ocorrem em até `janelaDias` dias — incluindo os já vencidos.
 */
export function calcularVencimentos(
  condos: Condominio[],
  hoje: Date = new Date(),
  janelaDias = 90,
): Vencimento[] {
  const lista: Vencimento[] = [];
  for (const c of condos) {
    const nome = c.nome || c.nomeRelatorio || "(sem nome)";
    const add = (tipo: TipoVencimento, descricao: string, data: Date | null) => {
      if (!data) return;
      const dias = diasEntre(hoje, data);
      if (dias <= janelaDias) lista.push({ condoId: c.id, condoNome: nome, tipo, descricao, data, dias });
    };
    add("seguro", "Vigência do seguro", parseData(c.vigenciaSeguro));
    add("extintores", "Recarga de extintores", parseData(c.vigenciaExtintores));
    add("vistoria", "Vistoria técnica", dataVistoria(c));
    for (const m of c.administracao ?? []) {
      if (m.mandatoFim) {
        add("mandato", `Fim do mandato — ${m.cargo || "Cargo"}${m.nome ? ` (${m.nome})` : ""}`, parseData(m.mandatoFim));
      }
    }
  }
  return lista.sort((a, b) => a.dias - b.dias);
}

/** Dias desde o último backup, ou null se nunca foi feito. */
export function diasDesdeBackup(em: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!em) return null;
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((hoje.getTime() - d.getTime()) / DIA);
}

/** Avisar quando o backup nunca foi feito ou tem mais de 30 dias. */
export function backupAtrasado(em: string | null | undefined, hoje: Date = new Date()): boolean {
  const dias = diasDesdeBackup(em, hoje);
  return dias === null || dias > 30;
}

/** Próximas assembleias (data >= hoje), ordenadas, limitadas a `n`. */
export function proximasAssembleias(lista: Assembleia[], hoje: Date = new Date(), n = 5): Assembleia[] {
  const h = dataParaISO(hoje);
  return lista
    .filter((a) => a.data && a.data >= h)
    .sort((a, b) => (a.data + (a.hora1 || "")).localeCompare(b.data + (b.hora1 || "")))
    .slice(0, n);
}
