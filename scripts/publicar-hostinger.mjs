#!/usr/bin/env node
// Publica na Hostinger a partir do SHA atual de origin/main.
//
// Por padrão só mostra o plano (dry-run). Com --executar, gera o pacote numa árvore limpa,
// confere o resultado e envia um commit à branch deploy-hostinger por fast-forward (nunca força).
//
// Uso:
//   node scripts/publicar-hostinger.mjs                 # plano, sem alterar nada no remoto
//   node scripts/publicar-hostinger.mjs --executar      # publica
//   node scripts/publicar-hostinger.mjs --executar --dominio krieger.exemplo.com.br
//
// Recusa publicar se: main local não tiver o SHA de origin/main, se o CI do SHA não estiver verde
// (exige `gh`), se o build falhar ou se o bundle gerado não bater com o servidor depois do envio.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, readdir, cp, access, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const executar = args.includes('--executar');
const dominioIdx = args.indexOf('--dominio');
const dominio = dominioIdx >= 0 ? args[dominioIdx + 1] : null;

const log = (msg) => console.log(msg);
const falhar = (msg) => {
  console.error(`\nERRO: ${msg}`);
  process.exit(1);
};

async function sh(cmd, cmdArgs, opts = {}) {
  try {
    const { stdout } = await execFileAsync(cmd, cmdArgs, { maxBuffer: 64 * 1024 * 1024, ...opts });
    return stdout.trim();
  } catch (erro) {
    const saida = [erro.stdout, erro.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${cmd} ${cmdArgs.join(' ')} falhou:\n${saida.slice(-2000)}`);
  }
}

const git = (gitArgs, opts) => sh('git', ['-C', root, ...gitArgs], opts);

async function main() {
  log(executar ? 'Modo: PUBLICAR' : 'Modo: plano (nada será enviado). Use --executar para publicar.');

  // 1. Estado do repositório
  await git(['fetch', '-q', 'origin', 'main', 'deploy-hostinger']);
  const sha = await git(['rev-parse', 'origin/main']);
  const deployAtual = await git(['rev-parse', 'origin/deploy-hostinger']);
  log(`main (origin): ${sha.slice(0, 12)}`);
  log(`deploy-hostinger atual: ${deployAtual.slice(0, 12)}`);

  // 2. CI verde no SHA (exige gh autenticado)
  let estadoCi = 'não verificado';
  try {
    const saida = await sh('gh', ['run', 'list', '--commit', sha, '--workflow', 'Validar e empacotar', '--json', 'conclusion,status', '--limit', '5']);
    const runs = JSON.parse(saida || '[]');
    const concluidas = runs.filter((r) => r.status === 'completed');
    if (concluidas.length === 0) falhar(`nenhuma execução concluída do CI em ${sha.slice(0, 12)}. Espere o CI terminar.`);
    if (!concluidas.some((r) => r.conclusion === 'success')) falhar(`CI de ${sha.slice(0, 12)} não está verde.`);
    estadoCi = 'verde';
  } catch (erro) {
    if (executar) falhar(`não foi possível confirmar o CI (${erro.message.split('\n')[0]}). Publicação recusada.`);
    estadoCi = 'não verificado (gh indisponível; obrigatório com --executar)';
  }
  log(`CI do SHA: ${estadoCi}`);

  // 3. Migrations desde o último SHA publicado
  const ultimoPublicado = await git(['log', '-1', '--format=%H', '--grep=^Publica main', 'origin/deploy-hostinger']).catch(() => '');
  const shaPublicado = ultimoPublicado ? (ultimoPublicado.match(/main ([0-9a-f]{7,40})/)?.[1] ?? '') : '';
  if (shaPublicado) {
    const mudancas = await git(['diff', '--name-only', shaPublicado, sha, '--', 'migrations', 'schema.sql']).catch(() => '');
    log(`migrations/schema desde ${shaPublicado.slice(0, 12)}: ${mudancas ? mudancas.split('\n').join(', ') : 'nenhuma'}`);
    if (mudancas) log('ATENÇÃO: há migrations novas. Confirme que foram aplicadas no banco antes de publicar.');
  }

  if (!executar) {
    log('\nPlano: gerar o pacote de origin/main numa árvore limpa, conferir, enviar commit à deploy-hostinger por fast-forward e conferir o site.');
    return;
  }

  // 4. Árvore limpa no SHA e build
  const tmp = await mkdtemp(path.join(tmpdir(), 'krieger-publicar-'));
  const arvore = path.join(tmp, 'main');
  const deploy = path.join(tmp, 'deploy');
  try {
    await git(['worktree', 'add', '--detach', arvore, sha]);
    log('Gerando o frontend (npm ci e build)...');
    await sh('npm', ['ci'], { cwd: path.join(arvore, 'frontend') });
    await sh('npm', ['run', 'build'], { cwd: path.join(arvore, 'frontend') });
    await sh('npm', ['ci'], { cwd: arvore });
    await sh('npm', ['run', 'package:hostinger'], { cwd: arvore });
    const pacote = path.join(arvore, 'dist', 'hostinger');
    await access(path.join(pacote, '.htaccess'));
    const indice = await readFile(path.join(pacote, 'index.html'), 'utf8');
    const bundle = indice.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
    if (!bundle) falhar('o index.html do pacote não referencia o bundle principal.');
    await access(path.join(pacote, bundle));
    log(`Pacote conferido: ${bundle}`);

    // 5. Commit na deploy-hostinger, por fast-forward
    await git(['worktree', 'add', '--detach', deploy, 'origin/deploy-hostinger']);
    for (const item of await readdir(deploy)) {
      if (item === '.git') continue;
      await rm(path.join(deploy, item), { recursive: true, force: true });
    }
    await cp(pacote, deploy, { recursive: true });
    await sh('git', ['-C', deploy, 'add', '-A']);
    const mudou = await sh('git', ['-C', deploy, 'status', '--porcelain']);
    if (!mudou) falhar('o pacote é idêntico ao publicado; nada a enviar.');
    await sh('git', ['-C', deploy, '-c', 'user.name=publicacao', '-c', 'user.email=publicacao@localhost', 'commit', '-q', '-m', `Publica main ${sha.slice(0, 7)} na Hostinger\n\nPacote gerado por scripts/publicar-hostinger.mjs a partir de ${sha}.`]);
    await sh('git', ['-C', deploy, 'push', 'origin', 'HEAD:deploy-hostinger']);
    log('Enviado à deploy-hostinger (fast-forward).');

    // 6. Conferência do site
    if (dominio) {
      log(`Conferindo https://${dominio}/ ...`);
      let ok = false;
      for (let i = 0; i < 6 && !ok; i++) {
        await new Promise((r) => setTimeout(r, 25000));
        const html = await fetch(`https://${dominio}/`).then((r) => r.text()).catch(() => '');
        ok = html.includes(bundle);
        log(ok ? `No ar: ${bundle}` : `Ainda não atualizou (tentativa ${i + 1}/6).`);
      }
      if (!ok) falhar(`o site ainda não serve ${bundle}. Verifique o auto-deploy da Hostinger.`);
    }
    log('\nPublicação concluída.');
  } finally {
    await git(['worktree', 'remove', '--force', arvore]).catch(() => {});
    await git(['worktree', 'remove', '--force', deploy]).catch(() => {});
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((erro) => falhar(erro.message));
