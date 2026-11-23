import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Coluna, Documento, LinhaTabela } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import type { Condominio, ConfigEscritorio } from "@/domain/types";
import {
  colunasInadimplencia,
  rodapeInadimplencia,
  type ResultadoInadimplencia,
} from "@/domain/inadimplencia";
import { celulaTexto } from "@/lib/exportar";
import { contagem } from "@/components/app/textos";
import { timbreDoEscritorio } from "./comum";

/**
 * Evolução da inadimplência em PDF/Word, A4 paisagem (#251). Usa as mesmas colunas do CSV/XLSX e
 * da tela, então os três nunca divergem. Só apresenta o que o domínio já calculou.
 */
export function documentoInadimplencia(o: {
  resultado: ResultadoInadimplencia;
  condominio: Condominio | null;
  nomeCondominio: string;
  escritorio: ConfigEscritorio | null;
}): Documento {
  const { resultado: r, condominio, escritorio } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : o.nomeCondominio;
  const periodo = `${r.linhas[0]?.rotulo ?? "—"} a ${r.linhas.at(-1)?.rotulo ?? "—"}`;
  const colunas = colunasInadimplencia();

  const colunasDoc: Coluna[] = colunas.map((c, i) => ({
    titulo: c.titulo,
    largura: i === 0 ? 70 : 130,
    ...(c.alinhamento === "direita" ? { alinhamento: "direita" as const } : {}),
  }));
  const linhas: LinhaTabela[] = [
    ...r.linhas.map((l) => ({ celulas: colunas.map((c) => celulaTexto(c, l)) })),
    { celulas: rodapeInadimplencia(r), estilo: "total" as const },
  ];

  const blocos: Bloco[] = [
    {
      tipo: "paragrafo",
      texto: "EVOLUÇÃO DA INADIMPLÊNCIA",
      tamanho: "pequeno",
      suave: true,
      negrito: true,
    },
    { tipo: "titulo", nivel: 1, texto: nome || "Condomínio" },
    {
      tipo: "pares",
      itens: [
        { rotulo: "Período", valor: periodo },
        {
          rotulo: "Relatórios mensais",
          valor: contagem(r.mesesComDados, "mês com relatório", "meses com relatório"),
        },
      ],
    },
    ...r.avisos.map((aviso) => ({
      tipo: "paragrafo" as const,
      texto: `${aviso} Esses meses aparecem como "Sem dados".`,
      suave: true,
      tamanho: "pequeno" as const,
    })),
    { tipo: "tabela", pequena: true, colunas: colunasDoc, linhas },
  ];

  return {
    titulo: `Evolução da inadimplência — ${nome}`,
    arquivo: nomeDeArquivo("inadimplencia", nome, periodo.replaceAll("/", "-")),
    orientacao: "paisagem",
    timbre: timbreDoEscritorio(escritorio),
    rodape: `Evolução da inadimplência · ${nome} · ${periodo}`,
    blocos,
  };
}
