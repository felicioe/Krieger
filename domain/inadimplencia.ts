import { formatBRL, formatNumeroBR } from "../lib/format";
import type { ColunaExportacao } from "./exportacao";
import { competenciaMensal } from "./mensal";
import type { Mensal } from "./types";

/**
 * Evolução da inadimplência de um condomínio (#251).
 *
 * Reúne, mês a mês, o que os relatórios mensais já guardam em "Contas a receber" (`Mensal.receber`)
 * e as receitas do mês (`demonstrativo.totais.receitas`). Não recalcula nada: só apresenta.
 * Mês sem relatório fica sem dados (`null`), nunca zero.
 */

export interface MesAno {
  mes: number;
  ano: number;
}

export interface LinhaInadimplencia {
  mes: MesAno;
  rotulo: string;
  relatorios: number;
  unidades: number | null;
  valor: number | null;
  receitas: number | null;
  /** Valor a receber sobre as receitas do mês, em %. */
  percentual: number | null;
  /** Valor a receber no mesmo mês do ano anterior, quando houver relatório. */
  valorAnoAnterior: number | null;
  /** Variação do valor sobre o mesmo mês do ano anterior, em %. */
  variacaoAnoAnterior: number | null;
}

export interface ResultadoInadimplencia {
  linhas: LinhaInadimplencia[];
  /** Média dos meses com dados (o valor a receber é saldo, então não se soma). */
  media: { unidades: number | null; valor: number | null; percentual: number | null };
  /** Posição no último mês do período que tem relatório. */
  ultimo: LinhaInadimplencia | null;
  mesesComDados: number;
  avisos: string[];
}

/** Limite de meses do período, para evitar intervalos absurdos digitados por engano. */
export const LIMITE_MESES = 60;

const chave = (m: MesAno) => m.ano * 100 + m.mes;
export const rotuloMes = (m: MesAno) => `${String(m.mes).padStart(2, "0")}/${m.ano}`;
const arred = (n: number) => Math.round(n * 100) / 100;

/** Meses de `inicio` a `fim`, inclusive. Vazio quando o fim vem antes do início. */
export function mesesEntre(inicio: MesAno, fim: MesAno): MesAno[] {
  const meses: MesAno[] = [];
  let atual = { ...inicio };
  while (chave(atual) <= chave(fim) && meses.length < LIMITE_MESES) {
    meses.push(atual);
    atual = atual.mes === 12 ? { mes: 1, ano: atual.ano + 1 } : { mes: atual.mes + 1, ano: atual.ano };
  }
  return meses;
}

/** Relatório do mês: havendo mais de um, vale o último da lista (o mais recente gravado). */
function porMes(mensais: Mensal[], condoId: string): Map<number, { mensal: Mensal; quantos: number }> {
  const mapa = new Map<number, { mensal: Mensal; quantos: number }>();
  for (const m of mensais) {
    if (m.condoId !== condoId) continue;
    const c = competenciaMensal(m);
    if (!c) continue;
    const k = chave(c);
    mapa.set(k, { mensal: m, quantos: (mapa.get(k)?.quantos ?? 0) + 1 });
  }
  return mapa;
}

const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function evolucaoInadimplencia(
  mensais: Mensal[],
  condoId: string,
  inicio: MesAno,
  fim: MesAno,
): ResultadoInadimplencia {
  const mapa = porMes(mensais, condoId);
  const linhas: LinhaInadimplencia[] = mesesEntre(inicio, fim).map((mes) => {
    const achado = mapa.get(chave(mes));
    const anterior = mapa.get(chave({ mes: mes.mes, ano: mes.ano - 1 }));
    const valor = achado ? numero(achado.mensal.receber?.valor) : null;
    const receitas = achado ? numero(achado.mensal.demonstrativo?.totais?.receitas) : null;
    const valorAnoAnterior = anterior ? numero(anterior.mensal.receber?.valor) : null;
    return {
      mes,
      rotulo: rotuloMes(mes),
      relatorios: achado?.quantos ?? 0,
      unidades: achado ? numero(achado.mensal.receber?.unidades) : null,
      valor,
      receitas,
      percentual: valor !== null && receitas ? arred((valor / Math.abs(receitas)) * 100) : null,
      valorAnoAnterior,
      variacaoAnoAnterior:
        valor !== null && valorAnoAnterior ? arred((valor / valorAnoAnterior - 1) * 100) : null,
    };
  });

  const comDados = linhas.filter((l) => l.relatorios > 0);
  const media = (vals: (number | null)[]) => {
    const ok = vals.filter((v): v is number => v !== null);
    return ok.length ? arred(ok.reduce((s, v) => s + v, 0) / ok.length) : null;
  };
  const somaValor = comDados.reduce((s, l) => s + (l.valor ?? 0), 0);
  const somaReceitas = comDados.reduce((s, l) => s + (l.receitas ?? 0), 0);
  const semDados = linhas.filter((l) => l.relatorios === 0).map((l) => l.rotulo);

  return {
    linhas,
    media: {
      unidades: media(comDados.map((l) => l.unidades)),
      valor: media(comDados.map((l) => l.valor)),
      percentual: somaReceitas ? arred((somaValor / Math.abs(somaReceitas)) * 100) : null,
    },
    ultimo: comDados.at(-1) ?? null,
    mesesComDados: comDados.length,
    avisos: semDados.length ? [`Sem relatório mensal em: ${semDados.join(", ")}.`] : [],
  };
}

const SEM_DADOS = "Sem dados";
const pctTexto = (n: number | null) => (n === null ? "—" : `${formatNumeroBR(n, 2)}%`);

/** Colunas comuns a tela, CSV, XLSX, impressão e PDF, para nenhum deles divergir (#251). */
export function colunasInadimplencia(): ColunaExportacao<LinhaInadimplencia>[] {
  const semDados = (l: LinhaInadimplencia) => l.relatorios === 0;
  return [
    { titulo: "Mês", valor: (l) => l.rotulo },
    {
      titulo: "Unidades inadimplentes",
      valor: (l) => (semDados(l) ? SEM_DADOS : l.unidades),
      texto: (l) => (semDados(l) ? SEM_DADOS : l.unidades === null ? "—" : String(l.unidades)),
      alinhamento: "direita",
    },
    {
      titulo: "A receber",
      valor: (l) => (semDados(l) ? SEM_DADOS : l.valor),
      texto: (l) => (semDados(l) ? SEM_DADOS : formatBRL(l.valor)),
      alinhamento: "direita",
    },
    {
      titulo: "% das receitas",
      valor: (l) => (semDados(l) ? SEM_DADOS : l.percentual),
      texto: (l) => (semDados(l) ? SEM_DADOS : pctTexto(l.percentual)),
      alinhamento: "direita",
    },
    {
      titulo: "A receber no ano anterior",
      valor: (l) => l.valorAnoAnterior,
      texto: (l) => (l.valorAnoAnterior === null ? "—" : formatBRL(l.valorAnoAnterior)),
      alinhamento: "direita",
    },
    {
      titulo: "Variação sobre o ano anterior",
      valor: (l) => l.variacaoAnoAnterior,
      texto: (l) => pctTexto(l.variacaoAnoAnterior),
      alinhamento: "direita",
    },
  ];
}

/** Linha de rodapé (médias), já formatada, uma posição por coluna. */
export function rodapeInadimplencia(r: ResultadoInadimplencia): string[] {
  return [
    "Média",
    r.media.unidades === null ? "—" : formatNumeroBR(r.media.unidades, 1),
    r.media.valor === null ? "—" : formatBRL(r.media.valor),
    pctTexto(r.media.percentual),
    "",
    "",
  ];
}
