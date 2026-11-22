-- Previsto aprovado por condomínio e exercício de destino (issue #285).
-- O previsto é o simples: realizado de cada conta do exercício-base × (1 + percentual aprovado),
-- com o percentual vindo do histórico de rateios. Uma linha vigente por condomínio e exercício de
-- destino; a versão anterior fica resumida na coluna `anterior` quando a linha é substituída.
-- Aplicar ANTES de publicar o código das etapas #285/#286 que grava nesta tabela; a leitura do
-- sistema tolera a ausência da tabela. Rollback: DROP TABLE kr_previsoes_aprovadas (os relatórios
-- voltam a derivar o previsto do exercício anterior).
CREATE TABLE IF NOT EXISTS kr_previsoes_aprovadas (
  id VARCHAR(64) PRIMARY KEY,
  condo_id VARCHAR(64) NOT NULL,
  exercicio_destino INT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  exercicio_base_id VARCHAR(64) NULL,
  percentual_aprovado DECIMAL(10,6) NOT NULL,
  total_previsto DECIMAL(14,2) NOT NULL,
  detalhamento JSON NOT NULL,
  origem VARCHAR(32) NOT NULL,
  aprovado_em DATETIME NOT NULL,
  aprovado_por VARCHAR(64) NULL,
  anterior JSON NULL,
  UNIQUE KEY uk_previsao_condo_destino (condo_id, exercicio_destino),
  INDEX idx_previsao_condo (condo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
