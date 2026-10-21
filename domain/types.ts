import type { CadastroBasico, ConsideracoesFinaisLidas, PrevisaoSugeridaLida, RelatorioLido } from "./pdfParser";

/**
 * Tipos de domínio do Sistema Krieger.
 * ATENÇÃO: os nomes de campo devem permanecer exatamente iguais — já existem
 * dados gravados e backups com esta estrutura.
 */

export type Store =
  | "condominios"
  | "exercicios"
  | "mensais"
  | "assembleias"
  | "modelos"
  | "config"
  | "importacoes"
  | "atas";

export const STORES: Store[] = [
  "condominios",
  "exercicios",
  "mensais",
  "assembleias",
  "modelos",
  "config",
  "importacoes",
  "atas",
];

export interface ComId {
  id: string;
}

// ---------- Condomínio ----------

export interface MembroAdministracao {
  cargo: string;
  nome: string;
  /** mm/aaaa */
  mandatoFim?: string;
}

export interface Cobertura {
  desc: string;
  valor: number | null;
}

export interface IndiceCorrecao {
  ano: number | null;
  pct: number | null;
}

export interface DePara {
  de: string;
  para: string;
}

export type ModoRegra = "ultimo" | "ultimo+12";

export interface RegraPreenchimento {
  campo: string;
  rotulo: string;
  fonte: string;
  regex: string;
  modo: ModoRegra;
}

export type Arredondamento = "truncar" | "arredondar" | "centavos";
export type VariacaoMetodo = "manual" | "percentual" | "mediaIndices";

export interface Condominio extends ComId {
  codigo: string;
  nome: string;
  nomeRelatorio: string;
  cnpj: string;
  enderecoEdital: string;
  unidades: number | null;
  rateioAtual: number | null;
  prazoConvocacao: number;
  quorum: string;
  administradoraTermo: string;
  administracao: MembroAdministracao[];
  seguradora: string;
  vigenciaSeguro: string;
  seguro: { riscoAbsoluto: number | null; coberturas: Cobertura[] };
  vigenciaExtintores: string;
  ultGordura: string;
  ultDedetizacao: string;
  ultCaixaDagua: string;
  vistoriaAno: number | null;
  vistoriaLei: string;
  vistoriaIntervalo: number;
  indices: IndiceCorrecao[];
  mapeamento: DePara[];
  deducaoRegex: string;
  aguaRubrica: string;
  arredondamento: Arredondamento;
  variacaoPadrao: number | null;
  conhecidas: string[];
  somenteAnual: boolean;
  regras: RegraPreenchimento[];
  variacaoMetodo: VariacaoMetodo;
  variacaoParam: number | null;
}

// ---------- Demonstrativo ----------

export interface LinhaValor {
  nome: string;
  valor: number;
}

export interface Demonstrativo {
  condominio: string;
  /** dd/mm/aaaa */
  periodo: { ini: string; fim: string };
  saldoAnterior: { contas: LinhaValor[]; total: number };
  receitas: { itens: LinhaValor[]; subtotal: number; totalComSaldo: number };
  despesas: {
    grupos: { nome: string; itens: LinhaValor[] }[];
    subtotal: number;
    saldoRestante: number;
  };
  saldoAtual: { contas: LinhaValor[]; total: number };
  totais: { saldoAnterior: number; receitas: number; despesas: number; saldoAtual: number };
  avisos: string[];
  erros: string[];
}

// ---------- Exercício (prestação de contas) ----------

export interface AjustePrevisao {
  id: string;
  descricao: string;
  sinal: "+" | "-";
  valor: number;
  grupo?: string;
}

export interface Exercicio extends ComId {
  condoId: string;
  condoNome: string;
  ano: number | string;
  demonstrativo: Demonstrativo | null;
  origem: string[];
  cidade: string;
  dataEmissao: string;
  rateioAtual: number | null;
  rateioAprovado?: number | null;
  variacao: number | null;
  variacaoMetodo: VariacaoMetodo;
  variacaoParam: number | null;
  deducaoRegex: string;
  arredondamento: Arredondamento;
  confer: unknown;
  consid: {
    administracao: MembroAdministracao[];
    contasReceber: unknown;
    contasPagar: unknown;
    seguradora: string;
    vigenciaSeguro: string;
    seguro: Condominio["seguro"];
    vigenciaExtintores: string;
    ultGordura: string;
    ultDedetizacao: string;
    ultCaixaDagua: string;
    vistoriaAno: number | null;
    vistoriaLei: string;
    vistoriaIntervalo: number;
    aguaRubrica: string;
    consumoAguaManual?: number | null;
    indices: IndiceCorrecao[];
    extras: { rotulo: string; valor: string | number }[];
  };
  prev?: {
    modo: "tradicional" | "detalhado";
    driver?: unknown;
    alvos?: unknown;
    ajustes?: AjustePrevisao[];
    /** Campo novo (opcional): % do fundo de reserva sobre a cota mensal. */
    fundoReservaPct?: number | null;
  };
  mostrarAnalise?: boolean;
  mostrarPizza?: boolean;
  /** Campo novo (opcional): escolhas do relatório final. "Análise gráfica" usa mostrarAnalise/mostrarPizza. */
  relatorioFinal?: {
    /** Seções incluídas (ausente = incluída). */
    secoes?: Partial<Record<string, boolean>>;
    /** Mês (1–12 do exercício seguinte) do acumulado do Previsto × Realizado; null = último com relatório. */
    prAte?: number | null;
    /** ISO 8601 da última emissão. */
    emitidoEm?: string | null;
    emitidoPor?: string;
  };
}

// ---------- Mensal ----------

export interface Mensal extends ComId {
  condoId: string;
  condoNome: string;
  demonstrativo: Demonstrativo | null;
  origem: string[] | string;
  receber: { unidades: number | null; valor: number | null };
  notas: { rubrica: string; texto: string; valor: number | null }[];
}

// ---------- Assembleia (edital) ----------

export interface Assembleia extends ComId {
  condoId: string;
  modeloId: string;
  tipo: "ordinaria" | "extraordinaria";
  modalidade: "online" | "presencial" | "hibrida";
  /** aaaa-mm-dd */
  data: string;
  hora1: string;
  hora2: string;
  quorum: string;
  local: string;
  zoomLink: string;
  zoomId: string;
  zoomSenha: string;
  pauta: string[];
  exercicio: string;
  entregaContas: "email" | "administracao" | "aplicativo";
  dataEmissao: string;
  cidade: string;
  assinante: string;
  cargo: string;
  timbrado: boolean;
  linhasLista: number | null;
}

// ---------- Modelo de edital ----------

export type TipoBloco = "titulo" | "subtitulo" | "texto" | "item" | "esquerda" | "pauta";

export interface Modelo extends ComId {
  nome: string;
  versao: number | string;
  pautaOrdinaria: string[];
  blocos: { id: string; tipo: TipoBloco; texto: string; cond: string }[];
  historico?: unknown[];
}

// ---------- Ata ----------

export interface Ata extends ComId {
  condoId: string;
  assembleiaId: string;
  tipo: string;
  data: string;
  hora: string;
  modalidade: string;
  local: string;
  mesa: { presidente: string; secretario: string };
  presentes: { unidade: string; nome: string; procurador: boolean }[];
  quorum: { unidadesPresentes: number; totalUnidades: number };
  itens: {
    titulo: string;
    discussao: string;
    deliberacao: string;
    votos: { favor: number; contra: number; abstencao: number };
  }[];
  encerramento: string;
  observacoes: string;
  status: "rascunho" | "finalizada";
}

// ---------- Importação de relatório (staging) ----------

export type DestinoImportacao = "mensais" | "exercicios";

/** PDF importado de um condomínio ainda não cadastrado, aguardando a conferência do cadastro. */
export interface Importacao extends ComId {
  status: "pendente" | "confirmado" | "descartado";
  arquivo: string;
  /** ISO 8601 */
  importadoEm: string;
  relatorio: RelatorioLido;
  cadastro: CadastroBasico;
  condominioId: string | null;
  /** Campo novo (opcional): onde o usuário iniciou a importação; ausente = relatório mensal. */
  destino?: DestinoImportacao;
  /** Campo novo (opcional): id do relatório gravado ao confirmar. */
  registroId?: string | null;
  /** Campo novo (opcional): Considerações finais lidas do PDF, se a página existir. */
  consideracoes?: ConsideracoesFinaisLidas | null;
  /** Campo novo (opcional): Previsão orçamentária sugerida lida do PDF, só como referência. */
  previsaoSugerida?: PrevisaoSugeridaLida | null;
}

// ---------- Configurações ----------

export interface ConfigEscritorio extends ComId {
  id: "escritorio";
  nome: string;
  cidade: string;
  rodape: string;
  assinatura: string;
  /** data URL base64 */
  logo: string;
  /** largura / altura da imagem do logo */
  logoRatio: number | null;
}

export interface ConfigBackup extends ComId {
  id: "backup";
  /** ISO 8601 */
  em: string;
}

/** Backup salvo no servidor (histórico), sem o conteúdo (`dados`) — só pra listar/escolher. */
export interface BackupRegistro {
  id: string;
  geradoPorNome: string;
  /** ISO 8601 */
  criadoEm: string;
  tamanhoBytes: number;
}

/** Conteúdo de um arquivo de backup: um array por store. */
export type Backup = Partial<Record<Store, unknown[]>> & Record<string, unknown>;

// ---------- Usuários ----------

export type Perfil = "admin" | "user";

export interface Usuario {
  id: string;
  login: string;
  nome: string;
  perfil: Perfil;
  trocarSenha: boolean;
}

export interface UsuarioAdmin extends Usuario {
  ativo: boolean;
  criadoEm?: string | null;
  ultimoAcesso?: string | null;
}

export interface UsuarioSalvar {
  id?: string;
  login: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
  senha?: string;
}
