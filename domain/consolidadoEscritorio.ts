import { formatBRL, formatNumeroBR } from "../lib/format";
import { recalcularDemonstrativo } from "./demonstrativo";
import type { ColunaExportacao } from "./exportacao";
import { percentualAprovadoDoHistorico, ultimoRateioAprovado } from "./historicoRateio";
import { competenciaMensal } from "./mensal";
import type { Condominio, HistoricoRateio, Mensal } from "./types";

/**
 * Consolidado do escritório por condomínio (#253): uma linha por condomínio, para decidir onde
 * olhar primeiro no mês. Todos os condomínios aparecem, inclusive os sem nenhum relatório.
 *
 * Situação da carga, sempre em relação a um mês de referência (por padrão, o mês anterior ao
 * atual, porque o relatório de um mês só chega depois que ele termina):
 * - atrasado: não há relatório mensal do mês de referência;
 * - incompleto: há relatório, mas o saldo não fecha;
 * - em dia: há relatório e o saldo fecha.
 */

export type SituacaoCarga = "em_dia" | "atrasado" | "incompleto";
export type CriterioConsolidado = "atraso" | "inadimplencia" | "saldo";

export const ROTULO_SITUACAO: Record<SituacaoCarga, string> = {
  em_dia: "Em dia",
  atrasado: "Atrasado",
  incompleto: "Incompleto",
};

export interface MesReferencia {
  mes: number;
  ano: number;
}

export interface LinhaConsolidado {
  condoId: string;
  nome: string;
  codigo: string;
  cnpj: string;
  /** Mês do último relatório mensal do condomínio, se houver. */
  ultimoMes: string | null;
  receitas: number | null;
  despesas: number | null;
  saldoAtual: number | null;
  inadimplencia: number | null;
  variacaoRateio: number | null;
  situacao: SituacaoCarga;
  motivo: string;
}

const chave = (m: MesReferencia) => m.ano * 100 + m.mes;
const rotulo = (m: MesReferencia) => `${String(m.mes).padStart(2, "0")}/${m.ano}`;
const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Mês anterior ao de `hoje`: o último mês que já pode ter relatório. */
export function mesReferenciaPadrao(hoje = new Date()): MesReferencia {
  const mes = hoje.getMonth() + 1;
  return mes === 1 ? { mes: 12, ano: hoje.getFullYear() - 1 } : { mes: mes - 1, ano: hoje.getFullYear() };
}

export function consolidadoEscritorio(
  condominios: Pick<Condominio, "id" | "nome" | "codigo" | "cnpj">[],
  mensais: Mensal[],
  historico: HistoricoRateio[],
  referencia: MesReferencia,
): LinhaConsolidado[] {
  return condominios.map((c) => {
    const doCondo = mensais
      .filter((m) => m.condoId === c.id)
      .map((m) => ({ m, comp: competenciaMensal(m) }))
      .filter((x): x is { m: Mensal; comp: MesReferencia } => x.comp !== null)
      .sort((a, b) => chave(a.comp) - chave(b.comp));
    const ultimo = doCondo.at(-1) ?? null;
    const daReferencia = doCondo.filter((x) => chave(x.comp) === chave(referencia)).at(-1) ?? null;
    const totais = ultimo?.m.demonstrativo?.totais;

    let situacao: SituacaoCarga;
    let motivo: string;
    if (!daReferencia) {
      situacao = "atrasado";
      motivo = doCondo.length
        ? `Sem relatório de ${rotulo(referencia)}.`
        : "Nenhum relatório mensal importado.";
    } else if (
      daReferencia.m.demonstrativo &&
      recalcularDemonstrativo(daReferencia.m.demonstrativo).avisos.length > 0
    ) {
      situacao = "incompleto";
      motivo = `O saldo de ${rotulo(referencia)} não fecha.`;
    } else {
      situacao = "em_dia";
      motivo = `Relatório de ${rotulo(referencia)} carregado e conferido.`;
    }

    const aprovado = ultimoRateioAprovado(historico, c.id);
    return {
      condoId: c.id,
      nome: c.nome,
      codigo: c.codigo?.trim() ?? "",
      cnpj: c.cnpj?.trim() ?? "",
      ultimoMes: ultimo ? rotulo(ultimo.comp) : null,
      receitas: numero(totais?.receitas),
      despesas: numero(totais?.despesas),
      saldoAtual: numero(totais?.saldoAtual),
      inadimplencia: ultimo ? numero(ultimo.m.receber?.valor) : null,
      variacaoRateio: aprovado ? percentualAprovadoDoHistorico(historico, c.id, aprovado.ano) : null,
      situacao,
      motivo,
    };
  });
}

const PESO_SITUACAO: Record<SituacaoCarga, number> = { atrasado: 0, incompleto: 1, em_dia: 2 };

/** Ordena sem alterar a lista original. Valores ausentes vão para o fim. */
export function ordenarConsolidado(
  linhas: LinhaConsolidado[],
  criterio: CriterioConsolidado,
): LinhaConsolidado[] {
  const porNome = (a: LinhaConsolidado, b: LinhaConsolidado) => a.nome.localeCompare(b.nome, "pt-BR");
  const nulosNoFim = (a: number | null, b: number | null, desc: boolean) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return desc ? b - a : a - b;
  };
  return [...linhas].sort((a, b) => {
    const r =
      criterio === "atraso"
        ? PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao]
        : criterio === "inadimplencia"
          ? nulosNoFim(a.inadimplencia, b.inadimplencia, true)
          : nulosNoFim(a.saldoAtual, b.saldoAtual, false);
    return r || porNome(a, b);
  });
}

/** Busca por nome, código ou CNPJ, sem acentos e sem maiúsculas. */
export function filtrarConsolidado(
  linhas: LinhaConsolidado[],
  busca: string,
  situacao: SituacaoCarga | "todas",
): LinhaConsolidado[] {
  const normal = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const termo = normal(busca.trim());
  const soDigitos = termo.replace(/\D/g, "");
  return linhas.filter(
    (l) =>
      (situacao === "todas" || l.situacao === situacao) &&
      (!termo ||
        normal(`${l.nome} ${l.codigo}`).includes(termo) ||
        (soDigitos.length > 0 && l.cnpj.replace(/\D/g, "").includes(soDigitos))),
  );
}

export function totaisConsolidado(linhas: LinhaConsolidado[]) {
  const soma = (f: (l: LinhaConsolidado) => number | null) =>
    Math.round(linhas.reduce((s, l) => s + (f(l) ?? 0), 0) * 100) / 100;
  return {
    receitas: soma((l) => l.receitas),
    despesas: soma((l) => l.despesas),
    saldoAtual: soma((l) => l.saldoAtual),
    inadimplencia: soma((l) => l.inadimplencia),
  };
}

const moeda = (n: number | null) => (n === null ? "Sem dados" : formatBRL(n));

/** Colunas comuns a tela, CSV, XLSX e impressão (#253). */
export function colunasConsolidado(): ColunaExportacao<LinhaConsolidado>[] {
  return [
    { titulo: "Código", valor: (l) => l.codigo },
    { titulo: "Condomínio", valor: (l) => l.nome },
    { titulo: "Situação", valor: (l) => ROTULO_SITUACAO[l.situacao] },
    { titulo: "Último mês", valor: (l) => l.ultimoMes ?? "Sem dados" },
    { titulo: "Receitas", valor: (l) => l.receitas, texto: (l) => moeda(l.receitas), alinhamento: "direita" },
    { titulo: "Despesas", valor: (l) => l.despesas, texto: (l) => moeda(l.despesas), alinhamento: "direita" },
    { titulo: "Saldo atual", valor: (l) => l.saldoAtual, texto: (l) => moeda(l.saldoAtual), alinhamento: "direita" },
    {
      titulo: "Inadimplência",
      valor: (l) => l.inadimplencia,
      texto: (l) => moeda(l.inadimplencia),
      alinhamento: "direita",
    },
    {
      titulo: "Variação do rateio",
      valor: (l) => l.variacaoRateio,
      texto: (l) => (l.variacaoRateio === null ? "—" : `${formatNumeroBR(l.variacaoRateio, 2)}%`),
      alinhamento: "direita",
    },
  ];
}

/** Rodapé com os totais do escritório, uma posição por coluna. */
export function rodapeConsolidado(linhas: LinhaConsolidado[]): string[] {
  const t = totaisConsolidado(linhas);
  return [
    "",
    `Total (${linhas.length})`,
    "",
    "",
    formatBRL(t.receitas),
    formatBRL(t.despesas),
    formatBRL(t.saldoAtual),
    formatBRL(t.inadimplencia),
    "",
  ];
}
