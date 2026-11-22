import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Coluna, Documento, LinhaTabela } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import type { Condominio, ConfigEscritorio, Exercicio, Mensal } from "@/domain/types";
import type { ResultadoMensalDetalhado } from "@/domain/previstoRealizadoMensal";
import {
  colunasMensalExport,
  linhasMensalExport,
  type OpcoesMensalExport,
} from "@/lib/colunasRelatorios";
import { celulaTexto } from "@/lib/exportar";
import { contagem } from "@/components/app/textos";
import { timbreDoEscritorio } from "./comum";

/**
 * Previsto × Realizado mensal em PDF/Word, em A4 **paisagem**: são até 12 meses
 * com previsto, realizado e as duas análises, o que não cabe em retrato.
 *
 * A tabela é montada a partir das mesmas colunas do CSV/XLSX, então a tela, a
 * planilha e o PDF nunca divergem. Só apresenta o que o domínio já calculou.
 */
export function documentoPrevistoRealizadoMensal(o: {
  resultado: ResultadoMensalDetalhado;
  exercicio: Exercicio;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
  mensais: Mensal[];
  opcoes: OpcoesMensalExport;
}): Documento {
  const { resultado: r, exercicio: e, condominio, escritorio, opcoes } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : e.condoNome;
  const periodo = `${r.meses[0]?.rotulo ?? "—"} a ${r.meses.at(-1)?.rotulo ?? "—"}`;
  const faltantes = r.meses.filter((mes) => mes.relatorios === 0);

  const colunas = colunasMensalExport(r, opcoes);
  const linhasExport = linhasMensalExport(r);

  // Largura por coluna em pt: a rubrica fica com o texto; os meses dividem o resto.
  const numericas = colunas.length - 1;
  const larguraRubrica = 120;
  const larguraMes = Math.max(34, Math.floor((760 - larguraRubrica) / Math.max(1, numericas)));

  const colunasDoc: Coluna[] = colunas.map((c, i) => ({
    titulo: c.titulo,
    largura: i === 0 ? larguraRubrica : larguraMes,
    ...(c.alinhamento === "direita" ? { alinhamento: "direita" as const } : {}),
  }));

  const linhas: LinhaTabela[] = linhasExport.map((l, i) => ({
    celulas: colunas.map((c) => celulaTexto(c, l)),
    ...(i === linhasExport.length - 1 ? { estilo: "total" as const } : {}),
  }));

  const blocos: Bloco[] = [
    {
      tipo: "paragrafo",
      texto: "PREVISTO × REALIZADO MENSAL",
      tamanho: "pequeno",
      suave: true,
      negrito: true,
    },
    { tipo: "titulo", nivel: 1, texto: nome || "Condomínio" },
    {
      tipo: "pares",
      itens: [
        { rotulo: "Previsão", valor: `Exercício ${String(e.ano)}` },
        { rotulo: "Período", valor: periodo },
        {
          rotulo: "Relatórios mensais",
          valor: contagem(r.relatoriosUsados, "relatório considerado", "relatórios considerados"),
        },
        { rotulo: "Colunas", valor: rotuloColunas(opcoes) },
      ],
    },
    ...(faltantes.length
      ? [
          {
            tipo: "paragrafo" as const,
            texto: `Sem relatório mensal em: ${faltantes.map((m) => m.rotulo).join(", ")}. O realizado acumulado é parcial; meses ausentes aparecem como "Sem dados", sem variação calculada.`,
            suave: true,
            tamanho: "pequeno" as const,
          },
        ]
      : []),
    { tipo: "tabela", pequena: true, colunas: colunasDoc, linhas },
  ];

  return {
    titulo: `Previsto × Realizado mensal — ${nome}`,
    arquivo: nomeDeArquivo("previsto-realizado-mensal", nome, e.ano),
    orientacao: "paisagem",
    timbre: timbreDoEscritorio(escritorio),
    rodape: `Previsto × Realizado mensal · ${nome} · ${periodo}`,
    blocos,
  };
}

function rotuloColunas(o: OpcoesMensalExport): string {
  const partes = [
    o.orcado ? "previsto" : null,
    "realizado",
    o.horizontal ? "análise horizontal" : null,
    o.vertical ? "análise vertical" : null,
  ];
  return partes.filter(Boolean).join(" · ");
}
