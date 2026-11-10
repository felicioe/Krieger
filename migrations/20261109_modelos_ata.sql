-- Modelos de ata por cartório/cidade (issue #256).
-- Store independente de `kr_modelos` (editais): cada registro guarda um layout de ata
-- (texto corrido, variáveis {{ata.*}}, opções de logo/borda) vinculado a cidade+cartório.
-- Modelo sem cidade = geral; sem cartório = vale para qualquer cartório da cidade.
CREATE TABLE IF NOT EXISTS kr_modelos_ata (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permissões da nova tela (catálogo + matriz padrão do ADM).
INSERT IGNORE INTO kr_permissoes (chave, modulo, tela, acao, descricao, criado_em) VALUES
('modelos_ata.visualizar','assembleias','modelos_ata','visualizar','Visualizar modelos de ata',NOW()),
('modelos_ata.editar','assembleias','modelos_ata','editar','Editar modelos de ata',NOW());

-- O perfil ADM herda as novas chaves (mesma regra das demais telas de assembleias).
INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'adm', chave FROM kr_permissoes
WHERE chave IN ('modelos_ata.visualizar','modelos_ata.editar');

-- Usuários comuns também recebem acesso visualização na instalação nova.
INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'user', chave FROM kr_permissoes
WHERE chave = 'modelos_ata.visualizar';