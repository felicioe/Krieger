import { formatData } from "../lib/format";
import { rotuloEntrega, rotuloModalidade, rotuloTipo } from "./edital";
import type { Assembleia, Condominio, Modelo } from "./types";

export interface ContextoBloco {
  condominio: Condominio;
  assembleia: Assembleia;
}

function resolverCaminho(contexto: ContextoBloco, caminho: string): unknown {
  let valor: unknown = contexto;
  for (const parte of caminho.split(".")) {
    if (valor == null || typeof valor !== "object") return undefined;
    valor = (valor as Record<string, unknown>)[parte];
  }
  return valor;
}

function ultimoSegmento(caminho: string): string {
  const partes = caminho.split(".");
  return partes[partes.length - 1] ?? caminho;
}

function paraComparacao(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor);
}

const ROTULOS_POR_CAMPO: Record<string, (v: string) => string> = {
  tipo: rotuloTipo,
  modalidade: rotuloModalidade,
  entregaContas: rotuloEntrega,
};
const CAMPOS_DATA_ISO = new Set(["data"]);

function paraExibicao(valor: unknown, campo: string): string {
  if (valor == null) return "";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.join(", ");
  if (typeof valor === "string") {
    if (CAMPOS_DATA_ISO.has(campo)) return formatData(valor);
    const rotular = ROTULOS_POR_CAMPO[campo];
    if (rotular) return rotular(valor);
  }
  return String(valor);
}

export function substituirVariaveis(texto: string, contexto: ContextoBloco): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, caminho: string) =>
    paraExibicao(resolverCaminho(contexto, caminho), ultimoSegmento(caminho)),
  );
}

function avaliarCondicaoSimples(c: string, contexto: ContextoBloco): boolean {
  const comparacao = c.match(/^([\w.]+)\s*(==|!=)\s*(.+)$/);
  if (comparacao) {
    const caminho = comparacao[1]!;
    const operador = comparacao[2]!;
    const valorEsperado = comparacao[3]!.trim().replace(/^["']|["']$/g, "");
    const igual = paraComparacao(resolverCaminho(contexto, caminho)) === valorEsperado;
    return operador === "==" ? igual : !igual;
  }

  const negacao = c.startsWith("!");
  const caminho = negacao ? c.slice(1).trim() : c;
  const valor = resolverCaminho(contexto, caminho);
  const truthy = Array.isArray(valor) ? valor.length > 0 : Boolean(valor);
  return negacao ? !truthy : truthy;
}

export function avaliarCondicao(cond: string, contexto: ContextoBloco): boolean {
  const c = cond.trim();
  if (!c) return true;

  const porOu = c.split(/\s+ou\s+/i).map((p) => p.trim()).filter(Boolean);
  if (porOu.length > 1) return porOu.some((p) => avaliarCondicao(p, contexto));

  const porE = c.split(/\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  if (porE.length > 1) return porE.every((p) => avaliarCondicao(p, contexto));

  return avaliarCondicaoSimples(c, contexto);
}

export function blocosVisiveis(modelo: Pick<Modelo, "blocos">, contexto: ContextoBloco): Modelo["blocos"] {
  return modelo.blocos.filter((b) => avaliarCondicao(b.cond, contexto));
}

export function montarTextoBloco(bloco: Pick<Modelo["blocos"][number], "texto">, contexto: ContextoBloco): string {
  return substituirVariaveis(bloco.texto, contexto);
}

export function montarBlocos(modelo: Pick<Modelo, "blocos">, contexto: ContextoBloco): { id: string; tipo: Modelo["blocos"][number]["tipo"]; texto: string }[] {
  return blocosVisiveis(modelo, contexto).map((b) => ({ id: b.id, tipo: b.tipo, texto: montarTextoBloco(b, contexto) }));
}
