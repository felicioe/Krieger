import { formatBRL } from "@/lib/format";
import { somar } from "@/domain/demonstrativo";
import type { ConfigEscritorio, Demonstrativo, LinhaValor } from "@/domain/types";
import type { Bloco, LinhaTabela, Timbre } from "@/lib/documento/tipos";

/**
 * Peças de layout compartilhadas pelos documentos. Só apresentam dados já prontos
 * (formatação via `@/lib/format`); nenhum cálculo de negócio aqui.
 */

/** Papel timbrado a partir do cadastro do Escritório. */
export function timbreDoEscritorio(e: ConfigEscritorio | null | undefined): Timbre | null {
  if (!e) return null;
  return {
    logo: e.logo ? { dataUrl: e.logo, ratio: e.logoRatio || 3 } : null,
    nome: e.nome?.trim() ?? "",
    rodape: e.rodape?.trim() ?? "",
  };
}

const linha = (nome: string, valor: number | null, o: Partial<LinhaTabela> = {}): LinhaTabela => ({
  celulas: [nome, formatBRL(valor)],
  ...o,
});

const contas = (titulo: string, linhas: LinhaValor[], total: number): LinhaTabela[] => [
  { celulas: [titulo], estilo: "grupo" },
  ...linhas.map((l) => linha(l.nome, l.valor, { recuo: true })),
  linha(`Total ${titulo.toLowerCase()}`, total, { estilo: "total" }),
];

/** Demonstrativo de receitas e despesas (mesma ordem da prévia na tela). */
export function blocosDemonstrativo(d: Demonstrativo): Bloco[] {
  const colunas = [
    { titulo: "Descrição", largura: "*" as const },
    { titulo: "Valor", largura: 110, alinhamento: "direita" as const },
  ];
  const despesas: LinhaTabela[] = [{ celulas: ["Despesas"], estilo: "grupo" }];
  for (const g of d.despesas.grupos) {
    despesas.push({ celulas: [g.nome || "Sem grupo"], estilo: "subtotal" });
    despesas.push(...g.itens.map((i) => linha(i.nome, i.valor, { recuo: true })));
    despesas.push(linha(`Subtotal ${g.nome || "sem grupo"}`, somar(g.itens), { estilo: "subtotal", recuo: true }));
  }
  despesas.push(linha("Total das despesas", d.totais.despesas, { estilo: "total" }));

  return [
    {
      tipo: "tabela",
      colunas,
      linhas: [
        ...contas("Saldo anterior", d.saldoAnterior.contas, d.totais.saldoAnterior),
        ...contas("Receitas", d.receitas.itens, d.totais.receitas),
        ...despesas,
        ...contas("Saldo atual", d.saldoAtual.contas, d.totais.saldoAtual),
      ],
    },
    {
      tipo: "tabela",
      colunas,
      semCabecalho: true,
      fundo: true,
      linhas: [
        linha("Saldo anterior", d.totais.saldoAnterior),
        linha("(+) Receitas", d.totais.receitas),
        linha("(−) Despesas", d.totais.despesas),
        linha("(=) Saldo atual", d.totais.saldoAtual, { estilo: "total" }),
      ],
    },
  ];
}

/** "Cidade, dd/mm/aaaa." (só o que estiver preenchido). */
export const localEData = (cidade: string, data: string) => {
  const t = [cidade.trim(), data.trim()].filter(Boolean).join(", ");
  return t ? `${t}.` : "";
};

/** Quebra um texto livre em parágrafos (linhas em branco separam parágrafos). */
export function paragrafos(texto: string, o: Partial<Extract<Bloco, { tipo: "paragrafo" }>> = {}): Bloco[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ tipo: "paragrafo" as const, texto: p, alinhamento: "justificado" as const, ...o }));
}
