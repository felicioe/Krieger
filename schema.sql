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
('modelos_ata.visualizar','assembleias','modelos_ata','visualizar','Visualizar modelos de ata',NOW()),
('modelos_ata.editar','assembleias','modelos_ata','editar','Editar modelos de ata',NOW()),
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

-- Modelos de ata por cartório/cidade (issue #256).
-- Store independente de `kr_modelos` (editais): cada registro guarda um layout de ata
-- (texto corrido, variáveis {{ata.*}}, opções de logo/borda) vinculado a cidade+cartório.
-- Modelo sem cidade = geral; sem cartório = vale para qualquer cartório da cidade.
CREATE TABLE IF NOT EXISTS kr_modelos_ata (
  id VARCHAR(64) PRIMARY KEY,
  dados LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Modelos de ata prontos por município (mesmo conteúdo de
-- migrations/20261111_modelos_ata_por_cidade.sql), para uma instalação nova já nascer com eles.
REPLACE INTO kr_modelos_ata (id, dados, atualizado_em) VALUES
  ('mod-ata-lago-negro-ordinaria', '{"id":"mod-ata-lago-negro-ordinaria","nome":"Lago Negro — Ordinária (Rancho Queimado)","cidade":"Rancho Queimado","cartorio":"","tipo":"ordinaria","texto":"# ATA DA ASSEMBLEIA GERAL ORDINÁRIA\\n\\n## {{condominio.nomeRelatorio}}\\n\\nAos {{ata.dataExtenso}}, às {{ata.hora}}, no {{ata.local}}, na modalidade {{ata.modalidade}}, reuniram-se os senhores condôminos do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ {{condominio.cnpj}}, para a realização de Assembleia Geral Ordinária.\\n\\nA reunião atendeu ao edital de convocação regularmente expedido a todos os condôminos por meio eletrônico. Feita a abertura dos trabalhos, os senhores condôminos indicaram para a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, e para o cargo de secretário(a) o Sr(a). {{ata.mesa.secretario}}, o que foi aprovado por unanimidade.\\n\\n## Unidades presentes\\n\\n{{ata.unidades}}\\n\\nQuórum: {{ata.quorumTexto}}.\\n\\n## Nos termos da Lei Geral de Proteção de Dados (LGPD)\\n\\nTodos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento. Ficou consignado que todo condômino que queira ver sua sugestão, reclamação ou informação registrada em ata deve solicitá-lo, sob pena de o assunto ser considerado conversa paralela.\\n\\n## Ordem do dia\\n\\n{{ata.itensTexto}}\\n\\n## Encerramento\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o presidente da mesa solicitou ao secretário a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, dando-se por encerrada a assembleia. Os condôminos presentes outorgam poderes ao secretário para redigir, assinar, transcrever e registrar em livro próprio a presente ata, devendo cópia ser remetida a todos por meio eletrônico.\\n\\n## Observações\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nPresidente da mesa\\n\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretário(a)","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-lago-negro-extraordinaria', '{"id":"mod-ata-lago-negro-extraordinaria","nome":"Lago Negro — Extraordinária (Rancho Queimado)","cidade":"Rancho Queimado","cartorio":"","tipo":"extraordinaria","texto":"# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA\\n\\n## {{condominio.nomeRelatorio}}\\n\\nAos {{ata.dataExtenso}}, às {{ata.hora}}, no {{ata.local}}, na modalidade {{ata.modalidade}}, reuniram-se os senhores condôminos do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ {{condominio.cnpj}}, para a realização de Assembleia Geral Extraordinária, convocada por edital regularmente expedido a todos os condôminos por meio eletrônico.\\n\\nFeita a abertura dos trabalhos, os senhores condôminos indicaram para a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, e para o cargo de secretário(a) o Sr(a). {{ata.mesa.secretario}}, o que foi aprovado por unanimidade. Empossados, o secretário fez a leitura do edital de convocação.\\n\\n## Unidades presentes\\n\\n{{ata.unidades}}\\n\\nQuórum: {{ata.quorumTexto}}.\\n\\n## Nos termos da Lei Geral de Proteção de Dados (LGPD)\\n\\nTodos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.\\n\\n## Ordem do dia\\n\\n{{ata.itensTexto}}\\n\\n## Encerramento\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o presidente da mesa solicitou ao secretário a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, dando-se por encerrada a assembleia. Os condôminos presentes outorgam poderes ao secretário para redigir, assinar, transcrever e registrar em livro próprio a presente ata, devendo cópia ser remetida a todos por meio eletrônico.\\n\\n## Observações\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nPresidente da mesa\\n\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretário(a)","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-balneario-camboriu-ordinaria', '{"id":"mod-ata-balneario-camboriu-ordinaria","nome":"Balneário Camboriú — Ordinária","cidade":"Balneário Camboriú","cartorio":"","tipo":"ordinaria","texto":"# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO\\n\\n## {{condominio.nomeRelatorio}}\\n\\nRealizada aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, na modalidade {{ata.modalidade}}, nas dependências do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ sob número {{condominio.cnpj}}, realizou-se a Assembleia Geral Ordinária, estando presentes neste evento os condôminos proprietários ou representantes legais das unidades autônomas denominadas: {{ata.unidades}}. Presente também o(a) representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.\\n\\nA reunião atendeu ao edital de convocação regularmente expedido a todos os condôminos através de carta registrada enviada pelo correio para os não residentes e carta protocolada para os residentes. Feita a abertura dos trabalhos, foi indicado através dos presentes para assumir a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade. Empossados, e a pedido, o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:\\n\\n{{ata.itensTexto}}\\n\\nNos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento. Ficou consignado que todo condômino que queira ver sua sugestão, reclamação ou informação registrada em ata deve solicitá-lo, sob pena de o assunto ser considerado conversa paralela.\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o(a) presidente da mesa Sr(a). {{ata.mesa.presidente}} solicitou ao(à) secretário(a) a leitura para os presentes do resumo dos itens tratados nesta reunião, sendo aprovados, dando assim encerramento à presente assembleia. Os condôminos presentes nesta assembleia também autorizam o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos por meio eletrônico.\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nPresidente da mesa\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretário(a)","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-balneario-camboriu-extraordinaria', '{"id":"mod-ata-balneario-camboriu-extraordinaria","nome":"Balneário Camboriú — Extraordinária","cidade":"Balneário Camboriú","cartorio":"","tipo":"extraordinaria","texto":"# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO\\n\\n## {{condominio.nomeRelatorio}}\\n\\nAos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, na modalidade {{ata.modalidade}}, com transmissão ao vivo para todos os moradores por meio de link encaminhado, reuniram-se para realização da Assembleia Geral Extraordinária do {{condominio.nomeRelatorio}}, situado em {{condominio.enderecoEdital}}, inscrito no CNPJ sob número {{condominio.cnpj}}. Participaram da assembleia os condôminos proprietários e/ou representantes legais das unidades autônomas denominadas: {{ata.unidades}}. Presente também o(a) representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.\\n\\nA Assembleia atendeu ao edital de convocação regularmente expedido a todos os condôminos, sendo enviado pelo correio através de carta registrada para os não residentes e carta protocolada para os residentes. Feita a abertura dos trabalhos, foi indicada para presidir os trabalhos o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade. Empossados, o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:\\n\\n{{ata.itensTexto}}\\n\\nNos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o(a) presidente da mesa solicitou ao(à) secretário(a) a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, dando-se por encerrada a assembleia. Os condôminos presentes autorizam, após o(a) presidente da mesa aprovar o texto, o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos através de meio eletrônico.\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nPresidente da mesa\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretária","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-camboriu-ordinaria', '{"id":"mod-ata-camboriu-ordinaria","nome":"Camboriú — Ordinária","cidade":"Camboriú","cartorio":"","tipo":"ordinaria","texto":"# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO\\n\\n## {{condominio.nomeRelatorio}}\\n\\nA Assembleia Geral Ordinária do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ nº {{condominio.cnpj}}, foi aberta aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, na modalidade {{ata.modalidade}}, para explanação e debate dos itens da pauta. Participaram da assembleia os condôminos proprietários ou representantes legais das unidades condominiais: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.\\n\\nFoi indicado para presidir a mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade dos presentes. Empossados, o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:\\n\\n{{ata.itensTexto}}\\n\\nNos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o(a) presidente da mesa solicitou ao(à) secretário(a) a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, encerrando-se a assembleia. Os condôminos presentes autorizam o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos por meio eletrônico.\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\n(Secretário)\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\n(Presidente)","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-camboriu-extraordinaria', '{"id":"mod-ata-camboriu-extraordinaria","nome":"Camboriú — Extraordinária","cidade":"Camboriú","cartorio":"","tipo":"extraordinaria","texto":"# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO\\n\\n## {{condominio.nomeRelatorio}}\\n\\nAos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, nas dependências do condomínio, reuniram-se para realização da Assembleia Geral Extraordinária do {{condominio.nomeRelatorio}}, inscrito no CNPJ sob nº {{condominio.cnpj}}, localizado em {{condominio.enderecoEdital}}. Presentes os condôminos e/ou seus representantes legais, proprietários das unidades autônomas número: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.\\n\\nA reunião atendeu ao edital de convocação regularmente expedido a todos os condôminos através de carta registrada enviada pelo correio para os não residentes e carta protocolada para os residentes. Foi indicado através dos presentes para assumir a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade. Empossados, e a pedido, em nome do síndico o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:\\n\\n{{ata.itensTexto}}\\n\\nNos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o(a) presidente da mesa solicitou ao(à) secretário(a) a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, encerrando-se a assembleia. Os condôminos presentes autorizam o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos por meio eletrônico.\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretário(a)\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nSíndico/presidente","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-itajai-ordinaria', '{"id":"mod-ata-itajai-ordinaria","nome":"Itajaí — Ordinária","cidade":"Itajaí","cartorio":"","tipo":"ordinaria","texto":"# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO\\n\\n## {{condominio.nomeRelatorio}}\\n\\nAos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação com qualquer número de presentes, na modalidade {{ata.modalidade}}, realizou-se a Assembleia Geral Ordinária do {{condominio.nomeRelatorio}}, situado em {{condominio.enderecoEdital}}, inscrito no CNPJ nº {{condominio.cnpj}}, estando presentes neste evento os condôminos proprietários ou representantes legais das unidades autônomas: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.\\n\\nA assembleia atendeu ao edital de convocação regularmente expedido a todos os condôminos, por meio de carta protocolada para os residentes e carta registrada enviada pelo correio para os não residentes. Feita a abertura dos trabalhos, foi indicado para presidir a mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade dos presentes, sendo devidamente empossados. O(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:\\n\\n{{ata.itensTexto}}\\n\\nNos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o(a) presidente da mesa encerrou os trabalhos. Os condôminos presentes nesta assembleia também autorizam o(a) secretário(a) a redigir, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos através de meio eletrônico.\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretária\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nSíndico/Presidente","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW()),
  ('mod-ata-itajai-extraordinaria', '{"id":"mod-ata-itajai-extraordinaria","nome":"Itajaí — Extraordinária","cidade":"Itajaí","cartorio":"","tipo":"extraordinaria","texto":"# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO\\n\\n## {{condominio.nomeRelatorio}}\\n\\nAberto os trabalhos, realizou-se a Assembleia Geral Extraordinária do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, na modalidade {{ata.modalidade}}, inscrito no CNPJ sob nº {{condominio.cnpj}}, realizada aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação. Presentes os condôminos e/ou seus procuradores, proprietários das unidades condominiais número: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.\\n\\nSua realização ocorreu em virtude do Edital de Convocação regularmente expedido a todos os condôminos, através de carta com protocolo simples e direto aos condôminos residentes e carta registrada para os condôminos não residentes no condomínio. Em sequência foi indicado para a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade dos presentes, sendo devidamente empossados. O(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:\\n\\n{{ata.itensTexto}}\\n\\nNos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.\\n\\n{{ata.encerramento}}\\n\\nNada mais havendo para ser tratado, o(a) presidente da mesa encerrou os trabalhos. Os condôminos presentes nesta assembleia também autorizam o(a) secretário(a) a redigir, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos através de meio eletrônico.\\n\\n{{ata.observacoes}}\\n\\n{{cidade}}, {{ata.data}}.\\n\\n_______________________________________________\\n{{ata.mesa.secretario}}\\nSecretária\\n\\n_______________________________________________\\n{{ata.mesa.presidente}}\\nSíndico/Presidente","logoEscritorio":false,"bordaPagina":true,"ativo":true,"criadoEm":"2026-11-11T12:00:00.000Z","atualizadoEm":"2026-11-11T12:00:00.000Z"}', NOW());

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
