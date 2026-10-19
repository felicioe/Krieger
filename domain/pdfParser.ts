// Porta em TypeScript do leitor de relatórios PDF (Systemar) — ver ../importador/parser.mjs
// e ../importador/ESPECIFICACAO.md para os layouts reconhecidos e as regras de leitura.
import type { Demonstrativo } from './types';

export interface RelatorioLido {
  layout: 'dre_simples' | 'demonstrativo_hierarquico' | 'comparativo';
  condominio: { codigo: string | null; nome: string | null; cnpj: string | null };
  periodo: { inicio: string; fim: string } | { competenciaInicio: string; competenciaFim: string } | null;
  demonstrativo: Demonstrativo;
}

export function lerRelatorio(_textoPdf: string, _nomeArquivo = ''): RelatorioLido {
  throw new Error('não implementado');
}

export function cadastroBasico(_relatorio: RelatorioLido) {
  throw new Error('não implementado');
}
