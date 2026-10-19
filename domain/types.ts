// Tipos de domínio do Sistema Krieger. Mantêm exatamente estes nomes de campo: já existem
// dados e backups gravados nesse formato (ver api.php / store "condominios", "exercicios", ...).

export interface Condominio {
  id: string;
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
  administracao: { cargo: string; nome: string; mandatoFim?: string }[];
  seguradora: string;
  vigenciaSeguro: string;
  seguro: { riscoAbsoluto: number | null; coberturas: { desc: string; valor: number }[] };
  vigenciaExtintores: string;
  ultGordura: string;
  ultDedetizacao: string;
  ultCaixaDagua: string;
  vistoriaAno: string;
  vistoriaLei: string;
  vistoriaIntervalo: number;
  indices: { ano: string; pct: number }[];
  mapeamento: { de: string; para: string }[];
  deducaoRegex: string;
  aguaRubrica: string;
  arredondamento: 'truncar' | 'arredondar' | 'centavos';
  variacaoPadrao: number | null;
  conhecidas: string[];
  somenteAnual: boolean;
  regras: { campo: string; rotulo: string; fonte: string; regex: string; modo: 'ultimo' | 'ultimo+12' }[];
  variacaoMetodo: 'manual' | 'percentual' | 'mediaIndices';
  variacaoParam: number | null;
}

export interface Demonstrativo {
  condominio: string;
  periodo: { ini: string; fim: string }; // dd/mm/aaaa
  saldoAnterior: { contas: { nome: string; valor: number }[]; total: number };
  receitas: { itens: { nome: string; valor: number }[]; subtotal: number; totalComSaldo: number };
  despesas: { grupos: { nome: string; itens: { nome: string; valor: number }[] }[]; subtotal: number; saldoRestante: number };
  saldoAtual: { contas: { nome: string; valor: number }[]; total: number };
  totais: { saldoAnterior: number; receitas: number; despesas: number; saldoAtual: number };
  avisos: string[];
  erros: string[];
}

export interface AjustePrevisao {
  id: string;
  descricao: string;
  sinal: '+' | '-';
  valor: number;
  grupo?: string;
}

export interface Exercicio {
  id: string;
  condoId: string;
  condoNome: string;
  ano: number;
  demonstrativo: Demonstrativo;
  origem: string[];
  cidade: string;
  dataEmissao: string;
  rateioAtual: number;
  rateioAprovado?: number;
  variacao: number;
  variacaoMetodo: Condominio['variacaoMetodo'];
  variacaoParam: number | null;
  deducaoRegex: string;
  arredondamento: Condominio['arredondamento'];
  confer: boolean;
  consid: {
    administracao: Condominio['administracao'];
    contasReceber: unknown;
    contasPagar: unknown;
    seguradora: string;
    vigenciaSeguro: string;
    seguro: Condominio['seguro'];
    vigenciaExtintores: string;
    ultGordura: string;
    ultDedetizacao: string;
    ultCaixaDagua: string;
    vistoriaAno: string;
    vistoriaLei: string;
    vistoriaIntervalo: number;
    aguaRubrica: string;
    consumoAguaManual?: number;
    indices: Condominio['indices'];
    extras: { rotulo: string; valor: string }[];
  };
  prev?: {
    modo: 'tradicional' | 'detalhado';
    driver?: string;
    alvos?: unknown;
    ajustes?: AjustePrevisao[];
  };
  mostrarAnalise?: boolean;
  mostrarPizza?: boolean;
}

export interface Mensal {
  id: string;
  condoId: string;
  condoNome: string;
  demonstrativo: Demonstrativo;
  origem: string[];
  receber: { unidades: number; valor: number };
  notas: { rubrica: string; texto: string; valor: number }[];
}

export interface Assembleia {
  id: string;
  condoId: string;
  modeloId: string;
  tipo: 'ordinaria' | 'extraordinaria';
  modalidade: 'online' | 'presencial' | 'hibrida';
  data: string; // aaaa-mm-dd
  hora1: string;
  hora2: string;
  quorum: string;
  local: string;
  zoomLink: string;
  zoomId: string;
  zoomSenha: string;
  pauta: string[];
  exercicio: number;
  entregaContas: 'email' | 'administracao' | 'aplicativo';
  dataEmissao: string;
  cidade: string;
  assinante: string;
  cargo: string;
  timbrado: boolean;
  linhasLista: number;
}

export interface Modelo {
  id: string;
  nome: string;
  versao: number;
  pautaOrdinaria: string[];
  blocos: { id: string; tipo: 'titulo' | 'subtitulo' | 'texto' | 'item' | 'esquerda' | 'pauta'; texto: string; cond?: string }[];
  historico?: unknown;
}

export interface Ata {
  id: string;
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
  status: 'rascunho' | 'finalizada';
}
