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
