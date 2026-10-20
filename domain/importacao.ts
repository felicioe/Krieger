/**
 * Importação dos PDFs do Systemar: converte a saída de `lerRelatorio` (pdfParser.ts) no
 * `Demonstrativo` dos editores, localiza o condomínio e monta o registro de staging
 * (store `importacoes`) quando o condomínio ainda não existe.
 *
 * Interpretações do agente (não confirmadas pelo usuário), isoladas aqui para mudar sem schema:
 * - Linhas de subtotal e linhas sem valor na coluna escolhida não viram itens (os totais são
 *   recalculados pelo editor).
 * - Despesas: o grupo é o caminho de grupos do item; níveis comuns a todos os itens da seção são
 *   omitidos e os demais unidos por " / ". Itens sem grupo vão para "Despesas".
 * - Receitas e contas de saldo ficam numa lista única, com a descrição do PDF.
 * - Comparativo: o usuário escolhe um mês ou o total do período. No total, receitas e despesas usam
 *   a coluna Total (ou a soma dos meses, se faltar); o saldo anterior vem do primeiro mês e o saldo
 *   atual do último.
 */
import { condominioPadrao, nomeParaRelatorio } from "./condominio";
import { exercicioPadrao } from "./exercicio";
import { centavos, demonstrativoVazio, recalcularDemonstrativo } from "./demonstrativo";
import { competenciaMensal, mensalPadrao, periodoDoMes, type Competencia } from "./mensal";
import {
  cadastroBasico,
  type ConsideracoesFinaisLidas,
  type ItemLido,
  type PrevisaoSugeridaLida,
  type RelatorioLido,
  type SecaoLida,
} from "./pdfParser";
import type { Condominio, Demonstrativo, DestinoImportacao, Exercicio, Importacao, LinhaValor, Mensal } from "./types";

export const COLUNA_TOTAL = "total";

export const ROTULO_LAYOUT: Record<RelatorioLido["layout"], string> = {
  dre_simples: "Demonstrativo simples (período único)",
  demonstrativo_hierarquico: "Demonstrativo por grupos (período único)",
  comparativo: "Comparativo mensal",
};

/** Colunas que o usuário pode escolher (só no comparativo). */
export function colunasDoRelatorio(rel: RelatorioLido): { valor: string; rotulo: string }[] {
  if (rel.layout !== "comparativo") return [];
  return [
    ...(rel.meses ?? []).map((m) => ({ valor: m, rotulo: m })),
    { valor: COLUNA_TOTAL, rotulo: "Total do período" },
  ];
}

/** Sugestão inicial: último mês no relatório mensal; total do período na prestação de contas. */
export function colunaPadrao(rel: RelatorioLido, destino: DestinoImportacao): string | null {
  if (rel.layout !== "comparativo") return null;
  const meses = rel.meses ?? [];
  return destino === "mensais" && meses.length ? meses[meses.length - 1]! : COLUNA_TOTAL;
}

const isoParaBR = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

function mesAno(t: string | undefined): { mes: number; ano: number } | null {
  const m = /^(\d{2})\/(\d{4})$/.exec(t ?? "");
  return m ? { mes: Number(m[1]), ano: Number(m[2]) } : null;
}

/** Período (dd/mm/aaaa) correspondente à coluna escolhida. */
export function periodoImportado(rel: RelatorioLido, coluna: string | null): { ini: string; fim: string } {
  const p = rel.periodo;
  if (p && "inicio" in p) return { ini: isoParaBR(p.inicio), fim: isoParaBR(p.fim) };
  const meses = rel.meses ?? [];
  if (coluna && coluna !== COLUNA_TOTAL) {
    const c = mesAno(coluna);
    return c ? periodoDoMes(c) : { ini: "", fim: "" };
  }
  const ini = mesAno(p && "competenciaInicio" in p ? p.competenciaInicio : meses[0]);
  const fim = mesAno(p && "competenciaFim" in p ? p.competenciaFim : meses[meses.length - 1]);
  return { ini: ini ? periodoDoMes(ini).ini : "", fim: fim ? periodoDoMes(fim).fim : "" };
}

/** Ano do fim do período (sugestão para o exercício). */
export function anoDoRelatorio(rel: RelatorioLido, coluna: string | null): number | null {
  const m = /\/(\d{4})$/.exec(periodoImportado(rel, coluna).fim);
  return m ? Number(m[1]) : null;
}

type NomeSecao = "saldoAnterior" | "receitas" | "despesas" | "saldoAtual";

function valorDoItem(item: ItemLido, rel: RelatorioLido, coluna: string | null, secao: NomeSecao): number | null {
  if (rel.layout !== "comparativo") return item.valor ?? null;
  const meses = rel.meses ?? [];
  const v = item.valores ?? {};
  if (coluna && coluna !== COLUNA_TOTAL) return v[coluna] ?? null;
  if (secao === "saldoAnterior") return meses.length ? (v[meses[0]!] ?? null) : null;
  if (secao === "saldoAtual") return meses.length ? (v[meses[meses.length - 1]!] ?? null) : null;
  if (item.total != null) return item.total;
  const vs = Object.values(v);
  return vs.length ? centavos(vs.reduce((a, b) => a + b, 0)) : null;
}

function linhas(secao: SecaoLida | undefined, rel: RelatorioLido, coluna: string | null, nome: NomeSecao) {
  return (secao?.itens ?? [])
    .filter((i) => !i.subtotal)
    .map((i) => ({ item: i, valor: valorDoItem(i, rel, coluna, nome) }))
    .filter((x): x is { item: ItemLido; valor: number } => x.valor != null);
}

const comoLinhas = (l: { item: ItemLido; valor: number }[]): LinhaValor[] =>
  l.map((x) => ({ nome: x.item.descricao, valor: x.valor }));

/** Agrupa as despesas pelo caminho de grupos, omitindo os níveis comuns a todas. */
function gruposDeDespesas(l: { item: ItemLido; valor: number }[]): Demonstrativo["despesas"]["grupos"] {
  const caminhos = l.map((x) => x.item.grupo);
  let comum = 0;
  if (caminhos.length) {
    const menor = Math.min(...caminhos.map((c) => c.length));
    while (comum < menor && caminhos.every((c) => c[comum] === caminhos[0]![comum])) comum++;
  }
  // Se todos os itens ficariam sem grupo, mantém o último nível comum como nome.
  if (comum > 0 && caminhos.every((c) => c.length === comum)) comum--;
  const grupos: Demonstrativo["despesas"]["grupos"] = [];
  for (const x of l) {
    const nome = x.item.grupo.slice(comum).join(" / ") || "Despesas";
    let g = grupos.find((y) => y.nome === nome);
    if (!g) grupos.push((g = { nome, itens: [] }));
    g.itens.push({ nome: x.item.descricao, valor: x.valor });
  }
  return grupos;
}

/** Demonstrativo do editor a partir do relatório lido (e da coluna escolhida, no comparativo). */
export function demonstrativoDoRelatorio(rel: RelatorioLido, coluna: string | null, condominio = ""): Demonstrativo {
  const v = demonstrativoVazio(condominio);
  return recalcularDemonstrativo({
    ...v,
    periodo: periodoImportado(rel, coluna),
    saldoAnterior: { contas: comoLinhas(linhas(rel.saldoAnterior, rel, coluna, "saldoAnterior")), total: 0 },
    receitas: { itens: comoLinhas(linhas(rel.receitas, rel, coluna, "receitas")), subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: gruposDeDespesas(linhas(rel.despesas, rel, coluna, "despesas")), subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: comoLinhas(linhas(rel.saldoAtual, rel, coluna, "saldoAtual")), total: 0 },
  });
}

/** Resultado da conferência automática do parser, em frases. */
export function resumoConferencia(rel: RelatorioLido): { ok: boolean; mensagens: string[] } {
  const c = rel.conferencia;
  if (!c) return { ok: true, mensagens: [] };
  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if ("divergentes" in c) {
    return {
      ok: c.divergentes.length === 0,
      mensagens: c.divergentes.map(
        (d) => `${d.secao === "receitas" ? "Receita" : "Despesa"} "${d.descricao}": soma dos meses R$ ${fmt(d.somaMeses)} × total R$ ${fmt(d.total)}.`,
      ),
    };
  }
  const nomes: Record<NomeSecao, string> = {
    saldoAnterior: "Saldo anterior",
    receitas: "Receitas",
    despesas: "Despesas",
    saldoAtual: "Saldo atual",
  };
  const mensagens: string[] = [];
  for (const k of Object.keys(nomes) as NomeSecao[]) {
    const x = c[k];
    if (x && !x.confere) mensagens.push(`${nomes[k]}: soma dos itens R$ ${fmt(x.somaItens)} × total do relatório R$ ${fmt(x.totalRelatorio)}.`);
  }
  return { ok: mensagens.length === 0, mensagens };
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const codigoNormal = (s: string | null | undefined) => {
  const d = digitos(s);
  return d ? d.padStart(3, "0") : "";
};

/** Condomínio já cadastrado com o mesmo código ou o mesmo CNPJ do relatório. */
export function encontrarCondominio<C extends Pick<Condominio, "codigo" | "cnpj">>(
  condominios: C[],
  dados: { codigo: string | null; cnpj: string | null },
): C | null {
  const cod = codigoNormal(dados.codigo);
  const cnpj = digitos(dados.cnpj);
  return (
    (cod ? condominios.find((c) => codigoNormal(c.codigo) === cod) : undefined) ??
    (cnpj ? condominios.find((c) => digitos(c.cnpj) === cnpj) : undefined) ??
    null
  );
}

/** Registro de staging de um relatório de condomínio ainda não cadastrado. */
export function novaImportacao(
  rel: RelatorioLido,
  arquivo: string,
  destino: DestinoImportacao,
  agora = new Date(),
): Omit<Importacao, "id"> {
  return {
    status: "pendente",
    arquivo,
    importadoEm: agora.toISOString(),
    relatorio: rel,
    cadastro: cadastroBasico(rel),
    condominioId: null,
    destino,
  };
}

/** Campos do cadastro básico que o PDF não trouxe. */
export function camposFaltando(c: { codigo: string | null; nome: string | null; cnpj: string | null }) {
  return (["codigo", "nome", "cnpj"] as const).filter((k) => !(c[k] ?? "").trim());
}

/** Condomínio novo com o cadastro básico conferido; o resto fica com os padrões. */
export function condominioDoCadastro(c: { codigo: string | null; nome: string | null; cnpj: string | null }): Omit<Condominio, "id"> {
  const nome = (c.nome ?? "").trim();
  return { ...condominioPadrao(), codigo: (c.codigo ?? "").trim(), nome, nomeRelatorio: nome, cnpj: (c.cnpj ?? "").trim() };
}

/** Acrescenta o arquivo à origem do relatório, sem repetir. */
export function origemComArquivo(origem: string[] | string | null | undefined, arquivo: string): string[] {
  const lista = Array.isArray(origem) ? origem : origem ? [origem] : [];
  return lista.includes(arquivo) ? lista : [...lista, arquivo];
}

/** Contas a receber do PDF, só quando a data delas cai dentro do período importado. */
export function receberDoRelatorio(rel: RelatorioLido, coluna: string | null): Mensal["receber"] | null {
  const cr = rel.contasAReceber;
  if (!cr) return null;
  const p = periodoImportado(rel, coluna);
  const iso = (br: string) => br.split("/").reverse().join("-");
  if (p.ini && cr.ate < iso(p.ini)) return null;
  if (p.fim && cr.ate > iso(p.fim)) return null;
  return { unidades: cr.unidades, valor: cr.total };
}

/** Relatório mensal novo com o demonstrativo (e contas a receber) do PDF. */
export function mensalImportado(
  condo: Condominio,
  rel: RelatorioLido,
  coluna: string | null,
  arquivo: string,
): { registro: Omit<Mensal, "id">; competencia: Competencia | null } {
  const demonstrativo = demonstrativoDoRelatorio(rel, coluna, nomeParaRelatorio(condo));
  const competencia = competenciaMensal({ demonstrativo });
  const base = mensalPadrao(condo, competencia ?? { mes: 1, ano: 1900 });
  return {
    registro: {
      ...base,
      demonstrativo,
      origem: [arquivo],
      receber: receberDoRelatorio(rel, coluna) ?? base.receber,
    },
    competencia,
  };
}

/**
 * Aplica o que foi lido de "Considerações finais" e "Previsão orçamentária sugerida" (quando o PDF
 * trouxer essas páginas) sobre o `consid` de um exercício — administração, contas a receber/pagar,
 * seguro, manutenções e índices de correção vêm de `cf`; os números da previsão sugerida pelo
 * Systemar (rateio e índice sugeridos) não substituem o cálculo próprio (domain/previsao.ts), só
 * ficam registrados em `extras` como referência pro usuário conferir.
 */
export function aplicarConsideracoesAoExercicio(
  consid: Exercicio["consid"],
  cf: ConsideracoesFinaisLidas | null,
  pv: PrevisaoSugeridaLida | null,
): Exercicio["consid"] {
  let out = consid;
  if (cf) {
    out = {
      ...out,
      administracao: cf.administracao,
      contasReceber: cf.contasReceber,
      contasPagar: cf.contasPagar,
      seguradora: cf.seguradora ?? out.seguradora,
      vigenciaSeguro: cf.vigenciaSeguro ?? out.vigenciaSeguro,
      seguro: cf.seguro.riscoAbsoluto != null || cf.seguro.coberturas.length ? cf.seguro : out.seguro,
      ultGordura: cf.ultGordura ?? out.ultGordura,
      ultDedetizacao: cf.ultDedetizacao ?? out.ultDedetizacao,
      ultCaixaDagua: cf.ultCaixaDagua ?? out.ultCaixaDagua,
      indices: cf.indices.length ? cf.indices : out.indices,
    };
  }
  if (pv) {
    const extras: Exercicio["consid"]["extras"] = [...out.extras];
    const add = (rotulo: string, valor: number | null) => {
      if (valor != null) extras.push({ rotulo, valor });
    };
    add("Rateio mensal sugerido (Systemar)", pv.rateioMensalSugerido);
    add("Índice sugerido para correção (Systemar)", pv.indiceSugerido);
    add("Total de despesas consideradas ordinárias (Systemar)", pv.totalOrdinario);
    out = { ...out, extras };
  }
  return out;
}

/** Prestação de contas nova com o demonstrativo do PDF. */
export function exercicioImportado(
  condo: Condominio,
  ano: number,
  cidade: string,
  rel: RelatorioLido,
  coluna: string | null,
  arquivo: string,
): Omit<Exercicio, "id"> {
  return {
    ...exercicioPadrao(condo, ano, cidade),
    demonstrativo: demonstrativoDoRelatorio(rel, coluna, nomeParaRelatorio(condo)),
    origem: [arquivo],
  };
}
