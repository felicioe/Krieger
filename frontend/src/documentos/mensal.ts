import { formatBRL } from "@/lib/format";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Documento } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import { competenciaMensal, rotuloCompetencia } from "@/domain/mensal";
import type { Condominio, ConfigEscritorio, Mensal } from "@/domain/types";
import { blocosDemonstrativo, timbreDoEscritorio } from "./comum";

/** Relatório mensal: demonstrativo do mês, contas a receber e notas explicativas. */
export function documentoMensal(o: { mensal: Mensal; condominio: Condominio | null; escritorio: ConfigEscritorio | null }): Documento {
  const { mensal: m, condominio } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : m.condoNome;
  const comp = rotuloCompetencia(competenciaMensal(m));
  const d = m.demonstrativo;
  const notas = m.notas.filter((n) => n.rubrica.trim() || n.texto.trim() || n.valor !== null);

  const blocos: Bloco[] = [
    { tipo: "paragrafo", texto: "RELATÓRIO MENSAL", tamanho: "pequeno", suave: true, negrito: true },
    { tipo: "titulo", nivel: 1, texto: nome || "Condomínio" },
    {
      tipo: "paragrafo",
      suave: true,
      texto: [
        condominio?.cnpj ? `CNPJ ${condominio.cnpj}` : "",
        `Competência ${comp}`,
        d?.periodo.ini && d.periodo.fim ? `Período de ${d.periodo.ini} a ${d.periodo.fim}` : "",
      ]
        .filter(Boolean)
        .join("  ·  "),
    },

    { tipo: "titulo", nivel: 2, texto: "1. Demonstrativo de receitas e despesas" },
    ...(d ? blocosDemonstrativo(d) : [{ tipo: "paragrafo" as const, texto: "Sem demonstrativo.", suave: true }]),

    { tipo: "titulo", nivel: 2, texto: "2. Contas a receber" },
    {
      tipo: "pares",
      itens: [
        {
          rotulo: "Unidades inadimplentes",
          valor:
            m.receber.unidades === null
              ? "Não informado"
              : `${m.receber.unidades}${condominio?.unidades ? ` de ${condominio.unidades} unidades` : ""}`,
        },
        { rotulo: "Valor total a receber", valor: m.receber.valor === null ? "Não informado" : formatBRL(m.receber.valor) },
      ],
    },

    { tipo: "titulo", nivel: 2, texto: "3. Notas explicativas" },
    ...(notas.length
      ? notas.flatMap((n, i): Bloco[] => [
          {
            tipo: "paragrafo",
            texto: [
              { texto: `${i + 1}. ${n.rubrica.trim() || "Nota"}`, negrito: true },
              ...(n.valor !== null ? [{ texto: `  ·  ${formatBRL(n.valor)}`, suave: true }] : []),
            ],
          },
          ...(n.texto.trim() ? [{ tipo: "paragrafo" as const, texto: n.texto.trim(), recuo: true, alinhamento: "justificado" as const }] : []),
        ])
      : [{ tipo: "paragrafo" as const, texto: "Nenhuma nota explicativa neste mês.", suave: true }]),
  ];

  return {
    titulo: `Relatório mensal ${comp} — ${nome}`,
    arquivo: nomeDeArquivo("relatorio-mensal", condominio?.codigo || nome, comp.replace("/", "-")),
    timbre: timbreDoEscritorio(o.escritorio),
    rodape: `${nome} · Relatório mensal ${comp}`,
    blocos,
  };
}
