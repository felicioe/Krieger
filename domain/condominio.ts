import type { Condominio, DocumentoObrigatorio } from "./types";

/** Itens padrão do checklist "Documentos obrigatórios" de um condomínio novo. */
export function documentosObrigatoriosPadrao(): DocumentoObrigatorio[] {
  const observacoes: Record<string, string> = {
    // Nome genérico pra caber em qualquer condomínio; a observação guarda a origem (exigência
    // municipal de Balneário Camboriú), que não cabe mais no nome.
    "Alvará Estrutural": "Exigência municipal (Balneário Camboriú) — ajuste o nome/observação se o condomínio for de outra cidade.",
  };
  return [
    "Extintor",
    "Seguro",
    "Limpeza de Caixa D'Água",
    "Dedetização",
    "Alvará de Bombeiros",
    "Alvará Estrutural",
    "Elevador",
  ].map((nome) => ({ nome, status: "pendente", informacao: "", observacao: observacoes[nome] ?? "", noRelatorio: true }));
}

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
    energiaRubrica: "energia el[ée]trica",
    elevadorRubrica: "manuten[çc][ãa]o.*elevador",
    elevadorFornecedor: "",
    documentosObrigatorios: documentosObrigatoriosPadrao(),
    arredondamento: "truncar",
    variacaoPadrao: null,
    conhecidas: [],
    somenteAnual: true,
    regras: [],
    variacaoMetodo: "manual",
    variacaoParam: null,
    pastaDocumentos: "",
    areaTotalM2: null,
    alertaCadastro: null,
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
    documentosObrigatorios: raw.documentosObrigatorios ?? p.documentosObrigatorios,
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
