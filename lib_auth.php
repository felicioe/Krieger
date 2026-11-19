<?php
// Funções compartilhadas de conexão e autenticação (usado por api.php e auth.php).
// Não é acessível pelo navegador (bloqueado no .htaccess).
declare(strict_types=1);
require_once __DIR__ . '/lib_permissoes.php';
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

date_default_timezone_set('America/Sao_Paulo');

const SESSAO_NOME = 'KRSESS';
const SESSAO_TEMPO = 28800; // 8 h sem atividade encerram a sessão

function aplicar_cabecalhos_seguranca(): void {
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
  header('Pragma: no-cache');
  header('X-Content-Type-Options: nosniff');
  header('X-Frame-Options: SAMEORIGIN');
  header('Referrer-Policy: strict-origin-when-cross-origin');
}

function json_ok($dados): never {
  echo json_encode($dados, JSON_UNESCAPED_UNICODE);
  exit;
}

function json_erro(string $msg, int $codigo = 400, array $extra = []): never {
  http_response_code($codigo);
  echo json_encode(['erro' => $msg] + $extra, JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Onde fica a configuração real (credenciais do MySQL), em ordem de preferência:
 * 1. config.local.php nesta mesma pasta — não versionado, para rodar localmente.
 * 2. krieger-config.php dois níveis acima desta pasta — fora da pasta publicada do
 *    site. O auto-deploy do Hostinger apaga tudo que não está no Git dentro da pasta
 *    publicada a cada push; um arquivo fora dela sobrevive a qualquer deploy, então só
 *    precisa ser criado uma vez. Ver docs/PUBLICACAO.md.
 */
function caminho_config(): string {
  $candidatos = [
    __DIR__ . '/config.local.php',
    dirname(__DIR__, 2) . '/krieger-config.php',
  ];
  foreach ($candidatos as $caminho) {
    if (is_file($caminho)) return $caminho;
  }
  throw new RuntimeException('Nenhum arquivo de configuração encontrado (veja docs/PUBLICACAO.md).');
}

function conectar(): PDO {
  $cfg = require caminho_config();
  $dsn = $cfg['dsn'] ?? "mysql:host={$cfg['host']};dbname={$cfg['dbname']};charset=utf8mb4";
  return new PDO($dsn, $cfg['user'] ?? null, $cfg['pass'] ?? null,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
}

function iniciar_sessao(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  session_name(SESSAO_NOME);
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
  ini_set('session.use_strict_mode', '1');
  ini_set('session.gc_maxlifetime', (string) SESSAO_TEMPO);
  session_start();
  if (isset($_SESSION['ultimo']) && time() - (int) $_SESSION['ultimo'] > SESSAO_TEMPO) $_SESSION = [];
  $_SESSION['ultimo'] = time();
}

// Bloqueia envio de formulários vindos de outro site (complementa o cookie SameSite).
function checar_origem(): void {
  if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS'], true)) return;
  $o = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
  if ($o === '') return;
  $host = parse_url($o, PHP_URL_HOST) . (($p = parse_url($o, PHP_URL_PORT)) ? ':' . $p : '');
  if (strcasecmp($host, $_SERVER['HTTP_HOST'] ?? '') !== 0) json_erro('Origem não permitida.', 403);
}

// Usuário da sessão, relido do banco a cada chamada: desativar/excluir/rebaixar vale na hora.
function usuario_atual(PDO $pdo): ?array {
  iniciar_sessao();
  $uid = $_SESSION['uid'] ?? null;
  if (!is_string($uid) || $uid === '') return null;
  $st = $pdo->prepare('SELECT id, login, nome, perfil, ativo, trocar_senha FROM kr_usuarios WHERE id = ?');
  $st->execute([$uid]);
  $u = $st->fetch();
  if (!$u || (int) $u['ativo'] !== 1) { $_SESSION = []; return null; }
  return ['id' => $u['id'], 'login' => $u['login'], 'nome' => $u['nome'], 'perfil' => $u['perfil'], 'trocarSenha' => (int) $u['trocar_senha'] === 1, 'permissoes' => permissoes_usuario($pdo, (string) $u['id'], (string) $u['perfil'])];
}

function exigir_login(PDO $pdo, bool $admin = false, bool $aceitaTrocaPendente = false): array {
  $u = usuario_atual($pdo);
  if (!$u) json_erro('Sessão expirada ou não autenticada. Faça login.', 401, ['codigo' => 'auth']);
  if ($u['trocarSenha'] && !$aceitaTrocaPendente) json_erro('Defina uma nova senha para continuar.', 403, ['codigo' => 'trocar_senha']);
  if ($admin && $u['perfil'] !== 'admin') json_erro('Acesso restrito a administradores.', 403);
  return $u;
}
