import { cp, mkdir, readFile, rm, lstat, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const feRoot = path.join(root, 'frontend');
const feOutput = path.join(feRoot, '.output', 'public');
const output = path.join(root, 'dist', 'hostinger');

// Vem do build do frontend React (frontend/.output/public): precisa ser gerado antes, com
// `cd frontend && npm ci && npm run build`. Este script não roda o build sozinho, pra não
// esconder uma falha de build atrás do empacotamento.
const fromFrontend = ['index.html', 'assets', 'favicon.png', 'robots.txt'];
// Backend PHP e config estática, inalterados pela troca de frontend.
const fromRoot = [
  'branding',
  '.htaccess',
  'api.php',
  'auth.php',
  'api_documentos.php',
  'lib_auth.php',
  'lib_permissoes.php',
  'lib_importacao.php',
  'lib_backup.php',
  'lib_documentos.php',
  'lib_claude.php',
];

try {
  await access(path.join(feOutput, 'index.html'));
} catch {
  throw new Error(
    'frontend/.output/public/index.html não existe. Rode primeiro: cd frontend && npm ci && npm run build',
  );
}

// Rejeita links simbólicos e valida tudo antes de substituir o pacote anterior.
async function validate(base, relative) {
  const full = path.join(base, relative);
  const stat = await lstat(full);
  if (stat.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${relative}`);
  if (stat.isDirectory()) {
    const { readdir } = await import('node:fs/promises');
    for (const entry of await readdir(full)) await validate(base, path.join(relative, entry));
  }
}
for (const file of fromFrontend) await validate(feOutput, file);
for (const file of fromRoot) await validate(root, file);

const html = await readFile(path.join(feOutput, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["']\.?\/(assets\/[^"']+|favicon\.png)["']/g)) {
  await validate(feOutput, match[1]);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of fromFrontend) await cp(path.join(feOutput, file), path.join(output, file), { recursive: true });
for (const file of fromRoot) await cp(path.join(root, file), path.join(output, file), { recursive: true });
console.log('Pacote gerado em dist/hostinger (frontend React + backend PHP). Configure config.php diretamente no servidor.');
