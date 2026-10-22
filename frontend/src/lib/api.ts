/**
 * Ponto ÚNICO de acesso a dados do Sistema Krieger.
 * Em produção usa a API PHP (api.php / auth.php). No preview do Lovable e em
 * localhost usa automaticamente o adaptador mock (localStorage).
 */
import type { Backup, Store, UsuarioSalvar } from "@/domain/types";
import { novoId } from "./id";
import { ApiError, type ApiAdapter, type ConfirmarImportacaoPedido } from "./apiTypes";
import { realApi } from "./realApi";
import { mockApi } from "./mockApi";

export { ApiError } from "./apiTypes";
export type { ConfirmarImportacaoPedido, ConfirmarImportacaoResposta } from "./apiTypes";

export function usandoMock(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

function impl(): ApiAdapter {
  return usandoMock() ? mockApi : realApi;
}

// ---- Tratamento central de 401 ----
let aoNaoAutorizado: (() => void) | null = null;
export function definirAoNaoAutorizado(fn: () => void) {
  aoNaoAutorizado = fn;
}

async function guarda<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) aoNaoAutorizado?.();
    throw e;
  }
}

/** Mensagem legível de qualquer erro. */
export function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Ocorreu um erro inesperado.";
}

export const api = {
  listar: <T>(store: Store) => guarda(() => impl().listar<T>(store)),
  obter: <T>(store: Store, id: string) => guarda(() => impl().obter<T>(store, id)),
  salvar: <T extends { id?: string }>(store: Store, o: T) =>
    guarda(() => impl().salvar<T>(store, { ...o, id: o.id || novoId() })),
  excluir: (store: Store, id: string) => guarda(() => impl().excluir(store, id)),
  exportar: () => guarda(() => impl().exportar()),
  importar: (dados: Backup, substituir: boolean) => guarda(() => impl().importar(dados, substituir)),
  confirmarImportacao: (pedido: ConfirmarImportacaoPedido) => guarda(() => impl().confirmarImportacao(pedido)),
  backup: {
    criar: () => guarda(() => impl().backup.criar()),
    listar: () => guarda(() => impl().backup.listar()),
    baixar: (id: string) => guarda(() => impl().backup.baixar(id)),
    restaurar: (id: string, substituir: boolean) => guarda(() => impl().backup.restaurar(id, substituir)),
    excluir: (id: string) => guarda(() => impl().backup.excluir(id)),
  },
  auth: {
    eu: () => impl().auth.eu(),
    /** 401 aqui significa credenciais inválidas: não redireciona. */
    entrar: (login: string, senha: string) => impl().auth.entrar(login, senha),
    sair: () => impl().auth.sair(),
    /** Senha atual incorreta pode vir como 401/403: mostra a mensagem, sem redirecionar. */
    minhaSenha: (atual: string, nova: string) => impl().auth.minhaSenha(atual, nova),
    usuarios: () => guarda(() => impl().auth.usuarios()),
    usuarioSalvar: (u: UsuarioSalvar) => guarda(() => impl().auth.usuarioSalvar(u)),
    usuarioExcluir: (id: string) => guarda(() => impl().auth.usuarioExcluir(id)),
  },
};
