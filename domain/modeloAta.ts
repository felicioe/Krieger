import { novoId } from "../lib/id";
import type { ModeloAta } from "./types";

/**
 * Modelos de ata por cartório/cidade (issue #256).
 * Cada registro guarda um layout de texto corrido com variáveis {{ata.*}} / {{condominio.*}} /
 * {{escritorio.*}}, além de opções visuais (logo do escritório, borda de página).
 */

export function modeloAtaPadrao(nome: string): Omit<ModeloAta, "id"> {
  const agora = new Date().toISOString();
  return {
    nome: nome.trim(),
    cidade: "",
    cartorio: "",
    texto: "",
    logoEscritorio: true,
    bordaPagina: false,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export function novoModeloAta(nome: string): ModeloAta {
  return { id: novoId(), ...modeloAtaPadrao(nome) };
}

export function normalizarModeloAta(o: unknown): ModeloAta {
  const obj = (typeof o === "object" && o !== null ? o : {}) as Record<string, unknown>;
  const agora = new Date().toISOString();
  const texto = typeof obj["texto"] === "string" ? obj["texto"] : "";
  const cidade = typeof obj["cidade"] === "string" ? obj["cidade"] : "";
  const cartorio = typeof obj["cartorio"] === "string" ? obj["cartorio"] : "";
  const nome = typeof obj["nome"] === "string" ? obj["nome"] : "";
  const criadoEm = typeof obj["criadoEm"] === "string" && obj["criadoEm"] ? obj["criadoEm"] : agora;
  const atualizadoEm = typeof obj["atualizadoEm"] === "string" && obj["atualizadoEm"] ? obj["atualizadoEm"] : agora;
  return {
    id: typeof obj["id"] === "string" && obj["id"] ? obj["id"] : novoId(),
    nome,
    cidade,
    cartorio,
    texto,
    logoEscritorio: obj["logoEscritorio"] !== false,
    bordaPagina: obj["bordaPagina"] === true,
    ativo: obj["ativo"] !== false,
    criadoEm,
    atualizadoEm,
  };
}

export type ErrosModeloAta = { nome?: string; texto?: string };

export function validarModeloAta(m: Partial<ModeloAta>): ErrosModeloAta {
  const erros: ErrosModeloAta = {};
  if (!m.nome || !m.nome.trim()) erros.nome = "Nome é obrigatório.";
  if (!m.texto || !m.texto.trim()) erros.texto = "Texto da ata é obrigatório.";
  return erros;
}

/**
 * Escolhe o modelo mais específico disponível para a cidade/cartório informados.
 * Prioridade: cidade+cartório exato > só cidade > geral (sem cidade).
 * Retorna `null` quando não há nenhum modelo ativo.
 */
export function escolherModeloAta(
  modelos: ModeloAta[],
  cidade: string,
  cartorio: string,
): ModeloAta | null {
  const ativos = modelos.filter((m) => m.ativo);
  if (ativos.length === 0) return null;
  const c = cidade.trim();
  const ct = cartorio.trim();
  if (c && ct) {
    const exato = ativos.find(
      (m) => m.cidade?.trim().toLowerCase() === c.toLowerCase() && m.cartorio?.trim().toLowerCase() === ct.toLowerCase(),
    );
    if (exato) return exato;
  }
  if (c) {
    const porCidade = ativos.find(
      (m) => m.cidade?.trim().toLowerCase() === c.toLowerCase() && !m.cartorio?.trim(),
    );
    if (porCidade) return porCidade;
  }
  return ativos.find((m) => !m.cidade?.trim() && !m.cartorio?.trim()) ?? ativos[0] ?? null;
}

/** Substitui variáveis {{caminho}} no texto do modelo pelos valores do contexto. */
export function renderizarTextoModeloAta(texto: string, ctx: Record<string, unknown>): string {
  return texto.replace(/\{\{([^}]+)\}\}/g, (_, chave) => {
    const caminho = String(chave).trim();
    const valor = resolverCaminho(ctx, caminho);
    if (valor === undefined || valor === null) return "";
    if (typeof valor === "string") return valor;
    if (typeof valor === "number") return String(valor);
    if (Array.isArray(valor)) return valor.join(", ");
    return String(valor);
  });
}

function resolverCaminho(ctx: Record<string, unknown>, caminho: string): unknown {
  const partes = caminho.split(".");
  let atual: unknown = ctx;
  for (const p of partes) {
    if (atual === null || atual === undefined) return undefined;
    if (typeof atual !== "object") return undefined;
    atual = (atual as Record<string, unknown>)[p];
  }
  return atual;
}