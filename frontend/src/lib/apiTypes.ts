import type { Backup, Store, Usuario, UsuarioAdmin, UsuarioSalvar } from "@/domain/types";

/** Erro devolvido pela API ({erro: "mensagem"} + status HTTP). */
export class ApiError extends Error {
  status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
  }
}

export type Registro = { id: string } & Record<string, unknown>;

/** Contrato único de acesso a dados — implementado pela API PHP e pelo mock. */
export interface ApiAdapter {
  listar<T = Registro>(store: Store): Promise<T[]>;
  obter<T = Registro>(store: Store, id: string): Promise<T | null>;
  salvar<T extends { id?: string }>(store: Store, o: T): Promise<T & { id: string }>;
  excluir(store: Store, id: string): Promise<void>;
  exportar(): Promise<Backup>;
  importar(dados: Backup, substituir: boolean): Promise<unknown>;
  auth: {
    /** null quando não autenticado (401). */
    eu(): Promise<Usuario | null>;
    entrar(login: string, senha: string): Promise<Usuario>;
    sair(): Promise<void>;
    minhaSenha(atual: string, nova: string): Promise<void>;
    usuarios(): Promise<UsuarioAdmin[]>;
    usuarioSalvar(u: UsuarioSalvar): Promise<unknown>;
    usuarioExcluir(id: string): Promise<void>;
  };
}
