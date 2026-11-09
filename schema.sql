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

-- Histórico de índices de correção aplicados por condomínio.
CREATE TABLE IF NOT EXISTS kr_indices_condominio (
  id VARCHAR(64) PRIMARY KEY,
  condo_id VARCHAR(64) NOT NULL,
  ano INT NOT NULL,
  indice DECIMAL(10, 4) NOT NULL,
  tipo VARCHAR(50), -- ex: 'IGP-M', 'INPC', 'Manual'
  mes_referencia INT, -- opcional
  data_aplicacao DATETIME NOT NULL,
  INDEX idx_condo_ano (condo_id, ano)
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

-- Log: toda vez que uma reimportação de PDF encontra um relatório mensal ou prestação de contas
-- que já tinha dados gravados, e o usuário decide, conta a conta, manter o valor gravado ou usar o
-- novo (ver `domain/importacao.ts`, `compararDemonstrativos`). Mesmo padrão id/dados das demais
-- tabelas; o JSON em `dados` segue `DecisaoConflitoImportacao` (domain/types.ts). Só gravado, nunca
-- editado/apagado pela tela.
CREATE TABLE IF NOT EXISTS kr_decisoes_importacao (
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

-- Permissoes granulares: catalogo de chaves, perfis e concessoes por usuario.
-- Mesmo conteudo de migrations/20261031_permissoes_granulares.sql (idempotente, INSERT IGNORE),
-- pra que uma instalacao nova ja nasca com o catalogo.
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
('admin','SuperADM','Acesso total; administra usuários, perfis e permissões',NOW()),
('adm','ADM','Operação do sistema sem as telas de administração',NOW()),
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

-- ADM: opera o sistema, mas sem as telas de administração (usuários, backup e escritório).
-- Fica no fim do bloco para alcançar também as permissões de edição criadas acima.
INSERT IGNORE INTO kr_perfil_permissoes (perfil_id, permissao_chave)
SELECT 'adm', chave FROM kr_permissoes
WHERE chave NOT IN ('usuarios.visualizar','backup.visualizar','escritorio.visualizar','escritorio.editar');

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
  tipo VARCHAR(32) NOT NULL DEFAULT 'outro',
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
