import { nomeParaRelatorio } from "./condominio";
import { demonstrativoVazio, normalizarDemonstrativo } from "./demonstrativo";
import { resolverVariacao } from "./previsao";
import type { Condominio, Exercicio } from "./types";

function hojeBR(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Copia do condomínio os dados usados nas considerações do relatório. */
export function considDoCondominio(c: Condominio): Exercicio["consid"] {
  return {
    administracao: structuredClone(c.administracao ?? []),
    contasReceber: null,
    contasPagar: null,
    seguradora: c.seguradora ?? "",
    vigenciaSeguro: c.vigenciaSeguro ?? "",
    seguro: structuredClone(c.seguro ?? { riscoAbsoluto: null, coberturas: [] }),
    vigenciaExtintores: c.vigenciaExtintores ?? "",
    ultGordura: c.ultGordura ?? "",
    ultDedetizacao: c.ultDedetizacao ?? "",
    ultCaixaDagua: c.ultCaixaDagua ?? "",
    vistoriaAno: c.vistoriaAno ?? null,
    vistoriaLei: c.vistoriaLei ?? "",
    vistoriaIntervalo: c.vistoriaIntervalo ?? 3,
    aguaRubrica: c.aguaRubrica ?? "",
    consumoAguaManual: null,
    energiaRubrica: c.energiaRubrica ?? "",
    consumoEnergiaManual: null,
    elevadorRubrica: c.elevadorRubrica ?? "",
    consumoElevadorManual: null,
    elevadorFornecedor: c.elevadorFornecedor ?? "",
    documentosObrigatorios: structuredClone(c.documentosObrigatorios ?? []),
    indices: structuredClone(c.indices ?? []),
    extras: [],
  };
}

/** Novo exercício (prestação de contas) a partir do cadastro do condomínio. */
export function exercicioPadrao(c: Condominio, ano: number, cidade = "", hoje = new Date()): Omit<Exercicio, "id"> {
  return {
    condoId: c.id,
    condoNome: nomeParaRelatorio(c),
    ano,
    demonstrativo: demonstrativoVazio(nomeParaRelatorio(c)),
    origem: [],
    cidade,
    dataEmissao: hojeBR(hoje),
    rateioAtual: c.rateioAtual ?? null,
    rateioAprovado: null,
    variacao: c.variacaoMetodo === "manual" || !c.variacaoMetodo ? (c.variacaoPadrao ?? null) : null,
    variacaoMetodo: c.variacaoMetodo ?? "manual",
    variacaoParam: c.variacaoParam ?? null,
    deducaoRegex: c.deducaoRegex ?? "",
    arredondamento: c.arredondamento ?? "truncar",
    confer: null,
    consid: considDoCondominio(c),
    prev: { modo: "tradicional", ajustes: [], fundoReservaPct: null },
    mostrarAnalise: true,
    mostrarPizza: true,
  };
}

/** Completa um exercício vindo da API/backup, preservando campos extras. */
export function normalizarExercicio(raw: Partial<Exercicio> & { id?: string }): Exercicio {
  const consid = (raw.consid ?? {}) as Partial<Exercicio["consid"]>;
  return {
    ...raw,
    id: raw.id ?? "",
    condoId: raw.condoId ?? "",
    condoNome: raw.condoNome ?? "",
    ano: raw.ano ?? "",
    demonstrativo: normalizarDemonstrativo(raw.demonstrativo, raw.condoNome ?? ""),
    origem: raw.origem ?? [],
    cidade: raw.cidade ?? "",
    dataEmissao: raw.dataEmissao ?? "",
    rateioAtual: raw.rateioAtual ?? null,
    rateioAprovado: raw.rateioAprovado ?? null,
    variacao: raw.variacao ?? null,
    variacaoMetodo: raw.variacaoMetodo ?? "manual",
    variacaoParam: raw.variacaoParam ?? null,
    deducaoRegex: raw.deducaoRegex ?? "",
    arredondamento: raw.arredondamento ?? "truncar",
    confer: raw.confer ?? null,
    consid: {
      ...consid,
      administracao: consid.administracao ?? [],
      contasReceber: consid.contasReceber ?? null,
      contasPagar: consid.contasPagar ?? null,
      seguradora: consid.seguradora ?? "",
      vigenciaSeguro: consid.vigenciaSeguro ?? "",
      seguro: consid.seguro ?? { riscoAbsoluto: null, coberturas: [] },
      vigenciaExtintores: consid.vigenciaExtintores ?? "",
      ultGordura: consid.ultGordura ?? "",
      ultDedetizacao: consid.ultDedetizacao ?? "",
      ultCaixaDagua: consid.ultCaixaDagua ?? "",
      vistoriaAno: consid.vistoriaAno ?? null,
      vistoriaLei: consid.vistoriaLei ?? "",
      vistoriaIntervalo: consid.vistoriaIntervalo ?? 3,
      aguaRubrica: consid.aguaRubrica ?? "",
      energiaRubrica: consid.energiaRubrica ?? "",
      elevadorRubrica: consid.elevadorRubrica ?? "",
      elevadorFornecedor: consid.elevadorFornecedor ?? "",
      documentosObrigatorios: consid.documentosObrigatorios ?? [],
      indices: consid.indices ?? [],
      extras: consid.extras ?? [],
    },
    prev: {
      ...raw.prev,
      modo: raw.prev?.modo ?? "tradicional",
      ajustes: raw.prev?.ajustes ?? [],
      fundoReservaPct: raw.prev?.fundoReservaPct ?? null,
    },
  } as Exercicio;
}

export type Validacao = { ok: true } | { ok: false; erro: string };

/** Condomínio e ano obrigatórios; um único exercício por condomínio e ano. */
export function validarNovoExercicio(
  condoId: string,
  ano: number | null,
  existentes: Pick<Exercicio, "id" | "condoId" | "ano">[],
  idAtual?: string,
): Validacao {
  if (!condoId) return { ok: false, erro: "Escolha o condomínio." };
  if (!ano || ano < 1900 || ano > 2999) return { ok: false, erro: "Informe o ano do exercício com 4 dígitos." };
  const dup = existentes.find((e) => e.condoId === condoId && String(e.ano) === String(ano) && e.id !== idAtual);
  if (dup) return { ok: false, erro: `Já existe uma prestação de contas de ${ano} para este condomínio.` };
  return { ok: true };
}

/**
 * Prepara para gravar: recalcula os totais do demonstrativo e, quando o
 * método de variação não é manual, grava o percentual resolvido em `variacao`.
 */
export function prepararExercicio(e: Exercicio): Exercicio {
  const demonstrativo = e.demonstrativo ? normalizarDemonstrativo(e.demonstrativo, e.condoNome) : null;
  const variacao =
    e.variacaoMetodo === "manual" ? e.variacao : resolverVariacao({ ...e, indices: e.consid?.indices }).pct;
  return { ...e, demonstrativo, variacao };
}
