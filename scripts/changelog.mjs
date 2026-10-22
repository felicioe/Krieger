import { readFile, writeFile } from 'node:fs/promises';
const origem = new URL('../frontend/src/data/versoes.json', import.meta.url);
const destino = new URL('../CHANGELOG.md', import.meta.url);
const dados = JSON.parse(await readFile(origem, 'utf8'));
const versaoValida = (v) => typeof v === 'string' && /^[0-9]+\.[0-9]{1,2}$/.test(v);
if (!versaoValida(dados.versaoAtual) || !Array.isArray(dados.versoes) || dados.versoes.length === 0) {
  throw new Error('Versão atual e histórico precisam estar preenchidos.');
}
if (dados.versoes[0]?.versao !== dados.versaoAtual) throw new Error('Versão atual deve ser a primeira do histórico.');
const vistos = new Set();
const texto = (s) => typeof s === 'string' && s.trim().length > 0 && !/[\r\n]/.test(s);
for (const item of dados.versoes) {
  if (!versaoValida(item.versao) || vistos.has(item.versao) || !texto(item.titulo)
      || !Array.isArray(item.alteracoes) || !item.alteracoes.length || !item.alteracoes.every(texto)) {
    throw new Error('Registro de alterações inválido ou versão repetida.');
  }
  vistos.add(item.versao);
}
const esperado = '# Registro de Alterações\n\n'
  + '<!-- Gerado por npm run changelog:gerar. Fonte única: frontend/src/data/versoes.json. -->\n\n'
  + 'Versão atual: **' + dados.versaoAtual + '**.\n\n'
  + dados.versoes.map((v) => '## ' + v.versao + ' — ' + v.titulo + '\n\n'
    + v.alteracoes.map((a) => '- ' + a).join('\n')).join('\n\n') + '\n';
if (process.argv.includes('--check')) {
  const atual = await readFile(destino, 'utf8');
  if (atual.replace(/\r\n/g, '\n') !== esperado) throw new Error('CHANGELOG.md desatualizado. Rode npm run changelog:gerar.');
  console.log('Versão e changelog consistentes: ' + dados.versaoAtual);
} else {
  await writeFile(destino, esperado);
  console.log('CHANGELOG.md gerado para a versão ' + dados.versaoAtual);
}
