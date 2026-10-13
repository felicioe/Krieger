// Leitor dos relatórios do Sistema de Condomínios Auto-Gestão (Systemar) usados pela Krieger.
// Entrada: texto do PDF com o layout preservado (linhas com a posição das colunas) e o nome do arquivo.
// Saída: objeto JSON padronizado (condomínio, período, saldos, receitas, despesas).
// Não depende de navegador nem de Node: pode ser usado dentro do sistema React (pdf.js) ou em testes.

const NUM = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const LIXO = /Sistema de Condom[ií]nios|KRIEGER ASSESSORIA|Systemar|^\s*P[áa]gina \d|^[\s_]+$/i;
const SECOES = [
  ['saldoAnterior', /^\s*\(\s*\*\s*\)\s*SALDO ANTERIOR/i],
  ['receitas', /^\s*\(\s*\+\s*\)\s*RECEITAS/i],
  ['despesas', /^\s*\(\s*-\s*\)\s*DESPESAS/i],
  ['saldoAtual', /^\s*\(\s*=\s*\)\s*SALDO ATUAL/i],
];

const paraNumero = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
const dataISO = (d) => { const [dd, mm, aa] = d.split('/'); return `${aa}-${mm}-${dd}`; };

function lerLinha(texto) {
  const nums = [...texto.matchAll(NUM)].map((m) => ({ valor: paraNumero(m[0]), fim: m.index + m[0].length }));
  const primeiro = texto.search(NUM);
  const rotulo = (primeiro === -1 ? texto : texto.slice(0, primeiro)).trim();
  return { rotulo, nums, indent: texto.search(/\S/) };
}

// "073_092026 - Estrelas do Mar - DRE Agosto.pdf" -> codigo "073"
export function codigoDoArquivo(nome = '') {
  const m = nome.replace(/^.*[\\/]/, '').match(/^(\d{1,4})(?=[\s_.-])/);
  return m ? m[1].padStart(3, '0') : null;
}

function cabecalho(linhas, nomeArquivo) {
  const txt = linhas.join('\n');
  const cond = { codigo: codigoDoArquivo(nomeArquivo), nome: null, cnpj: null };
  const c = txt.match(/Condom[ií]nio:\s*\((\d+)\)\s*-\s*(.+?)(?:\s+-\s+CNPJ:\s*([\d./-]+))?\s*$/m);
  if (c) { cond.codigo = c[1].padStart(3, '0'); cond.nome = c[2].trim(); cond.cnpj = c[3] || null; }
  else {
    const idx = linhas.findIndex((l) => /Demonstrativo/i.test(l));
    const antes = linhas.slice(0, Math.max(idx, 0)).map((l) => l.trim()).filter((l) => l && !LIXO.test(l));
    cond.nome = antes.length ? antes[antes.length - 1] : null; // nulo quando o relatório não traz o nome
  }
  if (!cond.cnpj) { const j = txt.match(/CNPJ[:\s]*([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/); if (j) cond.cnpj = j[1]; }

  let periodo = null;
  const p = txt.match(/Per[ií]odo de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  const cp = txt.match(/Comparativo Financeiro de\s+(\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{4})/);
  if (p) periodo = { inicio: dataISO(p[1]), fim: dataISO(p[2]) };
  else if (cp) periodo = { competenciaInicio: cp[1], competenciaFim: cp[2] };
  const contab = txt.match(/^\s*(Krieger Assessoria Cont[áa]bil e Condominial Ltda\.)\s*$/im);
  return { condominio: cond, periodo, emitidoPor: contab ? contab[1] : null };
}

// Monta a árvore pelo recuo: linha cujo próximo recuo é maior é grupo; as demais são itens.
function lerSecao(linhasSecao, colunas, porMaiusculas) {
  const itens = [], totais = [], pilha = [];
  const L = linhasSecao.map(lerLinha).filter((x) => x.rotulo || x.nums.length);
  const valores = (nums) => {
    if (!colunas) return { valor: nums[0]?.valor ?? null };
    const v = {};
    for (const n of nums) {
      let melhor = colunas[0];
      for (const c of colunas) if (Math.abs(c.fim - n.fim) < Math.abs(melhor.fim - n.fim)) melhor = c;
      if (['Total', 'Média'].includes(melhor.nome)) (v._ ??= {})[melhor.nome.toLowerCase()] = n.valor;
      else v[melhor.nome] = n.valor;
    }
    return { valores: Object.fromEntries(Object.entries(v).filter(([k]) => k !== '_')), ...(v._ || {}) };
  };
  L.forEach((l, i) => {
    if (!l.rotulo) { if (l.nums.length) totais.push(colunas ? valores(l.nums) : l.nums.map((n) => n.valor)); return; }
    while (pilha.length && pilha[pilha.length - 1].indent >= l.indent) pilha.pop();
    const prox = L.slice(i + 1).find((x) => x.rotulo);
    const ehGrupo = porMaiusculas ? (!l.nums.length && !/[a-zà-ú]/.test(l.rotulo)) : (prox && prox.indent > l.indent);
    if (ehGrupo) {
      pilha.push({ indent: l.indent, nome: l.rotulo });
      if (l.nums.length) itens.push({ grupo: pilha.slice(0, -1).map((g) => g.nome), descricao: l.rotulo, subtotal: true, ...valores(l.nums) });
    } else {
      itens.push({ grupo: pilha.map((g) => g.nome), descricao: l.rotulo, ...valores(l.nums) });
    }
  });
  return { itens, totais };
}

function colunasMeses(linhas) {
  const h = linhas.find((l) => /^\s*Compet[êe]ncia/i.test(l));
  if (!h) return null;
  return [...h.matchAll(/\d{2}\/\d{4}|Total|M[ée]dia/g)].map((m) => ({ nome: m[0].replace('é', 'e') === 'Media' ? 'Média' : m[0], fim: m.index + m[0].length }));
}

// O pdftotext desloca o recuo de uma página para outra; alinha cada página pela moda do recuo dos itens com valor.
function normalizarRecuos(texto) {
  const paginas = texto.split('\f');
  const moda = (pg) => {
    const c = {};
    for (const l of pg.split(/\r?\n/)) { const x = lerLinha(l); if (x.rotulo && x.nums.length && !LIXO.test(l)) c[x.indent] = (c[x.indent] || 0) + 1; }
    const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return e ? +e[0] : null;
  };
  const base = paginas.map(moda).find((m) => m != null);
  return paginas.map((pg) => {
    const m = moda(pg); const off = m == null || base == null ? 0 : m - base;
    return pg.split(/\r?\n/).map((l) => (off > 0 ? l.replace(new RegExp(`^ {0,${off}}`), '') : off < 0 ? ' '.repeat(-off) + l : l)).join('\n');
  }).join('\n');
}

export function lerRelatorio(texto, nomeArquivo = '') {
  const bruto = texto;
  texto = normalizarRecuos(texto);
  const todas = texto.split(/\r?\n/);
  const info = cabecalho(todas, nomeArquivo);
  const colunas = colunasMeses(todas);
  const util = todas.filter((l) => !LIXO.test(l) && !/^\s*Compet[êe]ncia/i.test(l) && !/^\s*Condom[ií]nio:/i.test(l) && !/Comparativo Financeiro de/i.test(l));

  const secoes = {}; let atual = null;
  for (const l of util) {
    const s = SECOES.find(([, re]) => re.test(l));
    if (s) { atual = s[0]; secoes[atual] = []; continue; }
    if (!atual) continue;
    if (/^\s*(Krieger Assessoria|Alexandre Krieger|Telefones|Conta a receber|RESULTADO DO M)/i.test(l)) { if (/Krieger Assessoria|Alexandre/.test(l)) atual = null; else atual = null; continue; }
    secoes[atual].push(l);
  }
  const out = { layout: colunas ? 'comparativo' : (/ORIGEM DOS RECURSOS/.test(bruto) ? 'demonstrativo_hierarquico' : 'dre_simples'), ...info };
  if (colunas) out.meses = colunas.filter((c) => /\//.test(c.nome)).map((c) => c.nome);
  for (const [k] of SECOES) if (secoes[k]) out[k] = lerSecao(secoes[k], colunas, out.layout === 'dre_simples');

  const soma = (s) => (s?.itens ?? []).filter((i) => !i.subtotal && i.valor != null).reduce((a, i) => a + i.valor, 0);
  if (!colunas) {
    out.conferencia = {};
    for (const k of ['saldoAnterior', 'receitas', 'despesas', 'saldoAtual']) {
      const tot = out[k]?.totais?.[0]; const alvo = Array.isArray(tot) ? tot[0] : null;
      if (alvo != null) out.conferencia[k] = { somaItens: +soma(out[k]).toFixed(2), totalRelatorio: alvo, confere: Math.abs(soma(out[k]) - alvo) < 0.02 };
    }
  }
  return out;
}

// Dados mínimos para cadastrar o condomínio quando ele ainda não existe.
export function cadastroBasico(rel) {
  const { codigo, nome, cnpj } = rel.condominio;
  return { codigo, nome, cnpj, contas: (rel.saldoAnterior?.itens ?? []).map((i) => i.descricao), origem: 'importacao-relatorio', revisar: !nome || !cnpj };
}
