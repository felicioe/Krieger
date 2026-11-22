-- Campos de override manual para rateio histórico e variação % histórica (21/11/2026).
-- Aplicar somente após backup. Idempotente: ALTER TABLE com IF NOT EXISTS via procedimento.
--
-- Quando o usuário edita manualmente o "Rateio histórico" ou "% histórico" na tela de
-- previsão orçamentária, os valores são salvos nestes campos e prevalecem sobre os
-- calculados automaticamente pelo sistema a partir do historico_rateios.
-- NULL = usar valor calculado pelo sistema; valor preenchido = override manual.

ALTER TABLE kr_exercicios ADD COLUMN IF NOT EXISTS rateio_historico_manual DECIMAL(14,2) NULL AFTER rateio_aprovado;
ALTER TABLE kr_exercicios ADD COLUMN IF NOT EXISTS variacao_historica_manual DECIMAL(10,6) NULL AFTER rateio_historico_manual;