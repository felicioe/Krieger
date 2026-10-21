-- Esquema do banco do Sistema Krieger (condomínios). Importe uma vez, pelo phpMyAdmin do Hostinger.
CREATE TABLE IF NOT EXISTS kr_condominios (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_exercicios (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_mensais (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_assembleias (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_modelos (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_config (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela transitória (staging): relatórios lidos do PDF aguardando confirmação do usuário.
-- Cada registro guarda o JSON completo do relatório; status: pendente | confirmado | descartado.
CREATE TABLE IF NOT EXISTS kr_importacoes (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Controle de acesso: usuários do sistema (perfil 'admin' ou 'user') e controle de tentativas de login.
CREATE TABLE IF NOT EXISTS kr_usuarios (
  id VARCHAR(32) PRIMARY KEY,
  login VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(10) NOT NULL DEFAULT 'user',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  trocar_senha TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL,
  ultimo_acesso DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kr_login_tentativas (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  chave VARCHAR(160) NOT NULL,
  criado_em DATETIME NOT NULL,
  KEY idx_chave (chave, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Atas de assembleia (rascunhos e atas finalizadas).
CREATE TABLE IF NOT EXISTS kr_atas (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backups gerados no servidor (histórico, com o usuário que gerou cada um). Guarda uma cópia
-- completa dos dados (mesmo formato do backup exportado em arquivo); o download pra mídia
-- externa (a=backup_baixar) lê daqui, não precisa reexportar do zero.
CREATE TABLE IF NOT EXISTS kr_backups (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  gerado_por VARCHAR(32) NOT NULL,
  gerado_por_nome VARCHAR(120) NOT NULL,
  criado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
