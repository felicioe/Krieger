import { novoId } from "../lib/id";
import { extrairCidadeDoEndereco } from "./notificacao";
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
    tipo: "",
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
  const tipo = typeof obj["tipo"] === "string" ? obj["tipo"] : "";
  const nome = typeof obj["nome"] === "string" ? obj["nome"] : "";
  const criadoEm = typeof obj["criadoEm"] === "string" && obj["criadoEm"] ? obj["criadoEm"] : agora;
  const atualizadoEm = typeof obj["atualizadoEm"] === "string" && obj["atualizadoEm"] ? obj["atualizadoEm"] : agora;
  return {
    id: typeof obj["id"] === "string" && obj["id"] ? obj["id"] : novoId(),
    nome,
    cidade,
    cartorio,
    tipo,
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
 * Cidade do condomínio para casar com o modelo de ata: sai do endereço do edital
 * (`enderecoEdital`), não da cidade de assinatura do escritório. Sem endereço reconhecível,
 * devolve "" — e aí só os modelos gerais respondem.
 */
export function cidadeDoCondominio(enderecoEdital: string): string {
  if (!enderecoEdital || !enderecoEdital.trim()) return "";
  return extrairCidadeDoEndereco(enderecoEdital, "");
}

/**
 * Os dois modelos de mesma cidade devem sair para o tipo certo: o modelo sem `tipo` serve aos
 * dois; um modelo de outro tipo é descartado. Tipo vazio na assembleia aceita qualquer modelo.
 */
function serveAoTipo(m: ModeloAta, tipo: string): boolean {
  const t = m.tipo?.trim().toLowerCase() ?? "";
  if (!t) return true;
  const alvo = tipo.trim().toLowerCase();
  if (!alvo) return true;
  return t === alvo;
}

/**
 * Escolhe o modelo mais específico disponível para a cidade/cartório/tipo informados.
 * Prioridade: cidade+cartório+mesmo tipo > cidade+mesmo tipo > cidade+cartório > cidade >
 * geral+mesmo tipo > geral. Um modelo com `tipo` de assembleia diferente é ignorado.
 * Retorna `null` quando não há nenhum modelo ativo.
 */
export function escolherModeloAta(
  modelos: ModeloAta[],
  cidade: string,
  cartorio: string,
  tipo = "",
): ModeloAta | null {
  const ativos = modelos.filter((m) => m.ativo && serveAoTipo(m, tipo));
  if (ativos.length === 0) return null;
  const c = cidade.trim().toLowerCase();
  const ct = cartorio.trim().toLowerCase();
  const daCidade = (m: ModeloAta) => Boolean(c) && m.cidade?.trim().toLowerCase() === c;
  const doCartorio = (m: ModeloAta) => Boolean(ct) && m.cartorio?.trim().toLowerCase() === ct;
  const semCartorio = (m: ModeloAta) => !m.cartorio?.trim();
  const comTipo = (m: ModeloAta) => Boolean(m.tipo?.trim());

  // 1. cidade + cartório, e o tipo declarado (mais específico que um modelo só da cidade).
  if (ct) {
    const exatoComTipo = ativos.find((m) => daCidade(m) && doCartorio(m) && comTipo(m));
    if (exatoComTipo) return exatoComTipo;
  }
  // 2. cidade, sem cartório, com tipo — o caso dos dois modelos Lago Negro (ordinária/extraordinária).
  if (c) {
    const cidadeComTipo = ativos.find((m) => daCidade(m) && semCartorio(m) && comTipo(m));
    if (cidadeComTipo) return cidadeComTipo;
  }
  // 3. cidade + cartório, sem tipo declarado.
  if (ct) {
    const exato = ativos.find((m) => daCidade(m) && doCartorio(m));
    if (exato) return exato;
  }
  // 4. cidade, sem cartório.
  if (c) {
    const porCidade = ativos.find((m) => daCidade(m) && semCartorio(m));
    if (porCidade) return porCidade;
  }
  // 5. geral (sem cidade e sem cartório), preferindo o que declara o tipo.
  const gerais = ativos.filter((m) => !m.cidade?.trim() && !m.cartorio?.trim());
  return gerais.find(comTipo) ?? gerais[0] ?? ativos[0] ?? null;
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