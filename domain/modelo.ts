import { novoId } from "../lib/id";
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

/** Modelo novo: em branco ou cópia dos blocos e da pauta de outro modelo (com novos ids de bloco). */
export function modeloPadrao(nome: string, base?: Modelo | null): Omit<Modelo, "id"> {
  return {
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
    nome: s(raw.nome),
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
