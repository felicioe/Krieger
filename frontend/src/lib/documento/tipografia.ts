import type { Documento } from "./tipos";
import { FAMILIA, FAMILIA_DOCUMENTO } from "./fontes";

/**
 * Escalas tipográficas do documento, derivadas de `Documento.fonte` e `Documento.tamanhoCorpo`.
 *
 * O padrão (`fonte` ausente, corpo 10 pt) reproduz exatamente os tamanhos que edital, relatórios
 * e previsto × realizado usam desde sempre: títulos 15 / 12 / 10,5 e parágrafos 10 / 8,5 / 13.
 * Tudo o mais escala na mesma proporção, então um corpo de 12 pt (ata de cartório) produz
 * 18 / 14,4 / 12,6 e parágrafos 12 / 10,2 / 15,6 sem quebrar a hierarquia.
 */
export interface Tipografia {
  /** Família registrada no pdfmake. */
  familiaPdf: string;
  /** Família do Word (docx): Arial para documento, Calibri para interface. */
  familiaWord: string;
  /** Corpo base em pt. */
  corpo: number;
  /** Tamanhos por nível de título. */
  titulo: { 1: number; 2: number; 3: number };
  /** Tamanhos por variante de parágrafo. */
  paragrafo: { normal: number; pequeno: number; grande: number };
  /** Texto de rodapé do escritório (a numeração de páginas não depende disto). */
  rodapeEscritorio: boolean;
}

/** Tamanhos de referência do layout da interface, para o corpo de 10 pt. */
const BASE = {
  corpo: 10,
  titulo1: 15,
  titulo2: 12,
  titulo3: 10.5,
  pequeno: 8.5,
  grande: 13,
} as const;

const pt = (valor: number) => Math.round(valor * 10) / 10;

export function tipografia(doc: Documento): Tipografia {
  const documento = doc.fonte === "documento";
  const corpo = doc.tamanhoCorpo && doc.tamanhoCorpo > 0 ? doc.tamanhoCorpo : BASE.corpo;
  const escala = corpo / BASE.corpo;
  return {
    familiaPdf: documento ? FAMILIA_DOCUMENTO : FAMILIA,
    familiaWord: documento ? "Arial" : "Calibri",
    corpo,
    titulo: {
      1: pt(BASE.titulo1 * escala),
      2: pt(BASE.titulo2 * escala),
      3: pt(BASE.titulo3 * escala),
    },
    paragrafo: {
      normal: pt(corpo),
      pequeno: pt(BASE.pequeno * escala),
      grande: pt(BASE.grande * escala),
    },
    rodapeEscritorio: doc.rodapeEscritorio !== false,
  };
}
