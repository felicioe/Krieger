import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Coluna, Documento, LinhaTabela } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import type { Condominio, ConfigEscritorio } from "@/domain/types";
import {
  colunasComparativoDespesas,
  rodapeComparativoDespesas,
  type ResultadoComparativoDespesas,
} from "@/domain/comparativoDespesas";
import { celulaTexto } from "@/lib/exportar";
import { timbreDoEscritorio } from "./comum";

/**
 * Comparativo de despesas entre exercícios em PDF/Word, A4 paisagem (#252). Mesmas colunas da tela
 * e do CSV/XLSX; só apresenta o que o domínio calculou.
 */
export function documentoComparativoDespesas(o: {
  resultado: ResultadoComparativoDespesas;
  analitico: boolean;
  condominio: Condominio | null;
  nomeCondominio: string;
  escritorio: ConfigEscritorio | null;
}): Documento {
  const { resultado: r, analitico, condominio, escritorio } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : o.nomeCondominio;
  const periodo = r.anos.length ? `${r.anos[0]} a ${r.anos.at(-1)}` : "—";
  const colunas = colunasComparativoDespesas(r, analitico);
  const fixas = analitico ? 2 : 1;
  const larguraTexto = analitico ? 110 : 160;
  const larguraNumero = Math.max(
    60,
    Math.floor((760 - larguraTexto * fixas) / Math.max(1, colunas.length - fixas)),
  );
  const colunasDoc: Coluna[] = colunas.map((c, i) => ({
    titulo: c.titulo,
    largura: i < fixas ? larguraTexto : larguraNumero,
    ...(c.alinhamento === "direita" ? { alinhamento: "direita" as const } : {}),
  }));
  const linhas: LinhaTabela[] = [
    ...r.linhas.map((l) => ({ celulas: colunas.map((c) => celulaTexto(c, l)) })),
    { celulas: rodapeComparativoDespesas(r, analitico), estilo: "total" as const },
  ];
  const blocos: Bloco[] = [
    {
      tipo: "paragrafo",
      texto: "COMPARATIVO DE DESPESAS ENTRE EXERCÍCIOS",
      tamanho: "pequeno",
      suave: true,
      negrito: true,
    },
    { tipo: "titulo", nivel: 1, texto: nome || "Condomínio" },
    {
      tipo: "pares",
      itens: [
        { rotulo: "Exercícios", valor: periodo },
        { rotulo: "Detalhe", valor: analitico ? "Por rubrica" : "Por grupo" },
      ],
    },
    {
      tipo: "paragrafo",
      texto:
        "Células vazias indicam que o grupo não existe naquele exercício. A variação compara o primeiro e o último exercício do período.",
      suave: true,
      tamanho: "pequeno",
    },
    { tipo: "tabela", pequena: true, colunas: colunasDoc, linhas },
  ];
  return {
    titulo: `Comparativo de despesas — ${nome}`,
    arquivo: nomeDeArquivo("comparativo-despesas", nome, periodo.replaceAll(" ", "")),
    orientacao: "paisagem",
    timbre: timbreDoEscritorio(escritorio),
    rodape: `Comparativo de despesas · ${nome} · ${periodo}`,
    blocos,
  };
}
