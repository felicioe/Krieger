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
  | "atas"
  | "anexos_importacao"
  | "decisoes_previsao";

export const STORES: Store[] = [
  "condominios",
  "exercicios",
  "mensais",
  "assembleias",
  "modelos",
  "config",
  "importacoes",
  "atas",
  "anexos_importacao",
  "decisoes_previsao",
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
  /** Campo novo (opcional): referência entre parênteses no relatório (unidade, sala, box, "Externo" etc.). */
  identificacao?: string;
  /** Campo novo (opcional). */
  telefone?: string;
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

/**
 * Item do checklist "Documentos obrigatórios" (Extintor, Seguro, Alvarás etc.) — lista livre e
 * independente dos campos específicos de "Manutenções e vistorias" (vigenciaExtintores etc.):
 * status marcado manualmente (sem data calculada), pensada para itens sem vencimento fixo.
 */
export interface DocumentoObrigatorio {
  nome: string;
  status: "ok" | "pendente";
  /** Vencimento ou outra informação em texto livre (ex.: "21/11/2026", "Lei municipal nº …"). */
  informacao: string;
  observacao: string;
  /** Aparece no resumo das Considerações finais do relatório. */
  noRelatorio: boolean;
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
/**
 * "manual"/"percentual"/"mediaIndices": a variação é um percentual aplicado sobre a base líquida.
 * "valor": a variação é um valor em R$ direto (somado à base líquida, sem multiplicar) — reflete
 * um ajuste subjetivo da empresa (ex.: previsão de aumento de custo), lido de `variacaoParam`.
 */
export type VariacaoMetodo = "manual" | "percentual" | "mediaIndices" | "valor";

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
  /** Campo novo (opcional): mesmo mecanismo da água, para a linha "Energia elétrica" do consumo de serviços. */
  energiaRubrica: string;
  /** Campo novo (opcional): mesmo mecanismo da água, para a linha "Elevadores" do consumo de serviços. */
  elevadorRubrica: string;
  /** Campo novo (opcional): texto livre, impresso como 3ª linha da célula "Elevadores". */
  elevadorFornecedor: string;
  /** Campo novo (opcional): checklist "Documentos obrigatórios" — ver `DocumentoObrigatorio`. */
  documentosObrigatorios: DocumentoObrigatorio[];
  arredondamento: Arredondamento;
  variacaoPadrao: number | null;
  conhecidas: string[];
  somenteAnual: boolean;
  regras: RegraPreenchimento[];
  variacaoMetodo: VariacaoMetodo;
  variacaoParam: number | null;
  /**
   * Pasta-raiz deste condomínio no servidor de arquivos da empresa (NAS), digitada uma vez no
   * cadastro — nunca detectada automaticamente, pra não indexar o condomínio errado por engano.
   * Usada só pelo agente de indexação da Consulta de Documentos (convenção/regimento/atas).
   */
  pastaDocumentos: string;
  /** Caminhos locais adicionais de documentos deste condomínio (além de `pastaDocumentos`). */
  caminhosDocumentos?: string[];
  /** Pastas e subpastas cadastradas no Drive deste condomínio (ex.: ["Atas de Assembleia/2025", "Jurídico/Processos"]). */
  pastasDrive?: string[];
  /** Campo novo (opcional): área total do condomínio (m²), lida da Listagem de Condomínios. */
  areaTotalM2?: number | null;
  /**
   * Campo novo (opcional): problema achado na última importação da Listagem de Condomínios (ex.:
   * CNPJ ausente ou usado por outro condomínio da mesma listagem) — não bloqueia nada, só fica
   * visível (lista de condomínios e cadastro) até alguém revisar e dispensar manualmente.
   */
  alertaCadastro?: string | null;
  /** Campo novo (opcional): ISO 8601 do último salvamento do cadastro — mostrado na tela pra indicar se os dados estão em dia. */
  atualizadoEm?: string | null;
  /** Campo novo (opcional): nome de quem fez o último salvamento. */
  atualizadoPor?: string;
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

/**
 * Previsão orçamentária sugerida pelo Systemar (folha "Previsão orçamentária ordinária sugerida"
 * do PDF). Diferente de `Exercicio.prev` (previsão calculada a partir do demonstrativo do próprio
 * exercício, com ajustes/fundo de reserva/unidades): esta parte das categorias de despesa já
 * realizadas conforme o PDF, com linhas de dedução e variação editáveis pelo usuário.
 */
/** Totais que o PDF do Systemar já traz prontos, lidos uma vez na importação — referência fixa para
 * comparar com o que o sistema recalcula a partir das categorias/deduções/variação (que continuam
 * editáveis depois). Qualquer um pode vir `null` quando o PDF não trouxer aquele total. */
export interface TotaisPrevisaoSugeridaPdf {
  totalDespesasAno: number | null;
  totalOrdinario: number | null;
  rateioAnualSugerido: number | null;
  rateioMensalSugerido: number | null;
  /** % */
  indiceSugerido: number | null;
}

/** Uma divergência entre um total do PDF e o que o sistema recalculou. */
export interface DivergenciaPrevisaoSugerida {
  campo: string;
  doPdf: number;
  calculado: number;
}

/** Marca de que o usuário viu a(s) divergência(s) atual(is) e decidiu o que fazer: `"confirmado"`
 * (mantém os valores calculados) ou `"revisar_depois"` (adia a decisão — a prestação de contas
 * continua aparecendo como "Em conferência" até virar `"confirmado"`). `chave` identifica o conjunto
 * de divergências decidido — se os valores mudarem (nova edição de deduções/variação), a chave muda
 * e a decisão anterior deixa de valer, voltando a pedir decisão. */
export interface DecisaoDivergenciaPrevisaoSugerida {
  chave: string;
  status: "confirmado" | "revisar_depois";
  em: string;
  por: string;
  porNome: string;
}

export interface PrevisaoSugeridaExercicio {
  /** Rateio mensal utilizado no ano anterior, lido do PDF — referência para o índice sugerido. */
  rateioMensalAtual: number | null;
  /** Despesas realizadas por categoria (como o Systemar agrupa), com a média mensal ao lado. */
  categorias: { nome: string; anual: number; media: number }[];
  /** Linhas de dedução (ex.: "Parte água e gás"), + ou -. Uma ou mais, editáveis. */
  deducoes: AjustePrevisao[];
  /** Variação de despesas sugeridas, + ou -. */
  variacao: { sinal: "+" | "-"; valor: number };
  /** Campo novo (opcional): totais do PDF, para comparar com o recalculado a qualquer momento. */
  totaisPdf?: TotaisPrevisaoSugeridaPdf | null;
  /** Campo novo (opcional): decisão registrada sobre a divergência atual (confirmada ou adiada). */
  decisaoDivergencia?: DecisaoDivergenciaPrevisaoSugerida | null;
}

/** Log (store `decisoes_previsao`): toda vez que o sistema aponta uma divergência na Previsão
 * sugerida e o usuário decide algo sobre ela — confirmar os valores calculados ou adiar a decisão.
 * Mostrado dentro da própria prestação de contas (Previsão orçamentária), não numa tela separada. */
export interface DecisaoDivergenciaPrevisao extends ComId {
  condoId: string;
  condoNome: string;
  exercicioId: string;
  ano: number | string;
  campos: DivergenciaPrevisaoSugerida[];
  status: "confirmado" | "revisar_depois";
  decididoPor: string;
  decididoPorNome: string;
  decididoEm: string;
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
    /** Campo novo (opcional). */
    energiaRubrica: string;
    /** Campo novo (opcional). */
    consumoEnergiaManual?: number | null;
    /** Campo novo (opcional). */
    elevadorRubrica: string;
    /** Campo novo (opcional). */
    consumoElevadorManual?: number | null;
    /** Campo novo (opcional). */
    elevadorFornecedor: string;
    /** Campo novo (opcional): snapshot do checklist do condomínio no momento do relatório. */
    documentosObrigatorios: DocumentoObrigatorio[];
    indices: IndiceCorrecao[];
    extras: { rotulo: string; valor: string | number }[];
  };
  /** Campo novo (opcional): previsão orçamentária sugerida pelo Systemar (menu próprio). */
  previsaoSugerida?: PrevisaoSugeridaExercicio | null;
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
  mostrarEvolucaoMensal?: boolean;
  /** Linhas por rubrica (contas analíticas) na seção Previsto × Realizado; false = só os totais por grupo. */
  mostrarContasAnaliticas?: boolean;
  /**
   * Bloco "Previsão orçamentária por unidade" (Unidades/Cota/Reserva/Valor por unidade), nos dois
   * modos de previsão; false = oculto. Mesmo marcado, fica oculto quando não há nº de unidades (nem
   * no cadastro, nem no relatório mensal mais recente) — nunca mostra o bloco zerado.
   */
  mostrarPrevisaoPorUnidade?: boolean;
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

/**
 * Tipos de relatório que só são anexados a um exercício já existente (referência/auditoria),
 * em vez de virar um `Demonstrativo` por `DestinoImportacao`. Hoje só o Comparativo Financeiro;
 * outros layouts "só leitura" entram aqui no futuro.
 */
export type TipoAnexoImportacao = "comparativo_financeiro";

/**
 * PDF anexado a uma Prestação de Contas (Exercício) já existente, como referência — não vira
 * lançamento no demonstrativo. Guarda o relatório lido na íntegra para permitir reexibir os dados
 * e para a auditoria de divergência (item a par com `divergenciasImportacao`, mas aqui comparando
 * contra o que foi registrado manualmente, não contra uma importação direta).
 */
export interface AnexoImportado extends ComId {
  exercicioId: string;
  tipo: TipoAnexoImportacao;
  arquivo: string;
  /** data URL (igual ao logo do escritório) — permite baixar/reexibir o PDF original. */
  arquivoDataUrl: string;
  /** ISO 8601 */
  importadoEm: string;
  relatorio: RelatorioLido;
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
  /** Cadastro de categorias e pastas padrão do Drive de Documentos (com palavras-chave de auto-identificação). */
  categoriasDrive?: CategoriaPastaDrive[];
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
  condoId?: string;
  condoNome?: string;
  tamanhoBytes: number;
}

/** Conteúdo de um arquivo de backup: um array por store. */
export type Backup = Partial<Record<Store, unknown[]>> & Record<string, unknown>;

// ---------- Consulta Inteligente de Documentos ----------

export type TipoDocumentoConsulta =
  | "convencao"
  | "regimento"
  | "ata"
  | "seguro"
  | "contrato"
  | "laudo"
  | "notificacao"
  | "outro";

export type FormatoArquivoDrive = "pdf" | "docx" | "jpg" | "png" | "webp" | "outro";

export interface CategoriaPastaDrive {
  /** Código identificador da categoria/pasta (ex.: "convencao", "ata", "obras", "outro"). */
  valor: TipoDocumentoConsulta;
  /** Nome visível da categoria / pasta (ex.: "Convenção", "Atas de Assembleia", "Outros Documentos"). */
  rotulo: string;
  /** Palavras-chave usadas para identificar automaticamente documentos avulsos pelo nome do arquivo. */
  palavrasChave: string[];
  /** Se true, indica a pasta padrão ("Outros Documentos") que recebe arquivos avulsos não identificados. */
  padraoOutros?: boolean;
}

export interface DocumentoDrive {
  id: string;
  condoId: string;
  tipo: TipoDocumentoConsulta;
  nomeArquivo: string;
  caminhoRelativo: string;
  hash: string;
  tamanho: number;
  paginas: number | null;
  /** Data de referência do documento (aaaa-mm-dd) ou data de envio. */
  dataDocumento: string;
  formatoOriginal: FormatoArquivoDrive;
  temPdf: boolean;
  temOriginal: boolean;
  status: "ok" | "erro";
  erro?: string | null;
  /** ISO 8601 */
  indexadoEm: string;
}

export interface DocumentoDriveConteudo {
  id: string;
  nomeArquivo: string;
  formatoOriginal: FormatoArquivoDrive;
  pdfDataUrl: string | null;
  originalDataUrl: string | null;
}

export interface DocumentoDriveRegistro {
  condoId: string;
  tipo: TipoDocumentoConsulta;
  nomeArquivo: string;
  caminhoRelativo: string;
  hash: string;
  tamanho: number;
  paginas?: number | null;
  dataDocumento?: string | null;
  formatoOriginal?: FormatoArquivoDrive;
  pdfDataUrl?: string | null;
  originalDataUrl?: string | null;
  trechos: { paginaInicial: number; paginaFinal: number; texto: string }[];
}

/** Trecho de um documento indexado usado como evidência de uma resposta. */
export interface ConsultaFonte {
  documentoId: string;
  arquivo: string;
  tipo: TipoDocumentoConsulta;
  paginaInicial: number;
  paginaFinal: number;
  condoId?: string;
  condoNome?: string;
}

export type ConsultaOrigem = "cache" | "local" | "claude";

export interface ConsultaResposta {
  texto: string;
  fontes: ConsultaFonte[];
  /** true quando não havia evidência suficiente nos documentos indexados. */
  semEvidencia: boolean;
  origem: ConsultaOrigem;
}

export interface ConsultaHistoricoItem {
  id: string;
  usuarioId: string;
  pergunta: string;
  origem: ConsultaOrigem;
  tokensEntrada: number;
  tokensSaida: number;
  custoEstimadoCentavos: number;
  status: "ok" | "sem_evidencia" | "erro";
  /** ISO 8601 */
  criadoEm: string;
  condoId?: string;
  condoNome?: string;
}

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
