import { readFile } from 'node:fs/promises';
import { get } from 'node:https';
import { gzipSync, gunzipSync, brotliDecompressSync, inflateSync } from 'node:zlib';

// Entrada e modulepreloads declarados no HTML. Não inclui CSS/fontes nem todos
// os imports da rota, e não mede LCP/INP. Local = gzip calculado; --url = HTTP real.
const limite = 250 * 1024;
const remoto = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
const base = remoto ? new URL(remoto) : new URL('../frontend/.output/public/', import.meta.url);
if (remoto && (base.protocol !== 'https:' || base.hostname !== 'krieger.therafinancial.com.br')) {
  throw new Error('Medição remota restrita ao site publicado do Krieger.');
}
function baixar(url) {
  return new Promise((resolve, reject) => {
    const pedido = get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}: ${url.pathname}`)); return; }
      const partes = []; let tamanho = 0;
      res.on('data', (parte) => {
        tamanho += parte.length;
        if (tamanho > 20 * 1024 * 1024) res.destroy(new Error('Resposta maior que 20 MiB.'));
        else partes.push(parte);
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          const corpo = Buffer.concat(partes);
          const encoding = res.headers['content-encoding'] || 'identity';
          const decodificado = encoding === 'gzip' ? gunzipSync(corpo) : encoding === 'br'
            ? brotliDecompressSync(corpo) : encoding === 'deflate' ? inflateSync(corpo) : corpo;
          resolve({ corpo: decodificado, bytesHttp: corpo.length, encoding });
        } catch (erro) { reject(erro); }
      });
    });
    pedido.setTimeout(30000, () => pedido.destroy(new Error('Tempo de medição HTTP excedido.')));
    pedido.on('error', reject);
  });
}
const html = remoto ? (await baixar(base)).corpo.toString('utf8') : await readFile(new URL('index.html', base), 'utf8');
const arquivos = new Set();
const origemAssets = remoto ? base : new URL('https://krieger.therafinancial.com.br/');
for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
  const attrs = Object.fromEntries([...tag[0].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map((m) => [m[1].toLowerCase(), m[2]]));
  const caminho = attrs.rel === 'modulepreload' ? attrs.href : attrs.type === 'module' ? attrs.src : null;
  if (!caminho) continue;
  const url = new URL(caminho, origemAssets);
  if (url.origin !== origemAssets.origin || !url.pathname.startsWith('/assets/') || !url.pathname.endsWith('.js')) {
    throw new Error(`Entrada de JavaScript inesperada: ${caminho}`);
  }
  arquivos.add(url.pathname);
}
if (!arquivos.size) throw new Error('Nenhuma entrada JavaScript encontrada; não é uma medição válida.');
const medidas = await Promise.all([...arquivos].map(async (arquivo) => {
  if (remoto) {
    const r = await baixar(new URL(arquivo, base));
    return { arquivo, bytes: r.corpo.length, bytesOrcamento: r.bytesHttp, encoding: r.encoding };
  }
  const corpo = await readFile(new URL(arquivo.slice(1), base));
  return { arquivo, bytes: corpo.length, bytesOrcamento: gzipSync(corpo).length, encoding: 'gzip-local' };
}));
const total = medidas.reduce((s, m) => s + m.bytesOrcamento, 0);
console.log(JSON.stringify({ modo: remoto ? 'corpos-HTTP-reais' : 'gzip-local', limite, total, arquivos: medidas }, null, 2));
if (total > limite) throw new Error(`JavaScript declarado no HTML excede o orçamento de ${limite} bytes: ${total}.`);
if (medidas.some((m) => /(?:pdfmake|pdf\.worker|docx|word-)/i.test(m.arquivo))) {
  throw new Error('PDF/Word pesado antecipado no HTML; revisar carregamento sob demanda.');
}
