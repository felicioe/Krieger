-- Permissão da aba Configuração do cadastro do condomínio (regras, rubricas, arredondamento e de-para).
-- Antes, a aba aparecia para perfis admin e adm por checagem fixa de perfil, fora da matriz.
-- Aplicar somente após backup. Idempotente: INSERT IGNORE não duplica.
-- O perfil ADM recebe a permissão para manter o comportamento atual; o perfil Usuário não recebe.
INSERT IGNORE INTO kr_permissoes (chave, modulo, tela, acao, descricao, criado_em) VALUES
('condominios.configurar','condominios','configurar','configurar','Alterar a configuração do condomínio (regras, rubricas, arredondamento e de-para)',NOW());

INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'adm', chave FROM kr_permissoes WHERE chave = 'condominios.configurar';
