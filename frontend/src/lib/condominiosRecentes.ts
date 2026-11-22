/**
 * Condomínios recentes de cada usuário (issue #295).
 *
 * A lista fica no navegador, separada por usuário, e guarda os últimos condomínios escolhidos em
 * qualquer seletor do sistema. Ela só muda a ordem dos resultados: quem não tem histórico continua
 * vendo a lista alfabética, e a pesquisa por nome, código ou CNPJ não muda.
 *
 * O estado fica em memória e é espelhado no localStorage, para que todos os seletores abertos na
 * tela vejam a mesma lista sem precisar recarregar a página.
 */

export const LIMITE_RECENTES = 5;

const prefixoChave = "krieger.condominios.recentes.";

/** Usuário da sessão atual, definido pela rota autenticada ao carregar a sessão. */
let usuarioAtual: string | undefined;

const cache = new Map<string, string[]>();
const ouvintes = new Set<() => void>();

function chave(userId: string): string {
  return `${prefixoChave}${userId}`;
}

function carregar(userId: string): string[] {
  const existente = cache.get(userId);
  if (existente) return existente;
  let lista: string[] = [];
  try {
    const bruto = localStorage.getItem(chave(userId));
    const lido: unknown = bruto ? JSON.parse(bruto) : [];
    if (Array.isArray(lido))
      lista = lido.filter((v): v is string => typeof v === "string").slice(0, LIMITE_RECENTES);
  } catch {
    lista = [];
  }
  cache.set(userId, lista);
  return lista;
}

function gravar(userId: string, lista: string[]): void {
  cache.set(userId, lista);
  try {
    localStorage.setItem(chave(userId), JSON.stringify(lista));
  } catch {
    // Ambiente sem armazenamento (navegação privada, bloqueio): a lista segue válida nesta sessão.
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Assina mudanças na lista de recentes (usado por `useSyncExternalStore`). */
export function assinarRecentes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Lista de recentes do usuário, do mais recente para o mais antigo. */
export function lerRecentes(userId: string | undefined): string[] {
  return userId ? carregar(userId) : [];
}

/** Coloca o condomínio no topo da lista do usuário, sem duplicar, e mantém o limite. */
export function registrarRecente(userId: string | undefined, condoId: string): void {
  if (!userId || !condoId) return;
  const atual = carregar(userId).filter((id) => id !== condoId);
  gravar(userId, [condoId, ...atual].slice(0, LIMITE_RECENTES));
}

export function removerRecente(userId: string | undefined, condoId: string): void {
  if (!userId) return;
  gravar(
    userId,
    carregar(userId).filter((id) => id !== condoId),
  );
}

export function limparRecentes(userId: string | undefined): void {
  if (!userId) return;
  gravar(userId, []);
}

/** Informa o usuário da sessão atual; chamado pela rota autenticada. */
export function definirUsuarioRecentes(userId: string | undefined): void {
  usuarioAtual = userId;
}

/** Grava a escolha de um condomínio para o usuário da sessão atual. */
export function registrarCondominioEscolhido(condoId: string): void {
  registrarRecente(usuarioAtual, condoId);
}
