import { describe, expect, it } from 'vitest';
import { lerConsideracoesFinais } from './pdfParser';
import { aplicarConsideracoesAoExercicio } from './importacao';
import { condominioPadrao } from './condominio';
import { exercicioPadrao } from './exercicio';
import { inicializarIndicesImportados } from './indicesCondominio';

const linha = (ano: number, valor: string) => `Índice de correção aplicado no condomínio em ${ano} ... ${valor}`;
const ler = (...linhas: string[]) => lerConsideracoesFinais(['CONSIDERAÇÕES FINAIS', ...linhas].join('\n'))!;

describe('formatos de índices dos PDFs Systemar', () => {
  it.each(['% 4,05', '4,05%', '4,05 %'])('lê o formato %s', (valor) => {
    expect(ler(linha(2024, valor)).indices).toEqual([{ ano: 2024, pct: 4.05 }]);
  });
  it('mantém o ano de cada percentual e aceita zero e negativos', () => {
    expect(ler(linha(2021, '15,00%'), linha(2022, '13,00%'), linha(2023, '7,70%'), linha(2024, '% 0,00'), linha(2025, '-2,50%')).indices).toEqual([
      { ano: 2021, pct: 15 }, { ano: 2022, pct: 13 }, { ano: 2023, pct: 7.7 }, { ano: 2024, pct: 0 }, { ano: 2025, pct: -2.5 },
    ]);
  });
  it('não toma valor da linha seguinte nem confunde índice sugerido com aplicado', () => {
    expect(ler(linha(2023, '%'), linha(2024, '12,98%'), 'Índice sugerido para correção do condomínio ... 20,00%').indices).toEqual([{ ano: 2024, pct: 12.98 }]);
  });
  it('leva o percentual lido ao exercício e ao cadastro inicialmente vazio', () => {
    const c = { ...condominioPadrao(), id: 'ficticio' };
    const e = { ...exercicioPadrao(c, 2025), id: 'ex-ficticio' };
    e.consid = aplicarConsideracoesAoExercicio(e.consid, ler(linha(2024, '12,98%')));
    expect(e.consid.indices).toEqual([{ ano: 2024, pct: 12.98 }]);
    expect(inicializarIndicesImportados(c, e).indices).toEqual([{ ano: 2024, pct: 12.98, noRelatorio: true }]);
    const manual = { ...c, indices: [], indicesInicializados: true };
    expect(inicializarIndicesImportados(manual, e)).toBe(manual);
  });
});
