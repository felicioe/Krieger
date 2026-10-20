import type { Condominio } from "./types";

/** Valores padrão de um condomínio novo. */
export function condominioPadrao(): Omit<Condominio, "id"> {
  return {
    codigo: "",
    nome: "",
    nomeRelatorio: "",
    cnpj: "",
    enderecoEdital: "",
    unidades: null,
    rateioAtual: null,
    prazoConvocacao: 8,
    quorum: "",
    administradoraTermo: "",
    administracao: [],
    seguradora: "",
    vigenciaSeguro: "",
    seguro: { riscoAbsoluto: null, coberturas: [] },
    vigenciaExtintores: "",
    ultGordura: "",
    ultDedetizacao: "",
    ultCaixaDagua: "",
    vistoriaAno: null,
    vistoriaLei: "",
    vistoriaIntervalo: 3,
    indices: [],
    mapeamento: [],
    deducaoRegex: "fundo de caixa p/ obras",
    aguaRubrica: "^[áa]gua",
    arredondamento: "truncar",
    variacaoPadrao: null,
    conhecidas: [],
    somenteAnual: true,
    regras: [],
    variacaoMetodo: "manual",
    variacaoParam: null,
  };
}

/**
 * Completa um registro vindo da API/backup com os padrões, preservando
 * quaisquer campos extras que já existam.
 */
export function normalizarCondominio(raw: Partial<Condominio> & { id?: string }): Condominio {
  const p = condominioPadrao();
  return {
    ...p,
    ...raw,
    id: raw.id ?? "",
    seguro: {
      riscoAbsoluto: raw.seguro?.riscoAbsoluto ?? null,
      coberturas: raw.seguro?.coberturas ?? [],
    },
    administracao: raw.administracao ?? [],
    indices: raw.indices ?? [],
    mapeamento: raw.mapeamento ?? [],
    conhecidas: raw.conhecidas ?? [],
    regras: raw.regras ?? [],
    vistoriaIntervalo: raw.vistoriaIntervalo ?? p.vistoriaIntervalo,
    somenteAnual: raw.somenteAnual ?? p.somenteAnual,
  } as Condominio;
}

/** Nome usado nos relatórios: nomeRelatorio ou, se vazio, o nome. */
export function nomeParaRelatorio(c: Pick<Condominio, "nome" | "nomeRelatorio">): string {
  return c.nomeRelatorio?.trim() || c.nome?.trim() || "";
}

export type ResultadoValidacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

/** Valida e ajusta o condomínio antes de gravar. */
export function prepararCondominio<T extends Condominio | Omit<Condominio, "id">>(
  c: T,
): ResultadoValidacao<T> {
  const nome = c.nome?.trim() ?? "";
  if (!nome) return { ok: false, erro: "Informe o nome do condomínio." };
  return {
    ok: true,
    valor: { ...c, nome, nomeRelatorio: c.nomeRelatorio?.trim() || nome },
  };
}
