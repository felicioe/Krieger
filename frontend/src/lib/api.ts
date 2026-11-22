/**
 * Ponto ÚNICO de acesso a dados do Sistema Krieger.
 * Em produção usa a API PHP (api.php / auth.php). No preview do Lovable e em
 * localhost usa automaticamente o adaptador mock (localStorage).
 */
import type {
  Backup,
  DocumentoDriveRegistro,
  Perfil,
  Store,
  TipoDocumentoConsulta,
  UsuarioSalvar,
} from "@/domain/types";
import { novoId } from "./id";
import {
  ApiError,
  type AlvoLimpeza,
  type ApiAdapter,
  type ConfirmarImportacaoPedido,
} from "./apiTypes";
import { realApi } from "./realApi";

export { ApiError } from "./apiTypes";
export type {
  AlvoLimpeza,
  ConfirmarImportacaoPedido,
  ConfirmarImportacaoResposta,
  ContagensLimpeza,
} from "./apiTypes";

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

async function impl(): Promise<ApiAdapter> {
  if (!usandoMock()) return realApi;
  const { mockApi } = await import("./mockApi");
  return mockApi;
}

// ---- Tratamento central de 401 ----
let aoNaoAutorizado: (() => void) | null = null;
export function definirAoNaoAutorizado(fn: () => void) {
  aoNaoAutorizado = fn;
}

async function guarda<T>(fn: (adaptador: ApiAdapter) => Promise<T>): Promise<T> {
  try {
    return await fn(await impl());
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
  fechamentoExercicio: (id: string, fechar: boolean, motivo: string, versao: string | null) =>
    guarda((adaptador) => adaptador.fechamentoExercicio(id, fechar, motivo, versao)),
  anexos: {
    listar: (exercicioId: string) => guarda((adaptador) => adaptador.anexos.listar(exercicioId)),
  },
  listar: <T>(store: Store) => guarda((adaptador) => adaptador.listar<T>(store)),
  obter: <T>(store: Store, id: string) => guarda((adaptador) => adaptador.obter<T>(store, id)),
  salvar: <T extends { id?: string }>(store: Store, o: T) =>
    guarda((adaptador) => adaptador.salvar<T>(store, { ...o, id: o.id || novoId() })),
  excluir: (store: Store, id: string) => guarda((adaptador) => adaptador.excluir(store, id)),
  exportar: () => guarda((adaptador) => adaptador.exportar()),
  importar: (dados: Backup, substituir: boolean) =>
    guarda((adaptador) => adaptador.importar(dados, substituir)),
  confirmarImportacao: (pedido: ConfirmarImportacaoPedido) =>
    guarda((adaptador) => adaptador.confirmarImportacao(pedido)),
  backup: {
    criar: () => guarda((adaptador) => adaptador.backup.criar()),
    listar: () => guarda((adaptador) => adaptador.backup.listar()),
    baixar: (id: string) => guarda((adaptador) => adaptador.backup.baixar(id)),
    restaurar: (id: string, substituir: boolean) =>
      guarda((adaptador) => adaptador.backup.restaurar(id, substituir)),
    excluir: (id: string) => guarda((adaptador) => adaptador.backup.excluir(id)),
  },
  manutencao: {
    contagens: () => guarda((adaptador) => adaptador.manutencao.contagens()),
    limpar: (alvo: AlvoLimpeza) => guarda((adaptador) => adaptador.manutencao.limpar(alvo)),
    cargaPrevistos: (modo: "simular" | "aplicar") =>
      guarda((adaptador) => adaptador.manutencao.cargaPrevistos(modo)),
    atualizarPrevisto: (condoId: string, anoDestino: number) =>
      guarda((adaptador) => adaptador.manutencao.atualizarPrevisto(condoId, anoDestino)),
  },
  auth: {
    eu: async () => (await impl()).auth.eu(),
    entrar: async (login: string, senha: string) => (await impl()).auth.entrar(login, senha),
    sair: async () => (await impl()).auth.sair(),
    minhaSenha: async (atual: string, nova: string) => (await impl()).auth.minhaSenha(atual, nova),
    usuarios: () => guarda((adaptador) => adaptador.auth.usuarios()),
    usuarioSalvar: (u: UsuarioSalvar) => guarda((adaptador) => adaptador.auth.usuarioSalvar(u)),
    usuarioExcluir: (id: string) => guarda((adaptador) => adaptador.auth.usuarioExcluir(id)),
    permissoes: () => guarda((adaptador) => adaptador.auth.permissoes()),
    permissaoSalvar: (usuarioId: string, chave: string, efeito: "permitir" | "negar" | "remover") =>
      guarda((adaptador) => adaptador.auth.permissaoSalvar(usuarioId, chave, efeito)),
    perfis: () => guarda((adaptador) => adaptador.auth.perfis()),
    perfilPermissaoSalvar: (perfil: Perfil, chave: string, permitida: boolean) =>
      guarda((adaptador) => adaptador.auth.perfilPermissaoSalvar(perfil, chave, permitida)),
  },
  documentos: {
    listar: (condoId: string) => guarda((adaptador) => adaptador.documentos.listar(condoId)),
    resumo: () => guarda((adaptador) => adaptador.documentos.resumo()),
    registrar: (doc: DocumentoDriveRegistro) =>
      guarda((adaptador) => adaptador.documentos.registrar(doc)),
    conteudo: (id: string) => guarda((adaptador) => adaptador.documentos.conteudo(id)),
    atualizar: (dados: {
      id: string;
      nomeArquivo?: string;
      tipo?: TipoDocumentoConsulta;
      caminhoRelativo?: string;
      dataDocumento?: string;
    }) => guarda((adaptador) => adaptador.documentos.atualizar(dados)),
    excluir: (id: string) => guarda((adaptador) => adaptador.documentos.excluir(id)),
    perguntar: (condoId: string, pergunta: string, documentoId?: string) =>
      guarda((adaptador) => adaptador.documentos.perguntar(condoId, pergunta, documentoId)),
    historico: (condoId: string) => guarda((adaptador) => adaptador.documentos.historico(condoId)),
  },
};
