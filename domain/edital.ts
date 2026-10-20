import { dataParaBR, parseData } from "../lib/format";
import type { Assembleia, Condominio, Modelo } from "./types";

/**
 * Cadastro de editais de convocação (store "assembleias").
 * Só cadastro: a geração do PDF/Word, a lista de presença e a procuração ficam para depois.
 */

export const TIPOS_ASSEMBLEIA: { valor: Assembleia["tipo"]; rotulo: string }[] = [
  { valor: "ordinaria", rotulo: "Ordinária" },
  { valor: "extraordinaria", rotulo: "Extraordinária" },
];

export const MODALIDADES: { valor: Assembleia["modalidade"]; rotulo: string }[] = [
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "online", rotulo: "On-line" },
  { valor: "hibrida", rotulo: "Híbrida" },
];

export const ENTREGAS_CONTAS: { valor: Assembleia["entregaContas"]; rotulo: string }[] = [
  { valor: "email", rotulo: "Por e-mail" },
  { valor: "administracao", rotulo: "Na administração" },
  { valor: "aplicativo", rotulo: "Pelo aplicativo" },
];

const rotulo = <V extends string>(lista: { valor: V; rotulo: string }[], v: string) =>
  lista.find((o) => o.valor === v)?.rotulo ?? v;
export const rotuloTipo = (v: string) => rotulo(TIPOS_ASSEMBLEIA, v);
export const rotuloModalidade = (v: string) => rotulo(MODALIDADES, v);

/** Quais campos a modalidade usa: local físico (presencial/híbrida) e Zoom (on-line/híbrida). */
export function camposDaModalidade(m: Assembleia["modalidade"]): { local: boolean; zoom: boolean } {
  return { local: m !== "online", zoom: m !== "presencial" };
}

/** "hh:mm" de 00:00 a 23:59. */
export function horaValida(h: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h.trim());
}

/** Responsável que assina por padrão: quem tem cargo de síndico(a); senão, o primeiro da administração. */
function assinantePadrao(c: Condominio): { nome: string; cargo: string } {
  const a = c.administracao.find((x) => /^s[íi]ndic/i.test(x.cargo.trim())) ?? c.administracao[0];
  return { nome: a?.nome ?? "", cargo: a?.cargo ?? "" };
}

/**
 * Edital novo, pré-preenchido com o cadastro (tudo editável depois):
 * local = endereço do edital; quórum do condomínio; pauta = pauta padrão do modelo;
 * assinante = síndico(a); cidade do escritório; emissão = hoje; linhas da lista = unidades.
 */
export function assembleiaPadrao(opcoes: {
  condo: Condominio;
  tipo: Assembleia["tipo"];
  /** aaaa-mm-dd */
  data: string;
  modelo?: Modelo | null;
  cidade?: string;
  /** ano da última prestação de contas do condomínio, se houver */
  exercicio?: string;
  hoje?: Date;
}): Omit<Assembleia, "id"> {
  const { condo, tipo, data, modelo, cidade = "", exercicio = "", hoje = new Date() } = opcoes;
  const ass = assinantePadrao(condo);
  return {
    condoId: condo.id,
    modeloId: modelo?.id ?? "",
    tipo,
    modalidade: "presencial",
    data,
    hora1: "",
    hora2: "",
    quorum: condo.quorum,
    local: condo.enderecoEdital,
    zoomLink: "",
    zoomId: "",
    zoomSenha: "",
    pauta: [...(modelo?.pautaOrdinaria ?? [])],
    exercicio,
    entregaContas: "email",
    dataEmissao: dataParaBR(hoje),
    cidade,
    assinante: ass.nome,
    cargo: ass.cargo,
    timbrado: true,
    linhasLista: condo.unidades,
  };
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const umDe = <V extends string>(v: unknown, opcoes: { valor: V }[], padrao: V): V =>
  opcoes.some((o) => o.valor === v) ? (v as V) : padrao;

/** Completa campos ausentes de um edital vindo da API ou de backups antigos. */
export function normalizarAssembleia(raw: Partial<Assembleia> & { id: string }): Assembleia {
  return {
    id: raw.id,
    condoId: s(raw.condoId),
    modeloId: s(raw.modeloId),
    tipo: umDe(raw.tipo, TIPOS_ASSEMBLEIA, "ordinaria"),
    modalidade: umDe(raw.modalidade, MODALIDADES, "presencial"),
    data: s(raw.data),
    hora1: s(raw.hora1),
    hora2: s(raw.hora2),
    quorum: s(raw.quorum),
    local: s(raw.local),
    zoomLink: s(raw.zoomLink),
    zoomId: s(raw.zoomId),
    zoomSenha: s(raw.zoomSenha),
    pauta: Array.isArray(raw.pauta) ? raw.pauta.map(s) : [],
    exercicio: s(raw.exercicio),
    entregaContas: umDe(raw.entregaContas, ENTREGAS_CONTAS, "email"),
    dataEmissao: s(raw.dataEmissao),
    cidade: s(raw.cidade),
    assinante: s(raw.assinante),
    cargo: s(raw.cargo),
    timbrado: raw.timbrado ?? true,
    linhasLista: typeof raw.linhasLista === "number" ? raw.linhasLista : null,
  };
}

/**
 * Antes de salvar: remove itens de pauta vazios e limpa os campos que a modalidade não usa
 * (local quando on-line; Zoom quando presencial), para não irem parar no edital.
 */
export function prepararAssembleia<T extends Omit<Assembleia, "id">>(a: T): T {
  const campos = camposDaModalidade(a.modalidade);
  return {
    ...a,
    pauta: a.pauta.map((p) => p.trim()).filter(Boolean),
    local: campos.local ? a.local.trim() : "",
    zoomLink: campos.zoom ? a.zoomLink.trim() : "",
    zoomId: campos.zoom ? a.zoomId.trim() : "",
    zoomSenha: campos.zoom ? a.zoomSenha.trim() : "",
  };
}

export type ErrosAssembleia = Partial<Record<"condoId" | "data" | "hora1" | "hora2" | "dataEmissao", string>>;

/** Campos obrigatórios: condomínio, data e horário da 1ª convocação. */
export function validarAssembleia(a: Pick<Assembleia, "condoId" | "data" | "hora1" | "hora2" | "dataEmissao">): ErrosAssembleia {
  const erros: ErrosAssembleia = {};
  if (!a.condoId) erros.condoId = "Escolha o condomínio.";
  if (!a.data) erros.data = "Informe a data da assembleia.";
  else if (!parseData(a.data)) erros.data = "Data inválida.";
  if (!a.hora1.trim()) erros.hora1 = "Informe o horário da 1ª convocação.";
  else if (!horaValida(a.hora1)) erros.hora1 = "Horário inválido (hh:mm).";
  if (a.hora2.trim() && !horaValida(a.hora2)) erros.hora2 = "Horário inválido (hh:mm).";
  if (a.dataEmissao.trim() && !parseData(a.dataEmissao)) erros.dataEmissao = "Data inválida.";
  return erros;
}
