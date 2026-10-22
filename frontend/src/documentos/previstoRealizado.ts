import { formatBRL } from "@/lib/format";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import { barrasSvg, blocoGrafico } from "@/lib/documento/graficos";
import type { Bloco, Documento } from "@/lib/documento/tipos";
import { pctTexto } from "@/components/previsto-realizado/TabelaComparativo";
import { nomeParaRelatorio } from "@/domain/condominio";
import type { ResultadoComparativo } from "@/domain/previstoRealizado";
import type { Condominio, ConfigEscritorio, Exercicio } from "@/domain/types";
import { timbreDoEscritorio } from "./comum";
import { tabelaComparativo } from "./relatorioFinal";
import { contagem } from "@/components/app/textos";

/** Previsto × Realizado avulso: só desenha o que `compararPrevistoRealizado` já calculou. */
export async function documentoPrevistoRealizado(o: {
  comparativo: ResultadoComparativo;
  exercicio: Exercicio;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
}): Promise<Documento> {
  const { comparativo: c, exercicio: e, condominio, escritorio } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : e.condoNome || "Condomínio";
  const b: Bloco[] = [
    { tipo: "paragrafo", texto: "PREVISTO × REALIZADO", suave: true },
    { tipo: "titulo", nivel: 1, texto: nome },
    {
      tipo: "paragrafo",
      suave: true,
      texto: `Previsão ${e.ano} × realizado de ${c.meses[0]?.rotulo ?? "—"} a ${c.mesAte.rotulo} (${contagem(c.relatoriosUsados, "relatório mensal", "relatórios mensais")}).`,
    },
    {
      tipo: "tabela",
      semCabecalho: true,
      fundo: true,
      colunas: [{ titulo: "", largura: "*" }, { titulo: "Valor", largura: 150, alinhamento: "direita" }],
      linhas: [
        { celulas: ["Previsto anual", formatBRL(c.total.previstoAnual)] },
        { celulas: [`Previsto até ${c.mesAte.rotulo}`, formatBRL(c.total.previsto)] },
        { celulas: [`Realizado até ${c.mesAte.rotulo}`, formatBRL(c.total.realizado)] },
        { celulas: ["Diferença", `${formatBRL(c.total.diferenca)} (${pctTexto(c.total.pct)})`], estilo: "total" },
      ],
    },
  ];
  if (c.avisos.length) b.push({ tipo: "paragrafo", texto: c.avisos.join(" "), suave: true });
  if (c.grupos.length === 0) {
    b.push({ tipo: "paragrafo", texto: "A previsão deste exercício não tem despesas lançadas.", suave: true });
  } else {
    b.push({ tipo: "titulo", nivel: 2, texto: "Por rubrica e grupo" }, ...tabelaComparativo(c));
    const grafico = barrasSvg(
      c.grupos.map((g) => g.nome || "Sem grupo"),
      [
        { nome: "Previsto", cor: "#8fa3c0", valores: c.grupos.map((g) => g.totais.previsto) },
        { nome: "Realizado", cor: "#0b3a5e", valores: c.grupos.map((g) => g.totais.realizado) },
      ],
    );
    b.push(
      { tipo: "titulo", nivel: 2, texto: "Previsto × realizado por grupo" },
      await blocoGrafico(grafico),
    );
  }
  return {
    titulo: `Previsto × Realizado ${e.ano} — ${nome}`,
    arquivo: nomeDeArquivo("previsto-realizado", condominio?.codigo || nome, `${e.ano}-ate-${c.mesAte.rotulo.replace("/", "-")}`),
    timbre: timbreDoEscritorio(escritorio),
    rodape: `${nome} · Previsto × Realizado ${e.ano}`,
    blocos: b,
  };
}
