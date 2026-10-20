// Leitor dos relatórios do Sistema de Condomínios Auto-Gestão (Systemar) usados pela Krieger.
// Porta em TypeScript de ../importador/parser.mjs (ver ../importador/ESPECIFICACAO.md para os
// layouts reconhecidos e as regras de leitura) — mesma lógica, sem dependência de Node ou DOM.
//
// Entrada: o TEXTO do PDF com o layout visual preservado em espaços (uma linha por linha visual,
// números alinhados em colunas por espaços), do jeito que `pdftotext -layout` produz no Node ou que
// uma extração via pdf.js reconstrói no navegador (concatenando os itens de texto de cada página,
// ordenados por posição, com espaços proporcionais ao espaço horizontal entre eles). Este módulo não
// faz a extração em si — isso cabe a quem chama (Node: pdftotext; navegador: pdf.js) — só interpreta
// o texto já extraído.

export interface CondominioDoRelatorio {
  codigo: string | null;
  nome: string | null;
  cnpj: string | null;
}

export type PeriodoRelatorio =
  | { inicio: string; fim: string } // ISO aaaa-mm-dd, layout de período único
  | { competenciaInicio: string; competenciaFim: string } // mm/aaaa, layout comparativo
  | null;

export interface ValoresColuna {
  valores?: Record<string, number>;
  total?: number;
  media?: number;
}

export interface ItemLido extends ValoresColuna {
  grupo: string[];
  descricao: string;
  subtotal?: true;
  valor?: number | null; // layouts sem coluna por mês (dre_simples / demonstrativo_hierarquico)
}

export interface SecaoLida {
  itens: ItemLido[];
  totais: (number[] | ValoresColuna)[];
}

export interface ConferenciaPeriodoUnico {
  saldoAnterior?: { somaItens: number; totalRelatorio: number; confere: boolean };
  receitas?: { somaItens: number; totalRelatorio: number; confere: boolean };
  despesas?: { somaItens: number; totalRelatorio: number; confere: boolean };
  saldoAtual?: { somaItens: number; totalRelatorio: number; confere: boolean };
}

export interface ConferenciaComparativo {
  linhasConferidas: number;
  divergentes: { secao: 'receitas' | 'despesas'; descricao: string; somaMeses: number; total: number }[];
}

export interface ContasAReceber {
  ate: string; // ISO aaaa-mm-dd
  unidades: number;
  total: number;
}

export interface RelatorioLido {
  layout: 'dre_simples' | 'demonstrativo_hierarquico' | 'comparativo';
  condominio: CondominioDoRelatorio;
  periodo: PeriodoRelatorio;
  emitidoPor: string | null;
  meses?: string[];
  saldoAnterior?: SecaoLida;
  receitas?: SecaoLida;
  despesas?: SecaoLida;
  saldoAtual?: SecaoLida;
  resultadoMes?: SecaoLida;
  conferencia?: ConferenciaPeriodoUnico | ConferenciaComparativo;
  contasAReceber?: ContasAReceber;
}

export interface CadastroBasico {
  codigo: string | null;
  nome: string | null;
  cnpj: string | null;
  contas: string[];
  origem: 'importacao-relatorio';
  revisar: boolean;
}

const NUM = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const LIXO = /Sistema de Condom[ií]nios|KRIEGER ASSESSORIA|Systemar|^\s*P[áa]gina \d|^[\s_]+$/i;
const SECOES: [string, RegExp][] = [
  ['saldoAnterior', /^\s*\(\s*\*\s*\)\s*SALDO ANTERIOR/i],
  ['receitas', /^\s*\(\s*\+\s*\)\s*RECEITAS/i],
  ['despesas', /^\s*\(\s*-\s*\)\s*DESPESAS/i],
  ['saldoAtual', /^\s*\(\s*=\s*\)\s*SALDO ATUAL/i],
];

const paraNumero = (s: string): number => parseFloat(s.replace(/\./g, '').replace(',', '.'));
const dataISO = (d: string): string => {
  const [dd, mm, aa] = d.split('/');
  return `${aa}-${mm}-${dd}`;
};

interface LinhaLida {
  rotulo: string;
  nums: { valor: number; fim: number }[];
  indent: number;
}

function lerLinha(texto: string): LinhaLida {
  const nums = [...texto.matchAll(NUM)].map((m) => ({ valor: paraNumero(m[0]), fim: (m.index ?? 0) + m[0].length }));
  const primeiro = texto.search(NUM);
  const rotulo = (primeiro === -1 ? texto : texto.slice(0, primeiro)).trim();
  return { rotulo, nums, indent: texto.search(/\S/) };
}

// "073_092026 - Estrelas do Mar - DRE Agosto.pdf" -> codigo "073"
export function codigoDoArquivo(nome = ''): string | null {
  const m = nome.replace(/^.*[\\/]/, '').match(/^(\d{1,3})(?=[\s_.-])/); // até 3 dígitos: evita confundir ano (2026_...) com código
  return m ? m[1].padStart(3, '0') : null;
}

function cabecalho(linhas: string[], nomeArquivo: string): { condominio: CondominioDoRelatorio; periodo: PeriodoRelatorio; emitidoPor: string | null } {
  const txt = linhas.join('\n');
  const cond: CondominioDoRelatorio = { codigo: codigoDoArquivo(nomeArquivo), nome: null, cnpj: null };
  const c = txt.match(/Condom[ií]nio:\s*\((\d+)\)\s*-\s*(.+?)(?:\s+-\s+CNPJ:\s*([\d./-]+))?\s*$/m);
  if (c) {
    cond.codigo = c[1].padStart(3, '0');
    cond.nome = c[2].trim();
    cond.cnpj = c[3] || null;
  } else {
    const idx = linhas.findIndex((l) => /Demonstrativo/i.test(l));
    const antes = linhas.slice(0, Math.max(idx, 0)).map((l) => l.trim()).filter((l) => l && !LIXO.test(l));
    cond.nome = antes.length ? antes[antes.length - 1] : null; // nulo quando o relatório não traz o nome
  }
  if (!cond.cnpj) {
    const j = txt.match(/CNPJ[:\s]*([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/);
    if (j) cond.cnpj = j[1];
  }

  let periodo: PeriodoRelatorio = null;
  const p = txt.match(/Per[ií]odo de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  const cp = txt.match(/Comparativo Financeiro de\s+(\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{4})/);
  if (p) periodo = { inicio: dataISO(p[1]), fim: dataISO(p[2]) };
  else if (cp) periodo = { competenciaInicio: cp[1], competenciaFim: cp[2] };
  const contab = txt.match(/^\s*(Krieger Assessoria Cont[áa]bil e Condominial Ltda\.)\s*$/im);
  return { condominio: cond, periodo, emitidoPor: contab ? contab[1] : null };
}

interface ColunaMes {
  nome: string;
  fim: number;
}

// Monta a árvore pelo recuo: linha cujo próximo recuo é maior é grupo; as demais são itens.
function lerSecao(linhasSecao: string[], colunas: ColunaMes[] | null, porMaiusculas: boolean): SecaoLida {
  const itens: ItemLido[] = [];
  const totais: (number[] | ValoresColuna)[] = [];
  const pilha: { indent: number; nome: string }[] = [];
  const L = linhasSecao.map(lerLinha).filter((x) => x.rotulo || x.nums.length);

  const valores = (nums: LinhaLida['nums']): ValoresColuna | { valor: number | null } => {
    if (!colunas) return { valor: nums[0]?.valor ?? null };
    const v: Record<string, number> = {};
    for (const n of nums) {
      let melhor = colunas[0];
      for (const c of colunas) if (Math.abs(c.fim - n.fim) < Math.abs(melhor.fim - n.fim)) melhor = c;
      if (['Total', 'Média'].includes(melhor.nome)) {
        (v as Record<string, number>)['_' + (melhor.nome === 'Total' ? 'total' : 'media')] = n.valor;
      } else v[melhor.nome] = n.valor;
    }
    const total = v['_total'];
    const media = v['_media'];
    delete v['_total'];
    delete v['_media'];
    const out: ValoresColuna = { valores: v };
    if (total !== undefined) out.total = total;
    if (media !== undefined) out.media = media;
    return out;
  };

  L.forEach((l, i) => {
    if (!l.rotulo) {
      if (l.nums.length) totais.push(colunas ? (valores(l.nums) as ValoresColuna) : l.nums.map((n) => n.valor));
      return;
    }
    while (pilha.length && pilha[pilha.length - 1].indent >= l.indent) pilha.pop();
    const prox = L.slice(i + 1).find((x) => x.rotulo);
    const ehGrupo = porMaiusculas ? (!l.nums.length && !/[a-zà-ú]/.test(l.rotulo)) : !!(prox && prox.indent > l.indent);
    if (ehGrupo) {
      pilha.push({ indent: l.indent, nome: l.rotulo });
      if (l.nums.length) {
        itens.push({ grupo: pilha.slice(0, -1).map((g) => g.nome), descricao: l.rotulo, subtotal: true, ...valores(l.nums) });
      }
    } else {
      itens.push({ grupo: pilha.map((g) => g.nome), descricao: l.rotulo, ...valores(l.nums) });
    }
  });
  return { itens, totais };
}

function colunasMeses(linhas: string[]): ColunaMes[] | null {
  const h = linhas.find((l) => /^\s*Compet[êe]ncia/i.test(l));
  if (!h) return null;
  return [...h.matchAll(/\d{2}\/\d{4}|Total|M[ée]dia/g)].map((m) => ({
    nome: m[0].replace('é', 'e') === 'Media' ? 'Média' : m[0],
    fim: (m.index ?? 0) + m[0].length,
  }));
}

// O pdftotext (ou a extração via pdf.js) desloca o recuo de uma página para outra; alinha cada
// página pela moda do recuo dos itens com valor.
function normalizarRecuos(texto: string): string {
  const paginas = texto.split('\f');
  const moda = (pg: string): number | null => {
    const c: Record<number, number> = {};
    for (const l of pg.split(/\r?\n/)) {
      const x = lerLinha(l);
      if (x.rotulo && x.nums.length && !LIXO.test(l)) c[x.indent] = (c[x.indent] || 0) + 1;
    }
    const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return e ? +e[0] : null;
  };
  const base = paginas.map(moda).find((m) => m != null) ?? null;
  return paginas
    .map((pg) => {
      const m = moda(pg);
      const off = m == null || base == null ? 0 : m - base;
      return pg
        .split(/\r?\n/)
        .map((l) => (off > 0 ? l.replace(new RegExp(`^ {0,${off}}`), '') : off < 0 ? ' '.repeat(-off) + l : l))
        .join('\n');
    })
    .join('\n');
}

export function lerRelatorio(texto: string, nomeArquivo = ''): RelatorioLido {
  const bruto = texto;
  texto = normalizarRecuos(texto);
  const todas = texto.split(/\r?\n/);
  const info = cabecalho(todas, nomeArquivo);
  const colunas = colunasMeses(todas);
  const util = todas.filter(
    (l) =>
      !LIXO.test(l) &&
      !/^\s*Compet[êe]ncia/i.test(l) &&
      !/^\s*Condom[ií]nio:/i.test(l) &&
      !/Comparativo Financeiro de/i.test(l),
  );

  const secoes: Record<string, string[]> = {};
  let atual: string | null = null;
  for (const l of util) {
    const s = SECOES.find(([, re]) => re.test(l));
    if (s) {
      atual = s[0];
      secoes[atual] = [];
      continue;
    }
    if (!atual) continue;
    if (/^\s*RESULTADO DO M[ÊE]S/i.test(l)) {
      secoes.resultadoMes = [l];
      atual = null;
      continue;
    }
    if (/^\s*(Krieger Assessoria|Alexandre Krieger|Telefones|Conta a receber)/i.test(l)) {
      atual = null;
      continue;
    }
    secoes[atual].push(l);
  }

  const out: RelatorioLido = {
    layout: colunas ? 'comparativo' : /ORIGEM DOS RECURSOS/.test(bruto) ? 'demonstrativo_hierarquico' : 'dre_simples',
    condominio: info.condominio,
    periodo: info.periodo,
    emitidoPor: info.emitidoPor,
  };
  if (colunas) out.meses = colunas.filter((c) => /\//.test(c.nome)).map((c) => c.nome);
  for (const k of [...SECOES.map(([n]) => n), 'resultadoMes']) {
    if (secoes[k]) (out as Record<string, unknown>)[k] = lerSecao(secoes[k], colunas, out.layout === 'dre_simples');
  }

  const cr = bruto.match(
    /Conta a receber at[ée] a data de\s+(\d{2}\/\d{2}\/\d{4})\s+Quantidade de Unidades:\s*(\d+)\s+Totalizando:[ .]*R\$\s*(-?[\d.]+,\d{2})/i,
  );
  if (cr) out.contasAReceber = { ate: dataISO(cr[1]), unidades: +cr[2], total: paraNumero(cr[3]) };

  const soma = (s?: SecaoLida) =>
    (s?.itens ?? []).filter((i) => !i.subtotal && i.valor != null).reduce((a, i) => a + (i.valor as number), 0);

  if (!colunas) {
    const conferencia: ConferenciaPeriodoUnico = {};
    for (const k of ['saldoAnterior', 'receitas', 'despesas', 'saldoAtual'] as const) {
      const secao = out[k];
      const tot = secao?.totais?.[0];
      const alvo = Array.isArray(tot) ? tot[0] : null;
      if (alvo != null) {
        const somaItens = +soma(secao).toFixed(2);
        conferencia[k] = { somaItens, totalRelatorio: alvo, confere: Math.abs(somaItens - alvo) < 0.02 };
      }
    }
    out.conferencia = conferencia;
  } else {
    // comparativo: a soma dos meses de cada linha deve bater com a coluna Total
    const divergentes: ConferenciaComparativo['divergentes'] = [];
    let conferidas = 0;
    for (const k of ['receitas', 'despesas'] as const) {
      for (const i of out[k]?.itens ?? []) {
        if (i.total == null || !i.valores) continue;
        conferidas++;
        const somaMeses = Object.values(i.valores).reduce((a, b) => a + b, 0);
        if (Math.abs(somaMeses - i.total) > 0.05) {
          divergentes.push({ secao: k, descricao: i.descricao, somaMeses: +somaMeses.toFixed(2), total: i.total });
        }
      }
    }
    out.conferencia = { linhasConferidas: conferidas, divergentes };
  }
  return out;
}

// Dados mínimos para cadastrar o condomínio quando ele ainda não existe.
export function cadastroBasico(rel: RelatorioLido): CadastroBasico {
  const { codigo, nome, cnpj } = rel.condominio;
  return {
    codigo,
    nome,
    cnpj,
    contas: (rel.saldoAnterior?.itens ?? []).map((i) => i.descricao),
    origem: 'importacao-relatorio',
    revisar: !nome || !cnpj,
  };
}
