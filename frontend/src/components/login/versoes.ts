import dados from "@/data/versoes.json";

/** Uma entrada do registro de alterações. A versão é sempre texto, nunca número decimal. */
export interface Versao {
  versao: string;
  titulo: string;
  alteracoes: string[];
}

export interface RegistroVersoes {
  versaoAtual: string;
  versoes: Versao[];
}

/** Fonte única da versão exibida no sistema (o CHANGELOG.md da raiz é gerado do mesmo arquivo). */
export const VERSOES: RegistroVersoes = dados;
