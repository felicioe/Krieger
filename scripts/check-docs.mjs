import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'docs/ESTADO-ATUAL.md',
  'docs/ARQUITETURA.md', 'docs/DESENVOLVIMENTO.md', 'docs/PUBLICACAO.md',
  'docs/DECISOES.md', 'docs/VALIDACAO-PDF.md', '.github/pull_request_template.md'];
const errors = [];
for (const file of required) {
  try { await access(path.join(root, file)); }
  catch { errors.push(`Documento obrigatório ausente: ${file}`); }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'assets'].includes(entry.name)) continue;
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(relative));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
  }
  return files;
}

const documents = await walk('');
for (const file of documents) {
  const text = (await readFile(path.join(root, file), 'utf8')).replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim();
    if (target.startsWith('<')) target = target.slice(1, target.indexOf('>'));
    else target = target.split(/\s+["']/)[0];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    try {
      target = decodeURIComponent(target.split(/[?#]/)[0]);
      if (!target) continue;
      const resolved = path.resolve(path.dirname(path.join(root, file)), target);
      const relative = path.relative(root, resolved);
      if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
        throw new Error('destino fora do repositório');
      }
      await access(resolved);
    } catch (error) {
      errors.push(`${file}: link inválido ${match[1]} (${error.message})`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentação verificada: ${documents.length} arquivos Markdown; links locais válidos.`);
}
