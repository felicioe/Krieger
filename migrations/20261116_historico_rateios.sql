-- Histórico de rateios travados por condomínio/ano (16/11/2026).
-- Aplicar somente após backup. Idempotente: CREATE TABLE IF NOT EXISTS, rodar de novo não altera nada.
--
-- Cada exercício cujo rateio foi "travado" (botão "Travar rateio no histórico" na tela de
-- previsão orçamentária) ou importado do Systemar (prestação de contas) gera uma linha aqui.
-- É a fonte acumulativa que permite: (a) o relatório final mostrar o rateio do ano anterior;
-- (b) o exercício seguinte herdar o rateio atual automaticamente; (c) calcular a variação %
-- entre anos sem depender de recálculo.
--
-- Fonte do valor: 'importacao' (PDF do Systemar) ou 'calculo' (tela de previsão).
-- A chave única (condo_id, ano) garante uma linha por exercício.

CREATE TABLE IF NOT EXISTS kr_historico_rateios (
  id VARCHAR(64) PRIMARY KEY,
  condo_id VARCHAR(64) NOT NULL,
  ano INT NOT NULL,
  rateio_atual DECIMAL(14,2) NULL,
  rateio_sugerido DECIMAL(14,2) NULL,
  variacao DECIMAL(10,6) NULL,
  rateio_aprovado DECIMAL(14,2) NOT NULL,
  travado_em DATETIME NOT NULL,
  fonte VARCHAR(32) NULL,
  exercicio_id VARCHAR(64) NULL,
  dados JSON NULL,
  UNIQUE KEY uk_hist_rateio (condo_id, ano),
  INDEX idx_condo_ano (condo_id, ano)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
