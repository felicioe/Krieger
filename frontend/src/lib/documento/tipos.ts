/**
 * Modelo intermediário dos documentos gerados (PDF e Word).
 * Cada documento (edital, ata, relatórios) é descrito uma vez com estes blocos;
 * `pdf.ts` e `word.ts` desenham os mesmos blocos em cada formato.
 * Medidas em pontos (1/72 pol.). Página A4.
 */

export type Alinhamento = "esquerda" | "centro" | "direita" | "justificado";

export interface Trecho {
  texto: string;
  negrito?: boolean;
  italico?: boolean;
  suave?: boolean;
  /** letra 1 pt menor que a do bloco (ex.: valor secundário ao lado do principal) */
  pequeno?: boolean;
}

/** Texto simples ou trechos com estilo. "\n" quebra a linha. */
export type Texto = string | Trecho[];

export interface Coluna {
  titulo: string;
  /** pontos; "*" divide o espaço que sobrar */
  largura?: number | "*";
  alinhamento?: "esquerda" | "centro" | "direita";
}

export type EstiloLinha = "normal" | "grupo" | "subtotal" | "total";

export interface LinhaTabela {
  celulas: Texto[];
  /** "grupo" ocupa a linha toda com a primeira célula. */
  estilo?: EstiloLinha;
  recuo?: boolean;
}

export type Bloco =
  | { tipo: "titulo"; texto: string; nivel: 1 | 2 | 3; alinhamento?: Alinhamento }
  | {
      tipo: "paragrafo";
      texto: Texto;
      alinhamento?: Alinhamento;
      tamanho?: "pequeno" | "normal" | "grande";
      suave?: boolean;
      negrito?: boolean;
      recuo?: boolean;
    }
  | { tipo: "lista"; itens: Texto[]; numerada?: boolean }
  | {
      tipo: "tabela";
      colunas: Coluna[];
      linhas: LinhaTabela[];
      semCabecalho?: boolean;
      fundo?: boolean;
      pequena?: boolean;
      /** altura mínima de cada linha do corpo, em pt (ex.: linhas para assinar) */
      alturaLinha?: number;
      /** linhas verticais entre colunas (formulário para preencher à mão) */
      grade?: boolean;
    }
  | { tipo: "pares"; itens: { rotulo: string; valor: Texto }[] }
  | { tipo: "imagem"; dataUrl: string; largura: number; altura: number; alinhamento?: Alinhamento }
  | { tipo: "espaco"; altura: number }
  | { tipo: "quebraPagina" }
  /** Linhas de assinatura lado a lado; cada item = linhas de texto abaixo do traço. */
  | { tipo: "assinaturas"; itens: string[][] };

export interface Timbre {
  logo: { dataUrl: string; ratio: number } | null;
  nome: string;
  rodape: string;
}

export interface Documento {
  /** Título interno do arquivo. */
  titulo: string;
  /** Nome do arquivo, sem extensão. */
  arquivo: string;
  /** Papel timbrado (cabeçalho com logo/nome e rodapé do escritório). */
  timbre: Timbre | null;
  /** Não repete o cabeçalho timbrado na 1ª página (quando ela é a capa). */
  semTimbreNaCapa?: boolean;
  /** Texto em marca d'água (ex.: "RASCUNHO"). */
  marcaDagua?: string;
  /** Identificação curta no rodapé, ao lado do número da página. */
  rodape?: string;
  blocos: Bloco[];
}

/** Paleta sóbria usada nos dois formatos (sem #). */
export const COR = {
  primaria: "0B3A5E",
  texto: "1F2933",
  suave: "5F6B7A",
  linha: "D9E0E8",
  fundo: "F4F6F9",
  grupo: "E9EEF4",
} as const;

/** Área útil da página A4 com margens de 56 pt. */
export const PAGINA = { largura: 595.28, altura: 841.89, margem: 56, util: 595.28 - 2 * 56 } as const;

/**
 * Margem interna lateral de cada célula de tabela (pt, de cada lado), igual no PDF e no Word.
 * A largura de uma coluna fixa é só a do texto; a margem soma por fora.
 */
export const MARGEM_CELULA = { pequena: 4, normal: 5 } as const;
/** Recuo da primeira célula nas linhas com `recuo` (pt). */
export const RECUO_CELULA = 10;

export function textoPlano(t: Texto): string {
  return typeof t === "string" ? t : t.map((x) => x.texto).join("");
}
