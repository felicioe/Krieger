-- Três níveis de acesso: SuperADM (admin), ADM (adm) e Usuário (user).
-- Aplicar somente após backup. Idempotente: pode rodar mais de uma vez.
--
-- O valor gravado do SuperADM continua 'admin'. Renomear esse valor exigiria migrar
-- a coluna, reescrever as guardas do PHP e reabrir o risco de login; a troca para
-- "SuperADM" é só de rótulo na interface.
--
-- O ADM recebe tudo o que o Usuário recebe, menos as telas de administração.
-- O SuperADM continua com acesso total em código (permissoes_usuario devolve ['*'])
-- e pode ajustar a matriz do ADM em Usuários > Perfis.

INSERT IGNORE INTO kr_perfis (id,nome,descricao,criado_em) VALUES
('admin','SuperADM','Acesso total; administra usuários, perfis e permissões',NOW()),
('adm','ADM','Operação do sistema sem as telas de administração',NOW()),
('user','Usuário','Acesso definido por permissões',NOW());

-- Atualiza o nome exibido do SuperADM em instalações que já tinham o perfil 'admin'.
UPDATE kr_perfis SET nome = 'SuperADM',
  descricao = 'Acesso total; administra usuários, perfis e permissões'
WHERE id = 'admin';

-- Garante que todas as chaves do catálogo chegam ao ADM, exceto a administração.
INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'adm', chave FROM kr_permissoes
WHERE chave NOT IN ('usuarios.visualizar','backup.visualizar','escritorio.visualizar','escritorio.editar');

-- Se o catálogo crescer depois, o ADM não herda a chave nova automaticamente:
-- isso é intencional, para que uma permissão recém-criada não amplie acesso sem decisão.
