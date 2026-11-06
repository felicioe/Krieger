import { parseData } from "../lib/format";
import { assinantePadrao, horaValida, MODALIDADES, TIPOS_ASSEMBLEIA } from "./edital";
import type { Assembleia, Ata, Condominio } from "./types";

/**
 * Cadastro de atas de assembleia (store "atas").
 * Só cadastro: a geração do PDF/Word com papel timbrado fica para depois.
 */

export type Presente = Ata["presentes"][number];
export type ItemAta = Ata["itens"][number];

export const STATUS_ATA: { valor: Ata["status"]; rotulo: string }[] = [
  { valor: "rascunho", rotulo: "Rascunho" },
  { valor: "finalizada", rotulo: "Finalizada" },
];
export const rotuloStatus = (s: string) => STATUS_ATA.find((o) => o.valor === s)?.rotulo ?? s;

export const novoItemAta = (titulo = ""): ItemAta => ({
  titulo,
  discussao: "",
  deliberacao: "",
  votos: { favor: 0, contra: 0, abstencao: 0 },
});

/**
 * Ata nova a partir do edital: data, horário (1ª convocação), tipo, modalidade e local do edital;
 * cada linha da pauta vira um item (título = texto da pauta); total de unidades do condomínio;
 * presidente da mesa pré-preenchido com o síndico(a) do cadastro (mesma regra de
 * `assinantePadrao`/edital.ts — editável depois, nem sempre é a mesma pessoa). Secretário,
 * presentes, discussões, deliberações, votos, encerramento e observações ficam em branco.
 */
export function novaAtaDeAssembleia(assembleia: Assembleia, condominio: Condominio): Omit<Ata, "id"> {
  return {
    condoId: condominio.id,
    assembleiaId: assembleia.id,
    tipo: assembleia.tipo,
    data: assembleia.data,
    hora: assembleia.hora1,
    modalidade: assembleia.modalidade,
    local: assembleia.local,
    mesa: { presidente: assinantePadrao(condominio).nome, secretario: "" },
    presentes: [],
    quorum: { unidadesPresentes: 0, totalUnidades: condominio.unidades ?? 0 },
    itens: assembleia.pauta.map((p) => p.trim()).filter(Boolean).map((p) => novoItemAta(p)),
    encerramento: "",
    observacoes: "",
    status: "rascunho",
  };
}

/** Ata sem edital vinculado: só o condomínio (e o total de unidades dele, e o presidente padrão). */
export function ataEmBranco(condominio: Condominio): Omit<Ata, "id"> {
  return {
    condoId: condominio.id,
    assembleiaId: "",
    tipo: "ordinaria",
    data: "",
    hora: "",
    modalidade: "presencial",
    local: "",
    mesa: { presidente: assinantePadrao(condominio).nome, secretario: "" },
    presentes: [],
    quorum: { unidadesPresentes: 0, totalUnidades: condominio.unidades ?? 0 },
    itens: [],
    encerramento: "",
    observacoes: "",
    status: "rascunho",
  };
}

export function percentualQuorum(q: Ata["quorum"]): number | null {
  if (!q.totalUnidades) return null;
  return (q.unidadesPresentes / q.totalUnidades) * 100;
}

/** Unidades diferentes informadas na lista de presentes (ignora maiúsculas e espaços). */
export function contarUnidadesPresentes(presentes: Presente[]): number {
  return new Set(presentes.map((p) => p.unidade.trim().toLowerCase()).filter(Boolean)).size;
}

/** Ata já existente para o edital, se houver. */
export function ataDoEdital(assembleiaId: string, atas: Pick<Ata, "id" | "assembleiaId">[]) {
  return assembleiaId ? (atas.find((a) => a.assembleiaId === assembleiaId) ?? null) : null;
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function normalizarAta(raw: Partial<Ata> & { id: string }): Ata {
  return {
    id: raw.id,
    condoId: s(raw.condoId),
    assembleiaId: s(raw.assembleiaId),
    tipo: s(raw.tipo) || "ordinaria",
    data: s(raw.data),
    hora: s(raw.hora),
    modalidade: s(raw.modalidade) || "presencial",
    local: s(raw.local),
    mesa: { presidente: s(raw.mesa?.presidente), secretario: s(raw.mesa?.secretario) },
    presentes: Array.isArray(raw.presentes)
      ? raw.presentes.map((p) => ({ unidade: s(p?.unidade), nome: s(p?.nome), procurador: !!p?.procurador }))
      : [],
    quorum: { unidadesPresentes: n(raw.quorum?.unidadesPresentes), totalUnidades: n(raw.quorum?.totalUnidades) },
    itens: Array.isArray(raw.itens)
      ? raw.itens.map((i) => ({
          titulo: s(i?.titulo),
          discussao: s(i?.discussao),
          deliberacao: s(i?.deliberacao),
          votos: { favor: n(i?.votos?.favor), contra: n(i?.votos?.contra), abstencao: n(i?.votos?.abstencao) },
        }))
      : [],
    encerramento: s(raw.encerramento),
    observacoes: s(raw.observacoes),
    status: raw.status === "finalizada" ? "finalizada" : "rascunho",
  };
}

/** Antes de salvar: descarta linhas de presentes vazias e itens totalmente em branco. */
export function prepararAta<T extends Omit<Ata, "id">>(a: T): T {
  return {
    ...a,
    presentes: a.presentes
      .map((p) => ({ ...p, unidade: p.unidade.trim(), nome: p.nome.trim() }))
      .filter((p) => p.unidade || p.nome),
    itens: a.itens.filter(
      (i) =>
        i.titulo.trim() ||
        i.discussao.trim() ||
        i.deliberacao.trim() ||
        i.votos.favor ||
        i.votos.contra ||
        i.votos.abstencao,
    ),
  };
}

export type ErrosAta = Partial<Record<"condoId" | "data" | "hora", string>>;

/** Campos exigidos para salvar: condomínio e data válida; horário, se informado, em hh:mm. */
export function validarAta(a: Pick<Ata, "condoId" | "data" | "hora">): ErrosAta {
  const erros: ErrosAta = {};
  if (!a.condoId) erros.condoId = "Escolha o condomínio.";
  if (!a.data) erros.data = "Informe a data da assembleia.";
  else if (!parseData(a.data)) erros.data = "Data inválida.";
  if (a.hora.trim() && !horaValida(a.hora)) erros.hora = "Horário inválido (hh:mm).";
  return erros;
}

/** Um edital tem no máximo uma ata. */
export function validarNovaAta(assembleiaId: string, atas: Pick<Ata, "id" | "assembleiaId">[]): string | null {
  return ataDoEdital(assembleiaId, atas) ? "Este edital já tem uma ata." : null;
}

export const OPCOES_TIPO = TIPOS_ASSEMBLEIA;
export const OPCOES_MODALIDADE = MODALIDADES;
