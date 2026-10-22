import { describe, expect, it } from 'vitest';
import { lerRelatorio } from './pdfParser';
import { resumoConferencia } from './importacao';
const base = lerRelatorio('(*) SALDO ANTERIOR\n    Banco          1.000,00', 'teste.pdf');
const ok = { somaItens: 1000, totalRelatorio: 1000, confere: true };
describe('cobertura da conferência de importação', () => {
  it('não confirma PDF sem totais ou conferência', () => {
    const { conferencia: removida, ...semConferencia } = base;
    for (const rel of [semConferencia, { ...base, conferencia: {} }]) {
      expect(resumoConferencia(rel)).toMatchObject({ ok: false, estado: 'nao_verificado', comparacoes: 0, esperadas: 4 });
    }
  });
  it('distingue comparação parcial, completa e divergente', () => {
    expect(resumoConferencia({ ...base, conferencia: { saldoAnterior: ok } })).toMatchObject({ estado: 'parcial', ok: false, comparacoes: 1 });
    const conferencia = { saldoAnterior: ok, receitas: ok, despesas: ok, saldoAtual: ok };
    expect(resumoConferencia({ ...base, conferencia })).toMatchObject({ estado: 'verificado', ok: true, comparacoes: 4 });
    expect(resumoConferencia({ ...base, conferencia: { ...conferencia, receitas: { ...ok, confere: false } } })).toMatchObject({ estado: 'divergente', ok: false });
  });
  it('comparativo sem linhas comparadas não vira sucesso', () => {
    expect(resumoConferencia({ ...base, layout: 'comparativo', conferencia: { linhasConferidas: 0, divergentes: [] } })).toMatchObject({ estado: 'nao_verificado', ok: false });
  });
});
