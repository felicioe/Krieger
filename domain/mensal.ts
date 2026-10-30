import { nomeParaRelatorio } from "./condominio";
import { demonstrativoVazio, normalizarDemonstrativo, recalcularDemonstrativo } from "./demonstrativo";
import type { Condominio, Demonstrativo, LinhaValor, Mensal } from "./types";

/**
 * Relatório mensal: demonstrativo do mês + contas a receber + notas explicativas.
 * O mês (competência) é lido do período do demonstrativo — o tipo Mensal não tem
 * campo próprio para isso e os nomes de campo não podem mudar.
 */

export type Competencia = { mes: number; ano: number };

const p2 = (n: number) => String(n).padStart(2, "0");

/** Lê dd/mm/aaaa ou mm/aaaa e devolve mês/ano. */
export function mesAnoDe(texto: string | null | undefined): Competencia | null {
  const m = /^(?:\d{1,2}\/)?(\d{1,2})\/(\d{4})$/.exec((texto ?? "").trim());
  if (!m) return null;
  const mes = Number(m[1]);
  const ano = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { mes, ano } : null;
}

/** Competência do relatório: mês da data final do período (ou da inicial). */
export function competenciaMensal(m: Pick<Mensal, "demonstrativo">): Competencia | null {
  return mesAnoDe(m.demonstrativo?.periodo?.fim) ?? mesAnoDe(m.demonstrativo?.periodo?.ini);
}

export const rotuloCompetencia = (c: Competencia | null): string => (c ? `${p2(c.mes)}/${c.ano}` : "—");

/** Valor numérico para ordenar (aaaamm); 0 sem competência. */
export const ordemCompetencia = (c: Competencia | null): number => (c ? c.ano * 100 + c.mes : 0);

export function mesAnterior(c: Competencia): Competencia {
  return c.mes === 1 ? { mes: 12, ano: c.ano - 1 } : { mes: c.mes - 1, ano: c.ano };
}

/** Primeiro e último dia do mês em dd/mm/aaaa. */
export function periodoDoMes(c: Competencia): { ini: string; fim: string } {
  const ultimo = new Date(c.ano, c.mes, 0).getDate();
  return { ini: `01/${p2(c.mes)}/${c.ano}`, fim: `${p2(ultimo)}/${p2(c.mes)}/${c.ano}` };
}

const zerar = (l: LinhaValor[]): LinhaValor[] => l.map((x) => ({ nome: x.nome, valor: 0 }));

/**
 * Novo relatório mensal do condomínio. Com `anterior` (relatório do mês anterior):
 * o saldo anterior recebe as contas do saldo atual dele, e as contas, receitas e
 * despesas são copiadas só com os nomes (valores zerados) para agilizar a digitação.
 */
export function mensalPadrao(c: Condominio, competencia: Competencia, anterior?: Mensal | null): Omit<Mensal, "id"> {
  const nome = nomeParaRelatorio(c);
  const vazio = demonstrativoVazio(nome);
  const da = anterior?.demonstrativo;
  const demonstrativo: Demonstrativo = recalcularDemonstrativo({
    ...vazio,
    periodo: periodoDoMes(competencia),
    ...(da
      ? {
          saldoAnterior: { contas: da.saldoAtual.contas.map((x) => ({ ...x })), total: 0 },
          receitas: { itens: zerar(da.receitas.itens), subtotal: 0, totalComSaldo: 0 },
          despesas: {
            grupos: da.despesas.grupos.map((g) => ({ nome: g.nome, itens: zerar(g.itens) })),
            subtotal: 0,
            saldoRestante: 0,
          },
          saldoAtual: { contas: zerar(da.saldoAtual.contas), total: 0 },
        }
      : {}),
  });
  return {
    condoId: c.id,
    condoNome: nome,
    demonstrativo,
    origem: [],
    receber: { unidades: null, valor: null },
    notas: [],
  };
}

/** Relatório do mês anterior do mesmo condomínio, se houver. */
export function relatorioAnterior(condoId: string, competencia: Competencia, mensais: Mensal[]): Mensal | null {
  const alvo = ordemCompetencia(mesAnterior(competencia));
  return mensais.find((m) => m.condoId === condoId && ordemCompetencia(competenciaMensal(m)) === alvo) ?? null;
}

/** Completa um relatório mensal vindo da API/backup, preservando campos extras. */
export function normalizarMensal(raw: Partial<Mensal> & { id?: string }): Mensal {
  return {
    ...raw,
    id: raw.id ?? "",
    condoId: raw.condoId ?? "",
    condoNome: raw.condoNome ?? "",
    demonstrativo: normalizarDemonstrativo(raw.demonstrativo, raw.condoNome ?? ""),
    origem: raw.origem ?? [],
    receber: { unidades: raw.receber?.unidades ?? null, valor: raw.receber?.valor ?? null },
    notas: (raw.notas ?? []).map((n) => ({ rubrica: n.rubrica ?? "", texto: n.texto ?? "", valor: n.valor ?? null })),
  } as Mensal;
}

export type Validacao = { ok: true } | { ok: false; erro: string };

/** Condomínio e mês obrigatórios; um único relatório por condomínio e mês. */
export function validarMensal(
  condoId: string,
  competencia: Competencia | null,
  existentes: Mensal[],
  idAtual?: string,
): Validacao {
  if (!condoId) return { ok: false, erro: "Escolha o condomínio." };
  if (!competencia || competencia.ano < 1900 || competencia.ano > 2999) {
    return { ok: false, erro: "Informe o mês do relatório (mm/aaaa) ou o período do demonstrativo." };
  }
  const alvo = ordemCompetencia(competencia);
  const dup = existentes.find(
    (m) => m.condoId === condoId && m.id !== idAtual && ordemCompetencia(competenciaMensal(m)) === alvo,
  );
  if (dup) return { ok: false, erro: `Já existe um relatório mensal de ${rotuloCompetencia(competencia)} para este condomínio.` };
  return { ok: true };
}

/** Prepara para gravar: recalcula o demonstrativo e descarta notas totalmente vazias. */
export function prepararMensal(m: Mensal): Mensal {
  return {
    ...m,
    demonstrativo: m.demonstrativo ? normalizarDemonstrativo(m.demonstrativo, m.condoNome) : null,
    notas: m.notas.filter((n) => n.rubrica.trim() || n.texto.trim() || n.valor !== null),
  };
}
