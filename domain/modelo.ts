import { novoId } from "../lib/id";
import { extrairCidadeDoEndereco } from "./notificacao";
import type { Modelo, TipoBloco } from "./types";

/**
 * Cadastro de modelos de edital.
 * `cond` (condição de exibição) e `historico` são guardados como estão — ainda sem lógica.
 */

export type Bloco = Modelo["blocos"][number];

export const TIPOS_BLOCO: { valor: TipoBloco; rotulo: string }[] = [
  { valor: "titulo", rotulo: "Título" },
  { valor: "subtitulo", rotulo: "Subtítulo" },
  { valor: "texto", rotulo: "Texto" },
  { valor: "item", rotulo: "Item" },
  { valor: "esquerda", rotulo: "Texto à esquerda" },
  { valor: "pauta", rotulo: "Pauta" },
];

export const rotuloBloco = (t: string) => TIPOS_BLOCO.find((o) => o.valor === t)?.rotulo ?? t;

export function novoBloco(tipo: TipoBloco = "texto"): Bloco {
  return { id: novoId(), tipo, texto: "", cond: "" };
}

/**
 * Modelo novo: em branco ou cópia dos blocos e da pauta de outro modelo (com novos ids de bloco).
 * `condoId` vazio = modelo genérico, oferecido a qualquer condomínio que não tenha o seu.
 */
export function modeloPadrao(nome: string, base?: Modelo | null, condoId = ""): Omit<Modelo, "id"> {
  return {
    condoId: condoId.trim(),
    nome: nome.trim(),
    versao: 1,
    pautaOrdinaria: [...(base?.pautaOrdinaria ?? [])],
    blocos: (base?.blocos ?? []).map((b) => ({ ...b, id: novoId() })),
  };
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function normalizarModelo(raw: Partial<Modelo> & { id: string }): Modelo {
  const m: Modelo = {
    id: raw.id,
    condoId: s(raw.condoId),
    nome: s(raw.nome),
    cidade: s(raw.cidade).trim(),
    tipo: s(raw.tipo).trim().toLowerCase(),
    versao: typeof raw.versao === "number" || typeof raw.versao === "string" ? raw.versao : 1,
    pautaOrdinaria: Array.isArray(raw.pautaOrdinaria) ? raw.pautaOrdinaria.map(s) : [],
    blocos: Array.isArray(raw.blocos)
      ? raw.blocos.map((b) => ({
          id: s(b?.id) || novoId(),
          tipo: TIPOS_BLOCO.some((t) => t.valor === b?.tipo) ? b.tipo : "texto",
          texto: s(b?.texto),
          cond: s(b?.cond),
        }))
      : [],
  };
  if (raw.historico !== undefined) m.historico = raw.historico;
  return m;
}

/** Antes de salvar: apara o nome, remove itens de pauta vazios e blocos sem texto (exceto o bloco "Pauta"). */
export function prepararModelo<T extends Omit<Modelo, "id">>(m: T): T {
  return {
    ...m,
    condoId: m.condoId.trim(),
    nome: m.nome.trim(),
    pautaOrdinaria: m.pautaOrdinaria.map((p) => p.trim()).filter(Boolean),
    blocos: m.blocos
      .map((b) => ({ ...b, cond: b.cond.trim() }))
      .filter((b) => b.tipo === "pauta" || b.texto.trim() !== ""),
  };
}

export function validarModelo(m: Pick<Modelo, "nome">): string | null {
  return m.nome.trim() ? null : "Informe o nome do modelo.";
}

/**
 * Modelos que podem ser usados num condomínio: os dele e os genéricos (sem `condoId`).
 * Sem condomínio escolhido, só os genéricos — evita oferecer o modelo de um condomínio
 * para um edital de outro.
 */
export function modelosDoCondominio<T extends Pick<Modelo, "condoId">>(modelos: T[], condoId: string): T[] {
  const alvo = condoId.trim();
  if (!alvo) return modelos.filter((m) => !m.condoId.trim());
  return modelos.filter((m) => !m.condoId.trim() || m.condoId.trim() === alvo);
}

/**
 * Cidade do condomínio para casar com o modelo de edital: sai do endereço do edital.
 * `extrairCidadeDoEndereco` devolve preposição e "Cidade de" junto ("Em Camboriú",
 * "Na Cidade de Itajaí"), então eles saem aqui.
 */
export function cidadeDoModeloEdital(enderecoEdital: string): string {
  return extrairCidadeDoEndereco(enderecoEdital || "", "")
    .replace(/^(?:em|na|no)\s+/i, "")
    .replace(/^(?:cidade|munic[ií]pio)\s+(?:de\s+)?/i, "")
    .replace(/^de\s+/i, "")
    .trim();
}

/** Compara cidade sem acento, caixa e pontuação: "Balneário Camboriú" = "balneario camboriu". */
function chaveCidade(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mesma cidade: chave normalizada igual. Cidades compostas ("Balneário Camboriú") não casam com partes ("Camboriú"). */
function mesmaCidade(a: string, b: string): boolean {
  const ka = chaveCidade(a);
  const kb = chaveCidade(b);
  if (!ka || !kb) return false;
  return ka === kb;
}

/** O modelo serve ao tipo de assembleia: sem tipo declarado serve aos dois. */
function serveAoTipoModelo(m: Pick<Modelo, "tipo">, tipo: string): boolean {
  const t = (m.tipo ?? "").trim().toLowerCase();
  const alvo = tipo.trim().toLowerCase();
  return !t || !alvo || t === alvo;
}

/**
 * Modelos oferecidos no diálogo de novo edital para o condomínio escolhido.
 * Filtra por tipo de assembleia (quando houver) e, entre os que servem, os da
 * cidade do endereço do condomínio vêm primeiro — é o padrão por cidade da issue.
 */
export function modelosDoEdital<T extends Pick<Modelo, "condoId" | "cidade" | "tipo">>(
  modelos: T[],
  condoId: string,
  cidade = "",
  tipo = "",
): T[] {
  const doCondo = modelosDoCondominio(modelos, condoId).filter((m) => serveAoTipoModelo(m, tipo));
  if (!cidade.trim()) return doCondo;
  return [
    ...doCondo.filter((m) => mesmaCidade(m.cidade ?? "", cidade)),
    ...doCondo.filter((m) => !mesmaCidade(m.cidade ?? "", cidade)),
  ];
}

/** Escolhe o melhor modelo do conjunto: o da cidade, senão o primeiro que serve o tipo. */
export function escolherModeloEdital<T extends Pick<Modelo, "cidade" | "tipo">>(modelos: T[], cidade = "", tipo = ""): T | null {
  const servem = modelos.filter((m) => serveAoTipoModelo(m, tipo));
  if (!cidade.trim()) return servem[0] ?? modelos[0] ?? null;
  return servem.find((m) => mesmaCidade(m.cidade ?? "", cidade)) ?? servem[0] ?? modelos[0] ?? null;
}
