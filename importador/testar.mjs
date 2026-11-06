// Uso: node testar.mjs arquivo.pdf [...]   (requer pdftotext)
import { execFileSync } from 'node:child_process';
import { lerRelatorio, cadastroBasico } from './parser.mjs';
for (const f of process.argv.slice(2)) {
  const txt = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
  const r = lerRelatorio(txt, f);
  console.log('\n##', f.replace(/^.*\//, ''));
  console.log(JSON.stringify({ layout: r.layout, condominio: r.condominio, periodo: r.periodo, cadastro: cadastroBasico(r), meses: r.meses, conferencia: r.conferencia,
    qtdItens: { receitas: r.receitas?.itens.length, despesas: r.despesas?.itens.length, saldoAtual: r.saldoAtual?.itens.length } }, null, 1));
}
