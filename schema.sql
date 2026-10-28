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

-- PDFs anexados a uma Prestação de Contas (exercício) já existente, como referência/auditoria
-- (ex.: Comparativo Financeiro) — não viram lançamento no demonstrativo. Mesmo padrão id/dados das
-- demais tabelas; o JSON em `dados` segue `AnexoImportado` (domain/types.ts).
CREATE TABLE IF NOT EXISTS kr_anexos_importacao (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Log: toda vez que a Previsão sugerida (categorias lidas do PDF) diverge dos totais que o próprio
-- PDF já trazia prontos (ver `domain/previsaoSugerida.ts`) e o usuário decide manter os valores
-- calculados mesmo assim. Mesmo padrão id/dados das demais tabelas; o JSON em `dados` segue
-- `DecisaoDivergenciaPrevisao` (domain/types.ts). Só gravado, nunca editado/apagado pela tela.
CREATE TABLE IF NOT EXISTS kr_decisoes_previsao (
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

-- Consulta Inteligente de Documentos: ao contrário das tabelas acima (id+dados JSON genérico),
-- estas são relacionais de verdade — precisam de índice real (hash, condo_id, FULLTEXT), que um
-- blob JSON não dá de jeito nenhum. Escopo deliberadamente pequeno: só convenção, regimento e
-- atas de assembleia (documentos finais, poucos por condomínio, que raramente mudam) — nunca o
-- acervo financeiro inteiro do NAS.

-- Um PDF de convenção/regimento/ata já indexado para um condomínio. O agente local (fora deste
-- repositório) varre só os nomes de arquivo sob `kr_condominios.pastaDocumentos` e só lê o
-- conteúdo dos que batem com o tipo; aqui fica só o resultado.
CREATE TABLE IF NOT EXISTS kr_documentos (
  id VARCHAR(64) PRIMARY KEY,
  condo_id VARCHAR(64) NOT NULL,
  tipo ENUM('convencao', 'regimento', 'ata') NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho_relativo VARCHAR(1024) NOT NULL,
  hash CHAR(64) NOT NULL,
  tamanho BIGINT UNSIGNED NOT NULL,
  paginas INT UNSIGNED NULL,
  mtime_origem DATETIME NULL,
  status ENUM('ok', 'erro') NOT NULL DEFAULT 'ok',
  erro TEXT NULL,
  indexado_em DATETIME NOT NULL,
  UNIQUE KEY uq_condo_caminho (condo_id, caminho_relativo(255)),
  KEY idx_condo (condo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Texto extraído de cada documento, dividido por página — é o que a busca local (FULLTEXT)
-- pesquisa, e o que vira contexto pro Claude quando a busca local não basta.
CREATE TABLE IF NOT EXISTS kr_documento_trechos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  documento_id VARCHAR(64) NOT NULL,
  condo_id VARCHAR(64) NOT NULL,
  pagina_inicial INT UNSIGNED NOT NULL,
  pagina_final INT UNSIGNED NOT NULL,
  texto MEDIUMTEXT NOT NULL,
  KEY idx_documento (documento_id),
  KEY idx_condo (condo_id),
  FULLTEXT KEY ft_texto (texto),
  CONSTRAINT fk_trecho_documento FOREIGN KEY (documento_id) REFERENCES kr_documentos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cache persistente de respostas (zero tokens do Claude quando bate). `versao_indices` resume o
-- estado dos documentos do condomínio no momento da resposta (ex.: contagem + última indexação);
-- mudou algum documento do condomínio, a combinação única muda e o cache antigo fica inacessível
-- sozinho — sem precisar de rotina de invalidação à parte.
CREATE TABLE IF NOT EXISTS kr_consulta_cache (
  id VARCHAR(64) PRIMARY KEY,
  condo_id VARCHAR(64) NOT NULL,
  pergunta_hash CHAR(64) NOT NULL,
  pergunta_normalizada TEXT NOT NULL,
  resposta LONGTEXT NOT NULL,
  versao_indices VARCHAR(64) NOT NULL,
  criado_em DATETIME NOT NULL,
  usado_em DATETIME NOT NULL,
  usos INT UNSIGNED NOT NULL DEFAULT 1,
  expira_em DATETIME NULL,
  UNIQUE KEY uq_cache (condo_id, pergunta_hash, versao_indices)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Histórico e custo de cada consulta, qualquer que seja a origem da resposta — base dos
-- indicadores administrativos (quantas respostas vieram do cache/local/Claude, custo estimado).
CREATE TABLE IF NOT EXISTS kr_consulta_historico (
  id VARCHAR(64) PRIMARY KEY,
  usuario_id VARCHAR(32) NOT NULL,
  condo_id VARCHAR(64) NOT NULL,
  pergunta TEXT NOT NULL,
  origem ENUM('cache', 'local', 'claude') NOT NULL,
  tokens_entrada INT UNSIGNED NOT NULL DEFAULT 0,
  tokens_saida INT UNSIGNED NOT NULL DEFAULT 0,
  custo_estimado_centavos INT UNSIGNED NOT NULL DEFAULT 0,
  duracao_ms INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ok', 'sem_evidencia', 'erro') NOT NULL,
  criado_em DATETIME NOT NULL,
  KEY idx_condo (condo_id),
  KEY idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
