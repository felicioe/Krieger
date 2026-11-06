<?php
// Modelo de configuração (credenciais do MySQL, hPanel > Bancos de dados).
// - Rodando localmente: copie para config.local.php nesta mesma pasta (fora do Git).
// - Em produção: copie para krieger-config.php, dois níveis ACIMA da pasta publicada
//   do site (ex.: /home/SEU_USUARIO/domains/SEU_DOMINIO/krieger-config.php) — fora da
//   pasta que o auto-deploy do Hostinger apaga a cada publicação. Ver docs/PUBLICACAO.md.
return [
  'host' => 'localhost',
  'dbname' => 'SEU_BANCO',
  'user' => 'SEU_USUARIO_BD',
  'pass' => 'SUA_SENHA_BD',
  // Opcional — só é lida pela Consulta Inteligente de Documentos (lib_claude.php). Sem ela,
  // a busca local (FULLTEXT) continua funcionando normalmente, só não interpreta por IA.
  'claude_api_key' => 'SUA_CHAVE_CLAUDE',
];
