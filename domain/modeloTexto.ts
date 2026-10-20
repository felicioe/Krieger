import type { Assembleia, Condominio, Modelo } from "./types";

/**
 * Condição de exibição (`bloco.cond`) e variáveis de texto (`{{campo.caminho}}`) dos blocos do
 * modelo de edital. Convenção nova, ainda não confirmada pelo escritório — fácil de ajustar aqui
 * sem mexer no resto do sistema.
 *
 * `cond` (vazia = sempre mostra):
 *   campo                -> verdadeiro quando o campo é "truthy" (string não vazia, número != 0,
 *                           array não vazio, true)
 *   !campo               -> negação do acima
 *   campo == "valor"      -> compara o campo (convertido pra texto) com o valor à direita
 *   campo != "valor"      -> negação da comparação acima
 * `campo` é um caminho tipo "condominio.nome" ou "assembleia.modalidade", resolvido no contexto
 * `{ condominio, assembleia }`.
 *
 * `{{campo.caminho}}` no texto do bloco é substituído pelo valor (vazio quando o campo não existe).
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

function formatarValor(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor);
}

/** Substitui cada `{{campo.caminho}}` pelo valor resolvido no contexto (ausente vira texto vazio). */
export function substituirVariaveis(texto: string, contexto: ContextoBloco): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, caminho: string) => formatarValor(resolverCaminho(contexto, caminho)));
}

/** Avalia `bloco.cond` no contexto; condição vazia sempre mostra o bloco. */
export function avaliarCondicao(cond: string, contexto: ContextoBloco): boolean {
  const c = cond.trim();
  if (!c) return true;

  const comparacao = c.match(/^([\w.]+)\s*(==|!=)\s*(.+)$/);
  if (comparacao) {
    const caminho = comparacao[1]!;
    const operador = comparacao[2]!;
    const valorEsperado = comparacao[3]!.trim().replace(/^["']|["']$/g, "");
    const igual = formatarValor(resolverCaminho(contexto, caminho)) === valorEsperado;
    return operador === "==" ? igual : !igual;
  }

  const negacao = c.startsWith("!");
  const caminho = negacao ? c.slice(1).trim() : c;
  const valor = resolverCaminho(contexto, caminho);
  const truthy = Array.isArray(valor) ? valor.length > 0 : Boolean(valor);
  return negacao ? !truthy : truthy;
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
