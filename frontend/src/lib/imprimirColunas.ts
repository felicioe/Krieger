import { celulaTexto, type ColunaExportacao } from "@/domain/exportacao";
import { imprimirTabela } from "./imprimirTabela";

/**
 * Impressão A4 paisagem a partir das mesmas colunas do CSV/XLSX — assim a tela, a
 * planilha e o papel nunca divergem na ordem nem no conjunto de colunas. Devolve
 * `false` quando o navegador bloqueia a janela, para a tela avisar.
 */
export function imprimirColunas<T>(o: {
  titulo: string;
  subtitulo?: string | null | undefined;
  colunas: ColunaExportacao<T>[];
  linhas: T[];
  /** Rodapé da tabela (total geral), já formatado e com um valor por coluna. */
  totais?: string[];
}): boolean {
  return imprimirTabela({
    titulo: o.titulo,
    ...(o.subtitulo ? { subtitulo: o.subtitulo } : {}),
    cabecalhos: o.colunas.map((c) => c.titulo),
    linhas: o.linhas.map((l) => o.colunas.map((c) => celulaTexto(c, l))),
    totais: o.totais ?? [],
  });
}
