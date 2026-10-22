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
import { formatBRL } from "../lib/format";
import { competenciaMensal, mensalPadrao, periodoDoMes, type Competencia } from "./mensal";
import {
  cadastroBasico,
  type ConsideracoesFinaisLidas,
  type ItemLido,
  type PrevisaoSugeridaLida,
  type RelatorioLido,
  type SecaoLida,
} from "./pdfParser";
import type {
  AnexoImportado,
  Condominio,
  Demonstrativo,
  DestinoImportacao,
  Exercicio,
  Importacao,
  LinhaValor,
  Mensal,
  TipoAnexoImportacao,
} from "./types";

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
export type EstadoConferencia = "nao_verificado" | "parcial" | "verificado" | "divergente";
export function resumoConferencia(rel: RelatorioLido): {
  ok: boolean; estado: EstadoConferencia; comparacoes: number; esperadas: number; mensagens: string[];
} {
  const c = rel.conferencia;
  const finalizar = (comparacoes: number, esperadas: number, mensagens: string[]) => {
    const estado: EstadoConferencia = mensagens.length ? "divergente"
      : comparacoes === 0 ? "nao_verificado" : comparacoes < esperadas ? "parcial" : "verificado";
    return { ok: estado === "verificado", estado, comparacoes, esperadas, mensagens };
  };
  const esperadasComparativo = [rel.receitas, rel.despesas].reduce((s, secao) => s + (secao?.itens.length ?? 0), 0);
  if (!c) return finalizar(0, rel.layout === "comparativo" ? esperadasComparativo : 4, []);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if ("divergentes" in c) {
    return finalizar(c.linhasConferidas, Math.max(c.linhasConferidas, esperadasComparativo), c.divergentes.map(
        (d) => `${d.secao === "receitas" ? "Receita" : "Despesa"} "${d.descricao}": soma dos meses R$ ${fmt(d.somaMeses)} × total R$ ${fmt(d.total)}.`,
      ));
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
  return finalizar(Object.values(c).filter(Boolean).length, 4, mensagens);
}

export interface DivergenciaImportacao {
  campo: "saldoAnterior" | "receitas" | "despesas" | "saldoAtual";
  rotulo: string;
  importado: number;
  atual: number;
  /** Variação percentual sobre o valor importado; `null` quando o importado é zero (percentual indefinido). */
  diferencaPct: number | null;
}

const CAMPOS_DIVERGENCIA: { campo: DivergenciaImportacao["campo"]; rotulo: string; valor: (d: Demonstrativo) => number }[] = [
  { campo: "saldoAnterior", rotulo: "Saldo anterior", valor: (d) => d.saldoAnterior.total },
  { campo: "receitas", rotulo: "Receitas", valor: (d) => d.receitas.subtotal },
  { campo: "despesas", rotulo: "Despesas", valor: (d) => d.despesas.subtotal },
  { campo: "saldoAtual", rotulo: "Saldo atual", valor: (d) => d.saldoAtual.total },
];

/**
 * Compara os totais do demonstrativo tal como foi importado do PDF (`original`, o que
 * `demonstrativoDoRelatorio` devolveu) com o demonstrativo tal como está prestes a ser gravado
 * (`atual`, já com as edições do usuário na tela de revisão). Pensado para rodar uma única vez, no
 * momento de salvar logo após uma importação — não a cada edição subsequente do registro já salvo,
 * que são alterações legítimas e não "divergências da importação".
 */
export function divergenciasImportacao(original: Demonstrativo, atual: Demonstrativo): DivergenciaImportacao[] {
  const divergencias: DivergenciaImportacao[] = [];
  for (const c of CAMPOS_DIVERGENCIA) {
    const importado = c.valor(original);
    const valorAtual = c.valor(atual);
    if (importado !== valorAtual) {
      divergencias.push({
        campo: c.campo,
        rotulo: c.rotulo,
        importado,
        atual: valorAtual,
        diferencaPct: importado !== 0 ? Math.round(((valorAtual - importado) / importado) * 1000) / 10 : null,
      });
    }
  }
  return divergencias;
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const codigoNormal = (s: string | null | undefined) => {
  const d = digitos(s);
  return d ? d.padStart(3, "0") : "";
};
const chaveNome = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Condomínio já cadastrado com o mesmo código ou o mesmo CNPJ do relatório. Quando o PDF não traz
 * nem código nem CNPJ (alguns relatórios não têm esses campos), cai para o nome completo — só
 * nesse caso, e só por igualdade exata (sem acento/maiúscula) do nome ou nome de relatório, pra não
 * arriscar confundir dois condomínios parecidos quando dá pra identificar com segurança por
 * código/CNPJ.
 */
export function encontrarCondominio<C extends Pick<Condominio, "codigo" | "cnpj" | "nome" | "nomeRelatorio">>(
  condominios: C[],
  dados: { codigo: string | null; cnpj: string | null; nome?: string | null },
): C | null {
  const cod = codigoNormal(dados.codigo);
  const cnpj = digitos(dados.cnpj);
  const nome = !cod && !cnpj ? chaveNome(dados.nome) : "";
  return (
    (cod ? condominios.find((c) => codigoNormal(c.codigo) === cod) : undefined) ??
    (cnpj ? condominios.find((c) => digitos(c.cnpj) === cnpj) : undefined) ??
    (nome ? condominios.find((c) => chaveNome(c.nomeRelatorio) === nome || chaveNome(c.nome) === nome) : undefined) ??
    null
  );
}

/**
 * Registro de staging de um relatório de condomínio ainda não cadastrado. `cf`/`pv` são o que
 * `lerConsideracoesFinais`/`lerPrevisaoSugerida` leram do mesmo texto do PDF (ou `null`, se o PDF
 * não tiver essas páginas) — ficam guardados no registro até a confirmação, quando
 * `aplicarConsideracoesAoExercicio` os aplica no exercício criado.
 */
export function novaImportacao(
  rel: RelatorioLido,
  arquivo: string,
  destino: DestinoImportacao,
  cf: ConsideracoesFinaisLidas | null = null,
  pv: PrevisaoSugeridaLida | null = null,
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
    consideracoes: cf,
    previsaoSugerida: pv,
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

// Rótulos dos itens que este módulo acrescenta a `extras`: ao reaplicar (reimportação do mesmo
// PDF), os antigos são removidos antes de acrescentar os novos, pra não duplicar. Os 3 primeiros
// são legados (vinham da previsão sugerida antes dela virar campo próprio, `previsaoSugerida`) —
// continuam na lista só para serem limpos de exercícios já existentes ao reimportar; não são mais
// recriados aqui.
const ROTULOS_EXTRAS_SYSTEMAR = [
  "Rateio mensal sugerido (Systemar)",
  "Índice sugerido para correção (Systemar)",
  "Total de despesas consideradas ordinárias (Systemar)",
  "Manutenção dos elevadores (Systemar)",
  "Empresa dos elevadores (Systemar)",
  "Consumo médio de água (Systemar)",
];

/**
 * Aplica o que foi lido de "Considerações finais" (quando o PDF trouxer essa página) sobre o
 * `consid` de um exercício — administração, contas a receber/pagar, seguro, manutenções e índices
 * de correção. Campos sem equivalente no cadastro (manutenção/empresa dos elevadores, consumo
 * médio de água) entram em `extras`, já formatados, em vez de se perderem.
 *
 * A previsão orçamentária sugerida pelo Systemar (folha separada do PDF) não entra aqui — vira
 * `Exercicio.previsaoSugerida`, via `previsaoSugeridaDoPdf` (domain/previsaoSugerida.ts), menu
 * próprio e editável, não uma referência estática em `extras`.
 */
export function aplicarConsideracoesAoExercicio(consid: Exercicio["consid"], cf: ConsideracoesFinaisLidas | null): Exercicio["consid"] {
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
    const extras: Exercicio["consid"]["extras"] = out.extras.filter((e) => !ROTULOS_EXTRAS_SYSTEMAR.includes(e.rotulo));
    const add = (rotulo: string, valor: string | null) => {
      if (valor != null) extras.push({ rotulo, valor });
    };
    add("Manutenção dos elevadores (Systemar)", cf.manutencaoElevadores != null ? formatBRL(cf.manutencaoElevadores) : null);
    add("Empresa dos elevadores (Systemar)", cf.empresaElevadores);
    add("Consumo médio de água (Systemar)", cf.consumoAguaMedio != null ? formatBRL(cf.consumoAguaMedio) : null);
    out = { ...out, extras };
  }
  return out;
}

/**
 * Anexo de um relatório "só leitura" (ex.: Comparativo Financeiro) a uma Prestação de Contas já
 * existente — guarda o relatório lido na íntegra e o PDF original (`arquivoDataUrl`, pra permitir
 * baixar/reexibir), sem virar lançamento no demonstrativo.
 */
export function novoAnexoImportado(
  exercicioId: string,
  tipo: TipoAnexoImportacao,
  rel: RelatorioLido,
  arquivo: string,
  arquivoDataUrl: string,
  agora = new Date(),
): Omit<AnexoImportado, "id"> {
  return { exercicioId, tipo, arquivo, arquivoDataUrl, importadoEm: agora.toISOString(), relatorio: rel };
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
