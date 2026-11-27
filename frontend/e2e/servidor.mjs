// Servidor estático para os testes de navegador: serve o build de produção (frontend/.output/public).
// Rotas com hash (#/...) não precisam de fallback: o servidor só entrega arquivos e index.html.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [, , pasta = '.output/public', porta = '4173'] = process.argv;
const raiz = path.resolve(pasta);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.json': 'application/json' };

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let arquivo = path.join(raiz, caminho === '/' ? 'index.html' : caminho);
  if (!arquivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = path.join(arquivo, 'index.html');
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'content-type': tipos[path.extname(arquivo)] ?? 'application/octet-stream' }).end(corpo);
  } catch {
    res.writeHead(404).end();
  }
}).listen(Number(porta), '127.0.0.1', () => console.log(`servindo ${raiz} em http://127.0.0.1:${porta}`));
