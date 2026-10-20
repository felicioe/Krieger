import { cp, mkdir, readFile, rm, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist', 'hostinger');
const files = ['index.html', 'assets', 'branding', 'favicon.svg', 'icons.svg',
  '.htaccess', 'api.php', 'auth.php', 'lib_auth.php', 'login.html',
  'usuarios.html', 'auth-guard.js', 'acesso.css'];

// Rejeita links simbólicos e valida tudo antes de substituir o pacote anterior.
async function validate(relative) {
  const full = path.join(root, relative);
  const stat = await lstat(full);
  if (stat.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${relative}`);
  if (stat.isDirectory()) {
    const { readdir } = await import('node:fs/promises');
    for (const entry of await readdir(full)) await validate(path.join(relative, entry));
  }
}
for (const file of files) await validate(file);
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["']\/(assets\/[^"']+|favicon\.svg|auth-guard\.js)["']/g)) {
  await validate(match[1]);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await cp(path.join(root, file), path.join(output, file), { recursive: true });
console.log('Pacote gerado em dist/hostinger. Configure config.php diretamente no servidor.');
