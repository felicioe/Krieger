// Relatório final de prestação de contas — ver docs/ESPECIFICACAO-V2.md.
// Documento único: capa, demonstrativo, considerações finais, previsão orçamentária (com
// ajustes), previsto × realizado, análise gráfica, inadimplência, notas explicativas e assinatura.
// O usuário escolhe quais seções incluir; conferência dos totais antes de emitir.
import type { Exercicio } from './types';

export interface SecoesRelatorioFinal {
  capa: boolean;
  demonstrativo: boolean;
  consideracoesFinais: boolean;
  previsaoOrcamentaria: boolean;
  previstoRealizado: boolean;
  analiseGrafica: boolean;
  inadimplencia: boolean;
  notasExplicativas: boolean;
  assinatura: boolean;
}

export function montarRelatorioFinal(_exercicio: Exercicio, _secoes: SecoesRelatorioFinal) {
  throw new Error('não implementado');
}
