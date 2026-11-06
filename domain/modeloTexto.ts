import { formatData } from "../lib/format";
import { rotuloEntrega, rotuloModalidade, rotuloTipo } from "./edital";
import type { Assembleia, Condominio, Modelo } from "./types";

/**
 * Condição de exibição (`bloco.cond`) e variáveis de texto (`{{campo.caminho}}`) dos blocos do
 * modelo de edital. Convenção nova, ainda não confirmada pelo escritório — fácil de ajustar aqui
 * sem mexer no resto do sistema.
 *
 * `cond` (vazia = sempre mostra), condições simples combinadas com "e" / "ou" ("ou" tem
 * precedência menor: "a e b ou c" é "(a e b) ou c"; sem parênteses, por enquanto):
 *   campo                -> verdadeiro quando o campo é "truthy" (string não vazia, número != 0,
 *                           array não vazio, true)
 *   !campo               -> negação do acima
 *   campo == valor        -> compara o campo (valor bruto, não formatado) com o texto à direita
 *   campo != valor        -> negação da comparação acima
 *   cond1 e cond2         -> "e" lógico entre duas condições simples
 *   cond1 ou cond2        -> "ou" lógico entre duas condições simples
 * `campo` é um caminho tipo "condominio.nome" ou "assembleia.modalidade", resolvido no contexto
 * `{ condominio, assembleia }`. Limitação conhecida: um valor de comparação que contenha a palavra
 * solta "e" ou "ou" cercada de espaços não funciona corretamente (ex.: "Síndico e Conselho").
 *
 * `{{campo.caminho}}` no texto do bloco é substituído pelo valor formatado pra leitura (data em
 * dd/mm/aaaa, tipo/modalidade/entregaContas pelo rótulo em vez do código interno) — diferente da
 * comparação em `cond`, que usa o valor bruto.
 */

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

// Valor bruto (sem formatação) usado nas comparações de `cond` — estável e previsível.
function paraComparacao(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor);
}

// Rótulos por nome de campo (o último segmento do caminho), pra exibição em {{...}}.
const ROTULOS_POR_CAMPO: Record<string, (v: string) => string> = {
  tipo: rotuloTipo,
  modalidade: rotuloModalidade,
  entregaContas: rotuloEntrega,
};
// Campos de data em ISO (aaaa-mm-dd); os demais campos de data do sistema já ficam em dd/mm/aaaa.
const CAMPOS_DATA_ISO = new Set(["data"]);

// Valor formatado pra leitura humana, usado na substituição de `{{campo.caminho}}`.
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

/** Substitui cada `{{campo.caminho}}` pelo valor formatado pra leitura (ausente vira texto vazio). */
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

/** Avalia `bloco.cond` no contexto; condição vazia sempre mostra o bloco. */
export function avaliarCondicao(cond: string, contexto: ContextoBloco): boolean {
  const c = cond.trim();
  if (!c) return true;

  const porOu = c.split(/\s+ou\s+/i).map((p) => p.trim()).filter(Boolean);
  if (porOu.length > 1) return porOu.some((p) => avaliarCondicao(p, contexto));

  const porE = c.split(/\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  if (porE.length > 1) return porE.every((p) => avaliarCondicao(p, contexto));

  return avaliarCondicaoSimples(c, contexto);
}

/** Blocos do modelo cuja condição é verdadeira no contexto, na ordem original. */
export function blocosVisiveis(modelo: Pick<Modelo, "blocos">, contexto: ContextoBloco): Modelo["blocos"] {
  return modelo.blocos.filter((b) => avaliarCondicao(b.cond, contexto));
}

/** Texto final de um bloco (visível ou não — quem chama decide com `avaliarCondicao`/`blocosVisiveis`). */
export function montarTextoBloco(bloco: Pick<Modelo["blocos"][number], "texto">, contexto: ContextoBloco): string {
  return substituirVariaveis(bloco.texto, contexto);
}

/** Monta os blocos visíveis já com as variáveis substituídas, pronto pra desenhar o documento. */
export function montarBlocos(modelo: Pick<Modelo, "blocos">, contexto: ContextoBloco): { id: string; tipo: Modelo["blocos"][number]["tipo"]; texto: string }[] {
  return blocosVisiveis(modelo, contexto).map((b) => ({ id: b.id, tipo: b.tipo, texto: montarTextoBloco(b, contexto) }));
}
