import type {
  Backup,
  BackupRegistro,
  Condominio,
  ConsultaHistoricoItem,
  ConsultaResposta,
  DestinoImportacao,
  Exercicio,
  Mensal,
  Store,
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

/**
 * Pedido de confirmação de uma importação pendente (POST api.php?a=confirmar_importacao).
 * Os ids do condomínio novo e do registro são gerados antes do envio, para que repetir o pedido
 * (ex.: depois de uma falha de rede) não crie nada em dobro: a importação é a chave idempotente.
 */
export type ConfirmarImportacaoPedido = {
  importacaoId: string;
  destino: DestinoImportacao;
  /**
   * Existente: `{ id }`, com `camposComplementares` opcional (campos em branco no cadastro que o
   * PDF traz preenchidos, já confirmados pelo usuário — ver `domain/importacao.ts`,
   * `camposComplementares`). Novo: o cadastro completo já preparado, com o id gerado.
   */
  condominio: { id: string; camposComplementares?: { codigo: string | null; nome: string | null; cnpj: string | null } } | Condominio;
  registro: Mensal | Exercicio;
  cadastro: { codigo: string | null; nome: string | null; cnpj: string | null };
};

export type ConfirmarImportacaoResposta = {
  registro: Mensal | Exercicio;
  condominioId: string;
  criouCondominio: boolean;
  /** true quando algum campo complementar do cadastro existente foi preenchido nesta confirmação. */
  atualizouCadastro: boolean;
  /** true quando a importação já estava confirmada e o registro gravado antes foi devolvido. */
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
  /** Confirma a importação numa única operação no servidor: condomínio (se novo), registro e status. */
  confirmarImportacao(pedido: ConfirmarImportacaoPedido): Promise<ConfirmarImportacaoResposta>;
  /** Backups salvos no servidor (histórico, vinculado a quem gerou) — além do arquivo baixado na hora. */
  backup: {
    /** Gera um novo backup no servidor com os dados atuais, vinculado ao usuário logado. */
    criar(): Promise<BackupRegistro>;
    listar(): Promise<BackupRegistro[]>;
    /** Conteúdo completo, pra baixar como arquivo (mídia externa) ou conferir antes de restaurar. */
    baixar(id: string): Promise<Backup>;
    restaurar(id: string, substituir: boolean): Promise<unknown>;
    excluir(id: string): Promise<void>;
  };
  /** Limpeza administrativa de cadastros em massa (somente perfil admin). */
  manutencao: {
    contagens(): Promise<ContagensLimpeza>;
    limpar(alvo: AlvoLimpeza): Promise<{ ok: true; apagados: number }>;
  };
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
  /** Consulta Inteligente de Documentos (convenção/regimento/atas) — ver docs/ESTADO-ATUAL.md. */
  documentos: {
    perguntar(condoId: string, pergunta: string): Promise<ConsultaResposta>;
    historico(condoId: string): Promise<ConsultaHistoricoItem[]>;
  };
}
