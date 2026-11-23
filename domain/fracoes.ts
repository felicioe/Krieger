import { arredondarValor } from "./previsao";
import type { Arredondamento, Condominio } from "./types";

/**
 * Rateio por fração ideal (#132). Ver docs/AVALIACAO-FRACOES.md.
 *
 * A fração é um peso: cota(u) = total mensal × peso(u) ÷ Σ pesos. Com pesos iguais, o resultado é
 * o mesmo da divisão por unidades. O peso usado é a fração prevista (`fracaoPrevista`), que é a que
 * o relatório do Systemar apresenta como previsão de rateio.
 *
 * O rateio sugerido e o índice da previsão não mudam: o reajuste % é o mesmo para todas as
 * unidades. A fração só decide quanto cada unidade paga.
 */

export type BaseRateio =
  | {
      tipo: "fracao";
      pesos: { unidade: string; peso: number }[];
      soma: number;
      /** Aviso quando a soma não fecha em 1 nem em 100 (as frações são normalizadas). */
      aviso: string | null;
    }
  | { tipo: "unidades"; unidades: number | null; motivo: string };

const fechaEm = (soma: number, alvo: number) => Math.abs(soma - alvo) <= alvo * 0.001;

/** Base do rateio de um condomínio: pesos por fração ideal ou, no fallback, a contagem. */
export function baseDoRateio(c: Pick<Condominio, "unidades" | "fracaoUnidades">): BaseRateio {
  const unidades = typeof c.unidades === "number" && c.unidades > 0 ? c.unidades : null;
  const fracoes = c.fracaoUnidades ?? [];
  if (!fracoes.length)
    return { tipo: "unidades", unidades, motivo: "O cadastro não tem a relação de frações." };
  const invalida = fracoes.find(
    (f) => !Number.isFinite(f.fracaoPrevista) || f.fracaoPrevista < 0 || !f.unidade?.trim(),
  );
  if (invalida)
    return {
      tipo: "unidades",
      unidades,
      motivo: `A fração da unidade "${invalida.unidade || "sem nome"}" é inválida.`,
    };
  const soma = fracoes.reduce((s, f) => s + f.fracaoPrevista, 0);
  if (!(soma > 0) || !Number.isFinite(soma))
    return { tipo: "unidades", unidades, motivo: "A soma das frações previstas é zero." };
  return {
    tipo: "fracao",
    pesos: fracoes.map((f) => ({ unidade: f.unidade.trim(), peso: f.fracaoPrevista })),
    soma,
    aviso:
      fechaEm(soma, 1) || fechaEm(soma, 100)
        ? null
        : `A soma das frações previstas é ${soma.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}, e não 1 nem 100%. As frações foram usadas em proporção à soma; confira o cadastro.`,
  };
}

export interface CotaUnidade {
  unidade: string;
  peso: number;
  /** Participação da unidade, em % do total. */
  percentual: number;
  /** Valor sem arredondamento. */
  exato: number;
  /** Valor cobrado, já arredondado e com a diferença distribuída. */
  valor: number;
}

export interface DistribuicaoRateio {
  cotas: CotaUnidade[];
  /** Total mensal arredondado no mesmo critério das cotas. */
  total: number;
  /** Diferença que não foi possível distribuir (0 quando fecha). */
  residuo: number;
}

const passoDe = (modo: Arredondamento) => (modo === "centavos" ? 0.01 : 1);
const cent = (n: number) => Math.round(n * 100) / 100;

/**
 * Distribui o total mensal pelas frações. Arredonda cada cota no critério da previsão e passa a
 * diferença para as maiores frações primeiro (empate: unidade em ordem), um passo de arredondamento
 * por unidade, até a soma das cotas fechar com o total arredondado.
 */
export function distribuirRateio(
  totalMensal: number,
  base: Extract<BaseRateio, { tipo: "fracao" }>,
  arredondamento: Arredondamento,
): DistribuicaoRateio {
  const passo = passoDe(arredondamento);
  const total = arredondarValor(totalMensal, arredondamento);
  const cotas: CotaUnidade[] = base.pesos.map((p) => {
    const exato = (totalMensal * p.peso) / base.soma;
    return {
      unidade: p.unidade,
      peso: p.peso,
      percentual: Math.round((p.peso / base.soma) * 1000000) / 10000,
      exato,
      valor: arredondarValor(exato, arredondamento),
    };
  });
  const soma = cent(cotas.reduce((s, c) => s + c.valor, 0));
  let passos = Math.round((total - soma) / passo);
  const ordem = [...cotas].sort(
    (a, b) => b.peso - a.peso || a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true }),
  );
  const sinal = Math.sign(passos);
  for (const c of ordem) {
    if (passos === 0) break;
    c.valor = cent(c.valor + sinal * passo);
    passos -= sinal;
  }
  return { cotas, total, residuo: cent(passos * passo) };
}
