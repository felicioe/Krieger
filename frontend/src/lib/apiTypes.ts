import type {
  Backup,
  BackupRegistro,
  Condominio,
  ConsultaHistoricoItem,
  ConsultaResposta,
  DestinoImportacao,
  DocumentoDrive,
  DocumentoDriveConteudo,
  DocumentoDriveRegistro,
  Exercicio,
  Mensal,
  Store,
  TipoDocumentoConsulta,
  Usuario,
  UsuarioAdmin,
  UsuarioSalvar,
} from "@/domain/types";

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
export type PermissaoCatalogo = { chave: string; modulo: string; tela: string; acao: string; descricao?: string | null; ativo?: boolean };
export type PermissaoExcecao = { usuarioId: string; permissaoChave: string; efeito: "permitir" | "negar" };

export type ConfirmarImportacaoPedido = {
  importacaoId: string;
  destino: DestinoImportacao;
  condominio: { id: string; camposComplementares?: { codigo: string | null; nome: string | null; cnpj: string | null } } | Condominio;
  registro: Mensal | Exercicio;
  cadastro: { codigo: string | null; nome: string | null; cnpj: string | null };
};

export type ConfirmarImportacaoResposta = {
  registro: Mensal | Exercicio;
  condominioId: string;
  criouCondominio: boolean;
  atualizouCadastro: boolean;
  reutilizado: boolean;
};

export type AlvoLimpeza =
  | "tudo"
  | "condominios"
  | "exercicios"
  | "mensais"
  | "assembleias"
  | "atas"
  | "modelos"
  | "importacoes"
  | "anexos_importacao"
  | "decisoes_previsao"
  | "documentos"
  | "backups";

export type ContagensLimpeza = Record<Exclude<AlvoLimpeza, "tudo">, number>;

/** Contrato único de acesso a dados — implementado pela API PHP e pelo mock. */
export interface ApiAdapter {
  listar<T = Registro>(store: Store): Promise<T[]>;
  obter<T = Registro>(store: Store, id: string): Promise<T | null>;
  salvar<T extends { id?: string }>(store: Store, o: T): Promise<T & { id: string }>;
  excluir(store: Store, id: string): Promise<void>;
  exportar(): Promise<Backup>;
  importar(dados: Backup, substituir: boolean): Promise<unknown>;
  confirmarImportacao(pedido: ConfirmarImportacaoPedido): Promise<ConfirmarImportacaoResposta>;
  backup: {
    criar(): Promise<BackupRegistro>;
    listar(): Promise<BackupRegistro[]>;
    baixar(id: string): Promise<Backup>;
    restaurar(id: string, substituir: boolean): Promise<unknown>;
    excluir(id: string): Promise<void>;
  };
  manutencao: {
    contagens(): Promise<ContagensLimpeza>;
    limpar(alvo: AlvoLimpeza): Promise<{ ok: true; apagados: number }>;
  };
  auth: {
    eu(): Promise<Usuario | null>;
    entrar(login: string, senha: string): Promise<Usuario>;
    sair(): Promise<void>;
    minhaSenha(atual: string, nova: string): Promise<void>;
    usuarios(): Promise<UsuarioAdmin[]>;
    usuarioSalvar(u: UsuarioSalvar): Promise<unknown>;
    usuarioExcluir(id: string): Promise<void>;
    permissoes(): Promise<{ catalogo: PermissaoCatalogo[]; excecoes: PermissaoExcecao[] }>;
    permissaoSalvar(usuarioId: string, chave: string, efeito: "permitir" | "negar" | "remover"): Promise<void>;
  };
  /** Drive de Documentos e Consulta Inteligente de Documentos. */
  documentos: {
    listar(condoId: string): Promise<DocumentoDrive[]>;
    resumo(): Promise<Record<string, number>>;
    registrar(doc: DocumentoDriveRegistro): Promise<{ id: string; condoId: string; tipo: TipoDocumentoConsulta; indexadoEm: string }>;
    conteudo(id: string): Promise<DocumentoDriveConteudo>;
    atualizar(dados: {
      id: string;
      nomeArquivo?: string;
      tipo?: TipoDocumentoConsulta;
      caminhoRelativo?: string;
      dataDocumento?: string;
    }): Promise<{ ok: true; id: string; nomeArquivo: string; tipo: TipoDocumentoConsulta }>;
    excluir(id: string): Promise<void>;
    perguntar(condoId: string, pergunta: string, documentoId?: string): Promise<ConsultaResposta>;
    historico(condoId: string): Promise<ConsultaHistoricoItem[]>;
  };
}
