<?php
// Autenticação e manutenção de usuários do Sistema Krieger.
// GET  ?a=eu                      -> usuário logado
// POST a=entrar|sair|minha_senha  -> login, logout, troca da própria senha
// Admin: GET ?a=usuarios | POST a=usuario_salvar|usuario_excluir
declare(strict_types=1);
require __DIR__ . '/lib_auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

try { $pdo = conectar(); }
catch (Throwable $e) { error_log('[krieger] ' . $e->getMessage()); json_erro('Não foi possível conectar ao banco de dados. Confira config.php.', 500); }
checar_origem();

$c = json_decode(file_get_contents('php://input') ?: '', true);
$c = is_array($c) ? $c : [];
$a = (string) ($_GET['a'] ?? $c['a'] ?? '');
$txt = fn($k, $max = 255) => is_string($c[$k] ?? null) ? mb_substr(trim($c[$k]), 0, $max) : '';
$agora = fn() => date('Y-m-d H:i:s');
const MIN_SENHA = 8;

function validar_senha(string $s, string $login = ''): void {
  if (mb_strlen($s) < MIN_SENHA) json_erro('A senha deve ter pelo menos ' . MIN_SENHA . ' caracteres.');
  if (mb_strlen($s) > 200) json_erro('Senha muito longa.');
  if ($login !== '' && strcasecmp($s, $login) === 0) json_erro('A senha não pode ser igual ao login.');
}

function admins_ativos_exceto(PDO $pdo, string $id): int {
  $st = $pdo->prepare("SELECT COUNT(*) FROM kr_usuarios WHERE perfil = 'admin' AND ativo = 1 AND id <> ?");
  $st->execute([$id]);
  return (int) $st->fetchColumn();
}

try {
  switch ($a) {
    case 'eu': {
      $u = exigir_login($pdo, false, true);
      json_ok(['usuario' => $u]);
    }

    case 'entrar': {
      iniciar_sessao();
      $login = strtolower($txt('login', 40));
      $senha = is_string($c['senha'] ?? null) ? $c['senha'] : '';
      $ip = $_SERVER['REMOTE_ADDR'] ?? '?';
      $chaves = ['u:' . $login . '|' . $ip, 'ip:' . $ip];
      $limites = [5, 30]; // falhas em 15 min por login+IP e por IP
      $desde = date('Y-m-d H:i:s', time() - 900);
      $pdo->prepare('DELETE FROM kr_login_tentativas WHERE criado_em < ?')->execute([$desde]);
      foreach ($chaves as $i => $k) {
        $st = $pdo->prepare('SELECT COUNT(*) FROM kr_login_tentativas WHERE chave = ? AND criado_em >= ?');
        $st->execute([$k, $desde]);
        if ((int) $st->fetchColumn() >= $limites[$i]) json_erro('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429);
      }
      $st = $pdo->prepare('SELECT * FROM kr_usuarios WHERE login = ?');
      $st->execute([$login]);
      $u = $st->fetch();
      $hash = $u['senha_hash'] ?? '$2y$10$usesomesillystringforsaltuEoE7vT2gR1kUq5J9Gk1eYb9Jw3B6';
      $ok = password_verify($senha, $hash) && $u && (int) $u['ativo'] === 1;
      if (!$ok) {
        foreach ($chaves as $k) $pdo->prepare('INSERT INTO kr_login_tentativas (chave, criado_em) VALUES (?, ?)')->execute([$k, $agora()]);
        json_erro('Usuário ou senha inválidos.', 401);
      }
      $pdo->prepare('DELETE FROM kr_login_tentativas WHERE chave = ?')->execute([$chaves[0]]);
      session_regenerate_id(true);
      $_SESSION['uid'] = $u['id'];
      $_SESSION['ultimo'] = time();
      $pdo->prepare('UPDATE kr_usuarios SET ultimo_acesso = ? WHERE id = ?')->execute([$agora(), $u['id']]);
      json_ok(['usuario' => ['id' => $u['id'], 'login' => $u['login'], 'nome' => $u['nome'], 'perfil' => $u['perfil'], 'trocarSenha' => (int) $u['trocar_senha'] === 1]]);
    }

    case 'sair': {
      iniciar_sessao();
      $_SESSION = [];
      session_destroy();
      json_ok(['ok' => true]);
    }

    case 'minha_senha': {
      $u = exigir_login($pdo, false, true);
      $atual = is_string($c['atual'] ?? null) ? $c['atual'] : '';
      $nova = is_string($c['nova'] ?? null) ? $c['nova'] : '';
      $st = $pdo->prepare('SELECT senha_hash FROM kr_usuarios WHERE id = ?');
      $st->execute([$u['id']]);
      if (!password_verify($atual, (string) $st->fetchColumn())) json_erro('Senha atual incorreta.', 403);
      if ($nova === $atual) json_erro('A nova senha deve ser diferente da atual.');
      validar_senha($nova, $u['login']);
      $pdo->prepare('UPDATE kr_usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?')
          ->execute([password_hash($nova, PASSWORD_DEFAULT), $u['id']]);
      session_regenerate_id(true);
      json_ok(['ok' => true]);
    }

    case 'usuarios': {
      exigir_login($pdo, true);
      $linhas = $pdo->query('SELECT id, login, nome, perfil, ativo, trocar_senha, criado_em, ultimo_acesso FROM kr_usuarios ORDER BY nome')->fetchAll();
      json_ok(array_map(fn($r) => [
        'id' => $r['id'], 'login' => $r['login'], 'nome' => $r['nome'], 'perfil' => $r['perfil'],
        'ativo' => (int) $r['ativo'] === 1, 'trocarSenha' => (int) $r['trocar_senha'] === 1,
        'criadoEm' => $r['criado_em'], 'ultimoAcesso' => $r['ultimo_acesso'],
      ], $linhas));
    }

    case 'usuario_salvar': {
      $eu = exigir_login($pdo, true);
      $id = $txt('id', 32);
      $login = strtolower($txt('login', 40));
      $nome = $txt('nome', 120);
      $perfil = $txt('perfil', 10);
      $ativo = !empty($c['ativo']);
      $senha = is_string($c['senha'] ?? null) ? $c['senha'] : '';
      if ($nome === '') json_erro('Informe o nome.');
      if (!in_array($perfil, ['admin', 'user'], true)) json_erro('Perfil inválido.');

      if ($id === '') { // criação
        if (!preg_match('/^[a-z0-9._-]{3,40}$/', $login)) json_erro('Login: 3 a 40 caracteres (letras, números, ponto, hífen ou sublinhado).');
        validar_senha($senha, $login);
        $novo = bin2hex(random_bytes(8));
        try {
          $pdo->prepare('INSERT INTO kr_usuarios (id, login, nome, senha_hash, perfil, ativo, trocar_senha, criado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
              ->execute([$novo, $login, $nome, password_hash($senha, PASSWORD_DEFAULT), $perfil, $ativo ? 1 : 0, $agora()]);
        } catch (PDOException $e) {
          if (($e->errorInfo[0] ?? '') === '23000' || str_contains($e->getMessage(), 'UNIQUE') || str_contains($e->getMessage(), 'Duplicate')) json_erro('Já existe um usuário com esse login.', 409);
          throw $e;
        }
        json_ok(['ok' => true, 'id' => $novo]);
      }

      $st = $pdo->prepare('SELECT * FROM kr_usuarios WHERE id = ?');
      $st->execute([$id]);
      $alvo = $st->fetch();
      if (!$alvo) json_erro('Usuário não encontrado.', 404);
      if ($alvo['id'] === $eu['id'] && (!$ativo || $perfil !== 'admin')) json_erro('Você não pode desativar nem remover o próprio perfil de administrador.', 409);
      if ($alvo['perfil'] === 'admin' && (int) $alvo['ativo'] === 1 && ($perfil !== 'admin' || !$ativo) && admins_ativos_exceto($pdo, $id) === 0)
        json_erro('É necessário manter ao menos um administrador ativo.', 409);
      if ($senha !== '') {
        validar_senha($senha, $alvo['login']);
        $pdo->prepare('UPDATE kr_usuarios SET nome = ?, perfil = ?, ativo = ?, senha_hash = ?, trocar_senha = 1 WHERE id = ?')
            ->execute([$nome, $perfil, $ativo ? 1 : 0, password_hash($senha, PASSWORD_DEFAULT), $id]);
      } else {
        $pdo->prepare('UPDATE kr_usuarios SET nome = ?, perfil = ?, ativo = ? WHERE id = ?')->execute([$nome, $perfil, $ativo ? 1 : 0, $id]);
      }
      json_ok(['ok' => true, 'id' => $id]);
    }

    case 'usuario_excluir': {
      $eu = exigir_login($pdo, true);
      $id = $txt('id', 32);
      $st = $pdo->prepare('SELECT perfil, ativo FROM kr_usuarios WHERE id = ?');
      $st->execute([$id]);
      $alvo = $st->fetch();
      if (!$alvo) json_erro('Usuário não encontrado.', 404);
      if ($id === $eu['id']) json_erro('Você não pode excluir o próprio usuário.', 409);
      if ($alvo['perfil'] === 'admin' && (int) $alvo['ativo'] === 1 && admins_ativos_exceto($pdo, $id) === 0)
        json_erro('É necessário manter ao menos um administrador ativo.', 409);
      $pdo->prepare('DELETE FROM kr_usuarios WHERE id = ?')->execute([$id]);
      json_ok(['ok' => true]);
    }

    default:
      json_erro('Ação inválida.');
  }
} catch (Throwable $e) {
  error_log('[krieger] ' . $e->getMessage());
  json_erro('Erro interno. Tente novamente ou contate o administrador.', 500);
}
