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
// "Comparativo Financeiro de X a Y" repete como cabeçalho em toda página do layout comparativo,
// com espaçamento largo entre as palavras (colunas) — sem \s+ entre elas aqui, vaza como item de
// despesa vazio (sem valores, mas polui a lista).
const LIXO = /Sistema de Condom[ií]nios|KRIEGER ASSESSORIA|Systemar|^\s*P[áa]gina \d|^[\s_]+$|Comparativo\s+Financeiro\s+de\s+\d{2}\/\d{4}\s+a\s+\d{2}\/\d{4}/i;
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
  return m ? m[1]!.padStart(3, '0') : null;
}

function cabecalho(linhas: string[], nomeArquivo: string): { condominio: CondominioDoRelatorio; periodo: PeriodoRelatorio; emitidoPor: string | null } {
  const txt = linhas.join('\n');
  const cond: CondominioDoRelatorio = { codigo: codigoDoArquivo(nomeArquivo), nome: null, cnpj: null };
  const c = txt.match(/Condom[ií]nio:\s*\((\d+)\)\s*-\s*(.+?)(?:\s+-\s+CNPJ:\s*([\d./-]+))?\s*$/m);
  if (c) {
    cond.codigo = c[1]!.padStart(3, '0');
    cond.nome = c[2]!.trim();
    cond.cnpj = c[3] || null;
  } else {
    const idx = linhas.findIndex((l) => /Demonstrativo/i.test(l));
    const antes = linhas.slice(0, Math.max(idx, 0)).map((l) => l.trim()).filter((l) => l && !LIXO.test(l));
    cond.nome = antes.length ? antes[antes.length - 1]! : null; // nulo quando o relatório não traz o nome
  }
  if (!cond.cnpj) {
    const j = txt.match(/CNPJ[:\s]*([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/);
    if (j) cond.cnpj = j[1]!;
  }

  let periodo: PeriodoRelatorio = null;
  const p = txt.match(/Per[ií]odo de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  const cp = txt.match(/Comparativo\s+Financeiro\s+de\s+(\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{4})/);
  // "DEMONSTRATIVO GERAL ENCERRADO EM DD/MM/AAAA" (layout da prestação de contas anual): só a data
  // final; assume 1º de janeiro do mesmo ano como início (convenção de exercício anual).
  const enc = txt.match(/DEMONSTRATIVO GERAL ENCERRADO EM\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (p) periodo = { inicio: dataISO(p[1]!), fim: dataISO(p[2]!) };
  else if (cp) periodo = { competenciaInicio: cp[1]!, competenciaFim: cp[2]! };
  else if (enc) periodo = { inicio: `${enc[3]}-01-01`, fim: `${enc[3]}-${enc[2]}-${enc[1]}` };
  const contab = txt.match(/^\s*(Krieger Assessoria Cont[áa]bil e Condominial Ltda\.)\s*$/im);
  return { condominio: cond, periodo, emitidoPor: contab ? contab[1]! : null };
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
      let melhor = colunas[0]!;
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
    while (pilha.length && pilha[pilha.length - 1]!.indent >= l.indent) pilha.pop();
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
      // Em relatórios longos a seção continua em outra página e o cabeçalho se repete (ex.: "(-)
      // DESPESAS" de novo no topo da página seguinte) — acrescenta aos itens já lidos em vez de
      // reiniciar, senão perde tudo que veio antes da repetição.
      atual = s[0];
      secoes[atual] = secoes[atual] ?? [];
      continue;
    }
    if (!atual) continue;
    if (/^\s*RESULTADO DO M[ÊE]S/i.test(l)) {
      secoes['resultadoMes'] = [l];
      atual = null;
      continue;
    }
    // "Conta a receber..." é rodapé que sempre traz um valor monetário (o totalizador da conta), então
    // fecha a seção mesmo assim. Os demais são texto de rodapé/assinatura/título de página que nunca
    // trazem valor monetário — só fecham quando a linha não tem um (telefone não é "0,00"), pra não
    // confundir com um item de despesa real cujo nome bata com o rótulo (ex.: a rubrica "Telefones",
    // comum em despesas de condomínio).
    if (/^\s*Conta a receber/i.test(l)) {
      atual = null;
      continue;
    }
    if (
      !/-?\d{1,3}(?:\.\d{3})*,\d{2}/.test(l) &&
      /^\s*(Krieger Assessoria|Alexandre Krieger|Telefones|CONSIDERA[ÇC][ÕO]ES FINAIS|PREVIS[ÃA]O OR[ÇC]AMENT[ÁA]RIA)/i.test(
        l,
      )
    ) {
      atual = null;
      continue;
    }
    secoes[atual]!.push(l);
  }

  const out: RelatorioLido = {
    layout: colunas ? 'comparativo' : /ORIGEM DOS RECURSOS/.test(bruto) ? 'demonstrativo_hierarquico' : 'dre_simples',
    condominio: info.condominio,
    periodo: info.periodo,
    emitidoPor: info.emitidoPor,
  };
  if (colunas) out.meses = colunas.filter((c) => /\//.test(c.nome)).map((c) => c.nome);
  for (const k of [...SECOES.map(([n]) => n), 'resultadoMes']) {
    if (secoes[k]) (out as unknown as Record<string, unknown>)[k] = lerSecao(secoes[k]!, colunas, out.layout === 'dre_simples');
  }

  const cr = bruto.match(
    /Conta a receber at[ée] a data de\s+(\d{2}\/\d{2}\/\d{4})\s+Quantidade de Unidades:\s*(\d+)\s+Totalizando:[ .]*R\$\s*(-?[\d.]+,\d{2})/i,
  );
  if (cr) out.contasAReceber = { ate: dataISO(cr[1]!), unidades: +cr[2]!, total: paraNumero(cr[3]!) };

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

// ---------------------------------------------------------------------------------------------
// "CONSIDERAÇÕES FINAIS" e "PREVISÃO ORÇAMENTÁRIA ORDINÁRIA SUGERIDA" — duas páginas opcionais
// que alguns demonstrativos de período único trazem depois do saldo atual. Cada uma é lida por
// uma função separada (não fazem parte de `lerRelatorio`): o texto completo do PDF entra, e sai
// `null` quando a seção não está presente. Mapeiam quase 1:1 para `Exercicio.consid`.

const MESES_PT: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

// "outubro/25" ou "dezembro/2025" -> "10/2025" (ano de 2 dígitos vira 20xx).
function mesAnoPorExtenso(texto: string | undefined): string | null {
  if (!texto) return null;
  const m = texto.trim().match(/^([a-zà-ú]+)\/(\d{2,4})$/i);
  if (!m) return null;
  const mes = MESES_PT[m[1]!.toLowerCase()];
  if (!mes) return null;
  const ano = m[2]!.length === 2 ? `20${m[2]}` : m[2]!;
  return `${mes}/${ano}`;
}

export interface MembroAdministracaoLido {
  cargo: string;
  nome: string;
}

export interface CoberturaLida {
  desc: string;
  valor: number;
}

export interface ConsideracoesFinaisLidas {
  administracao: MembroAdministracaoLido[];
  contasReceber: number | null;
  contasPagar: number | null;
  seguro: { riscoAbsoluto: number | null; coberturas: CoberturaLida[] };
  seguradora: string | null;
  /** mm/aaaa */
  vigenciaSeguro: string | null;
  manutencaoElevadores: number | null;
  empresaElevadores: string | null;
  consumoAguaMedio: number | null;
  /** mm/aaaa */
  ultCaixaDagua: string | null;
  /** mm/aaaa */
  ultDedetizacao: string | null;
  /** mm/aaaa */
  ultGordura: string | null;
  indices: { ano: number; pct: number }[];
}

// "Rótulo .......... R$ 1.234,56" -> { rotulo: "Rótulo", valor: 1234.56 }
function linhaRotuloValor(linha: string): { rotulo: string; valor: number } | null {
  const m = linha.match(/^\s*(.+?)[.\s]{2,}R\$\s*(-?[\d.]+,\d{2})\s*$/);
  return m ? { rotulo: m[1]!.trim(), valor: paraNumero(m[2]!) } : null;
}

function campoValor(texto: string, rotulo: RegExp): number | null {
  const m = texto.match(rotulo);
  return m ? paraNumero(m[1]!) : null;
}

function campoTexto(texto: string, rotulo: RegExp): string | null {
  const m = texto.match(rotulo);
  return m ? m[1]!.trim() : null;
}

/** "Índice sugerido para correção...": o % vem antes ou depois do número, conforme o exercício. */
function indiceSugeridoDoBloco(bloco: string): number | null {
  const m = bloco.match(
    /[ÍI]ndice sugerido para corre[çc][ãa]o do condom[íi]nio[.\s]*(?:%\s*(-?[\d.]+,\d{2})|(-?[\d.]+,\d{2})\s*%)/i,
  );
  if (!m) return null;
  return paraNumero((m[1] ?? m[2])!);
}

/** Membros da administração: "Cargo: Nome"; linhas seguintes sem ":" repetem o último cargo. */
function lerAdministracao(bloco: string): MembroAdministracaoLido[] {
  const out: MembroAdministracaoLido[] = [];
  let cargoAtual = '';
  for (const linhaBruta of bloco.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const m = linha.match(/^([^:]+):\s*(.+)$/);
    if (m) {
      cargoAtual = m[1]!.trim();
      out.push({ cargo: cargoAtual, nome: m[2]!.trim() });
    } else if (cargoAtual) {
      out.push({ cargo: cargoAtual, nome: linha });
    }
  }
  return out;
}

export function lerConsideracoesFinais(texto: string): ConsideracoesFinaisLidas | null {
  const inicio = texto.search(/CONSIDERA[ÇC][ÕO]ES FINAIS/i);
  if (inicio === -1) return null;
  const resto = texto.slice(inicio);
  // Para no fim da seção: emissão ("Cidade, DD de mês de AAAA.") ou início de outra página conhecida.
  const fimMatch = resto.match(/\n\s*[A-ZÀ-Ú][a-zà-ú]+,\s*\d{1,2}\s+de\s+[a-zà-ú]+\s+de\s+\d{4}\.?/);
  const bloco = fimMatch ? resto.slice(0, fimMatch.index) : resto;

  const admMatch = bloco.match(/Membros da atual administra[çc][ãa]o:([\s\S]*?)\n\s*0?2\)/i);
  const administracao = admMatch ? lerAdministracao(admMatch[1]!) : [];

  const coberturas: CoberturaLida[] = [];
  const segMatch = bloco.match(/Valor do seguro contratado[^\n]*\n([\s\S]*?)\n\s*0?5\)/i);
  if (segMatch) {
    for (const linha of segMatch[1]!.split(/\r?\n/)) {
      const lv = linhaRotuloValor(linha);
      if (lv) coberturas.push({ desc: lv.rotulo, valor: lv.valor });
    }
  }

  const indices: ConsideracoesFinaisLidas['indices'] = [];
  for (const m of bloco.matchAll(/[ÍI]ndice de corre[çc][ãa]o aplicado no condom[íi]nio em\s*(\d{4})[.\s]*%\s*(-?[\d.]+,\d{2})/gi)) {
    indices.push({ ano: Number(m[1]!), pct: paraNumero(m[2]!) });
  }

  return {
    administracao,
    contasReceber: campoValor(bloco, /Valor total contas a receber[.\s]*R\$\s*(-?[\d.]+,\d{2})/i),
    contasPagar: campoValor(bloco, /Valor total contas a pagar[.\s]*R\$\s*(-?[\d.]+,\d{2})/i),
    seguro: {
      riscoAbsoluto: campoValor(bloco, /Valor do seguro contratado[\s\S]*?R\$\s*(-?[\d.]+,\d{2})/i),
      coberturas,
    },
    // Captura o resto da linha e tira só o ponto final do relatório — nomes com "S.A." no meio ficam intactos.
    seguradora: campoTexto(bloco, /Seguradora:\s*([^\n]+?)\s*$/im)?.replace(/\.$/, '') || null,
    vigenciaSeguro: mesAnoPorExtenso(campoTexto(bloco, /Vig[êe]ncia do seguro[.\s]*([a-zà-ú]+\/\d{2,4})/i) ?? undefined),
    manutencaoElevadores: campoValor(bloco, /Valor da manuten[çc][ãa]o dos elevadores[.\s]*R\$\s*(-?[\d.]+,\d{2})/i),
    empresaElevadores: campoTexto(bloco, /Empresa:\s*([^\n]+)/i),
    consumoAguaMedio: campoValor(bloco, /Valor m[ée]dio do consumo de [áa]gua[.\s]*R\$\s*(-?[\d.]+,\d{2})/i),
    ultCaixaDagua: mesAnoPorExtenso(campoTexto(bloco, /[Úu]ltima limpeza da caixa d[´'`]?\s*[áa]gua e cisterna[.\s]*([a-zà-ú]+\/\d{2,4})/i) ?? undefined),
    ultDedetizacao: mesAnoPorExtenso(campoTexto(bloco, /[Úu]ltima dedetiza[çc][ãa]o[.\s]*([a-zà-ú]+\/\d{2,4})/i) ?? undefined),
    ultGordura: mesAnoPorExtenso(campoTexto(bloco, /[Úu]ltima limpeza da caixa de gordura[.\s]*([a-zà-ú]+\/\d{2,4})/i) ?? undefined),
    indices,
  };
}

export interface CategoriaPrevisaoSugerida {
  nome: string;
  anual: number;
  media: number;
}

export interface PrevisaoSugeridaLida {
  rateioMensalAtual: number | null;
  categorias: CategoriaPrevisaoSugerida[];
  totalDespesasAno: number | null;
  totalDespesasMedia: number | null;
  deducao: number | null;
  totalOrdinario: number | null;
  variacaoSugerida: number | null;
  rateioAnualSugerido: number | null;
  rateioMensalSugerido: number | null;
  /** % */
  indiceSugerido: number | null;
}

export function lerPrevisaoSugerida(texto: string): PrevisaoSugeridaLida | null {
  const inicio = texto.search(/PREVIS[ÃA]O OR[ÇC]AMENT[ÁA]RIA ORDIN[ÁA]RIA/i);
  if (inicio === -1) return null;
  const resto = texto.slice(inicio);
  const fimMatch = resto.match(/\n\s*[A-ZÀ-Ú][a-zà-ú]+,\s*\d{1,2}\s+de\s+[a-zà-ú]+\s+de\s+\d{4}\.?/);
  const bloco = fimMatch ? resto.slice(0, fimMatch.index) : resto;

  const categorias: CategoriaPrevisaoSugerida[] = [];
  let totalDespesasAno: number | null = null;
  let totalDespesasMedia: number | null = null;
  const tabelaMatch = bloco.match(/efetivamente realizado\s+no ano\s+m[ée]dia m[êe]s([\s\S]*?)\n\s*Despesas a deduzir/i);
  if (tabelaMatch) {
    for (const linha of tabelaMatch[1]!.split(/\r?\n/)) {
      const m = linha.match(/^\s*(.+?)[.\s]{2,}R\$\s*(-?[\d.]+,\d{2})\s+R\$\s*(-?[\d.]+,\d{2})\s*$/);
      if (!m) continue;
      const nome = m[1]!.trim();
      const anual = paraNumero(m[2]!);
      const media = paraNumero(m[3]!);
      // O rótulo varia por condomínio/exercício: "do período" ou "do exercício de AAAA/AAAA".
      if (/^Total das despesas do (per[íi]odo|exerc[íi]cio)/i.test(nome)) {
        totalDespesasAno = anual;
        totalDespesasMedia = media;
      } else {
        categorias.push({ nome, anual, media });
      }
    }
  }

  return {
    rateioMensalAtual: campoValor(bloco, /Valor total do rateio ordin[áa]rio mensal utilizado atualmente[\s\S]*?R\$\s*(-?[\d.]+,\d{2})/i),
    categorias,
    totalDespesasAno,
    totalDespesasMedia,
    deducao: campoValor(bloco, /Despesas a deduzir[^\n]*R\$\s*(-?[\d.]+,\d{2})/i),
    // "de"/"das despesas" varia por condomínio/exercício.
    totalOrdinario: campoValor(bloco, /Total d(?:e|as) despesas consideradas ordin[áa]rias\.?\s*R\$\s*(-?[\d.]+,\d{2})/i),
    variacaoSugerida: campoValor(bloco, /Varia[çc][ãa]o de despesas sugeridas[^\n]*R\$\s*(-?[\d.]+,\d{2})/i),
    rateioAnualSugerido: campoValor(bloco, /Sugest[ãa]o de rateio\s+anual\s+ordin[áa]rio[.\s]*R\$\s*(-?[\d.]+,\d{2})/i),
    rateioMensalSugerido: campoValor(bloco, /Sugest[ãa]o de rateio\s+mensal\s+ordin[áa]rio[.\s]*R\$\s*(-?[\d.]+,\d{2})/i),
    // O símbolo % vem antes ou depois do número, conforme o condomínio/exercício.
    indiceSugerido: indiceSugeridoDoBloco(bloco),
  };
}
