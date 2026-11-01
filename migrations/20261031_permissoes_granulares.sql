-- Permissões granulares do Krieger.
-- Aplicar somente após backup. Compatível com usuários existentes.
CREATE TABLE IF NOT EXISTS kr_permissoes (
  chave VARCHAR(120) PRIMARY KEY,
  modulo VARCHAR(60) NOT NULL,
  tela VARCHAR(80) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_perfis (
  id VARCHAR(32) PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_perfil_permissoes (
  perfil_id VARCHAR(32) NOT NULL,
  permissao_chave VARCHAR(120) NOT NULL,
  PRIMARY KEY (perfil_id, permissao_chave),
  CONSTRAINT fk_kr_perfil_perm_perfil FOREIGN KEY (perfil_id) REFERENCES kr_perfis(id) ON DELETE CASCADE,
  CONSTRAINT fk_kr_perfil_perm_perm FOREIGN KEY (permissao_chave) REFERENCES kr_permissoes(chave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_usuario_permissoes (
  usuario_id VARCHAR(32) NOT NULL,
  permissao_chave VARCHAR(120) NOT NULL,
  efeito ENUM('permitir','negar') NOT NULL DEFAULT 'permitir',
  PRIMARY KEY (usuario_id, permissao_chave),
  CONSTRAINT fk_kr_usuario_perm_usuario FOREIGN KEY (usuario_id) REFERENCES kr_usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_kr_usuario_perm_perm FOREIGN KEY (permissao_chave) REFERENCES kr_permissoes(chave) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO kr_perfis (id,nome,descricao,criado_em) VALUES
('admin','Administrador','Acesso total ao sistema',NOW()),
('user','Usuário','Acesso definido por permissões',NOW());

-- Catálogo inicial: preserva o acesso atual dos usuários comuns até o administrador ajustar a matriz.
INSERT IGNORE INTO kr_permissoes (chave,modulo,tela,acao,descricao,criado_em) VALUES
('painel.visualizar','geral','painel','visualizar','Visualizar painel',NOW()),
('condominios.visualizar','cadastros','condominios','visualizar','Visualizar condomínios',NOW()),
('prestacao_contas.visualizar','financeiro','prestacao_contas','visualizar','Visualizar prestação de contas',NOW()),
('previsao_orcamentaria.visualizar','financeiro','previsao_orcamentaria','visualizar','Visualizar previsão orçamentária',NOW()),
('previsto_realizado.visualizar','financeiro','previsto_realizado','visualizar','Visualizar previsto e realizado',NOW()),
('relatorio_mensal.visualizar','financeiro','relatorio_mensal','visualizar','Visualizar relatório mensal',NOW()),
('importador.visualizar','financeiro','importador','visualizar','Visualizar importador',NOW()),
('editais.visualizar','assembleias','editais','visualizar','Visualizar editais',NOW()),
('atas.visualizar','assembleias','atas','visualizar','Visualizar atas',NOW()),
('modelos.visualizar','assembleias','modelos','visualizar','Visualizar modelos de edital',NOW()),
('drive_documentos.visualizar','documentos','drive_documentos','visualizar','Visualizar Drive de Documentos',NOW()),
('consulta_documentos.visualizar','documentos','consulta_documentos','visualizar','Visualizar consulta inteligente',NOW()),
('escritorio.visualizar','administracao','escritorio','visualizar','Visualizar escritório',NOW()),
('backup.visualizar','administracao','backup','visualizar','Visualizar backup',NOW()),
('usuarios.visualizar','administracao','usuarios','visualizar','Visualizar usuários',NOW());
INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'user', chave FROM kr_permissoes;

INSERT IGNORE INTO kr_permissoes (chave,modulo,tela,acao,descricao,criado_em) VALUES
('condominios.editar','cadastros','condominios','editar','Editar condomínios',NOW()),
('prestacao_contas.editar','financeiro','prestacao_contas','editar','Editar prestação de contas',NOW()),
('previsao_orcamentaria.editar','financeiro','previsao_orcamentaria','editar','Editar previsão orçamentária',NOW()),
('relatorio_mensal.editar','financeiro','relatorio_mensal','editar','Editar relatório mensal',NOW()),
('importador.editar','financeiro','importador','editar','Executar importador',NOW()),
('editais.editar','assembleias','editais','editar','Editar editais',NOW()),
('atas.editar','assembleias','atas','editar','Editar atas',NOW()),
('modelos.editar','assembleias','modelos','editar','Editar modelos',NOW()),
('drive_documentos.editar','documentos','drive_documentos','editar','Editar Drive de Documentos',NOW()),
('escritorio.editar','administracao','escritorio','editar','Editar escritório',NOW());
INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'user', chave FROM kr_permissoes;
