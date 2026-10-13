<?php
// API do Sistema Krieger (condomínios). Um único arquivo, sem framework: lista/obtém/salva/exclui
// registros em tabelas MySQL (cada "store" do sistema vira uma tabela kr_<nome>), e exporta/importa
// tudo de uma vez (usado no Backup). Front-end: ver src/db.js.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

function erro(string $msg, int $codigo = 400): never {
  http_response_code($codigo);
  echo json_encode(['erro' => $msg]);
  exit;
}
function saida($dados): never {
  echo json_encode($dados, JSON_UNESCAPED_UNICODE);
  exit;
}

$STORES = ['condominios', 'exercicios', 'mensais', 'assembleias', 'modelos', 'config'];
$tabela = fn(string $s) => 'kr_' . $s;

try {
  $cfg = require __DIR__ . '/config.php';
  $pdo = new PDO(
    "mysql:host={$cfg['host']};dbname={$cfg['dbname']};charset=utf8mb4",
    $cfg['user'], $cfg['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
  );
} catch (Throwable $e) {
  erro('Não foi possível conectar ao banco de dados. Confira config.php.', 500);
}

$corpo = json_decode(file_get_contents('php://input') ?: '', true) ?: [];
$a = $_GET['a'] ?? $corpo['a'] ?? '';
$s = $_GET['s'] ?? $corpo['s'] ?? '';

try {
  if ($a === 'exportar') {
    $o = ['app' => 'krieger-condominios', 'versao' => 1, 'exportadoEm' => date('c')];
    foreach ($STORES as $st) {
      $linhas = $pdo->query('SELECT dados FROM ' . $tabela($st))->fetchAll();
      $o[$st] = array_map(fn($r) => json_decode($r['dados'], true), $linhas);
    }
    saida($o);
  }

  if ($a === 'importar') {
    $dados = $corpo['dados'] ?? null;
    $substituir = !empty($corpo['substituir']);
    if (!$dados || ($dados['app'] ?? '') !== 'krieger-condominios') erro('Arquivo de backup inválido.');
    $pdo->beginTransaction();
    foreach ($STORES as $st) {
      if ($substituir) $pdo->exec('DELETE FROM ' . $tabela($st));
      $stmt = $pdo->prepare('REPLACE INTO ' . $tabela($st) . ' (id, dados, atualizado_em) VALUES (?, ?, ?)');
      foreach (($dados[$st] ?? []) as $linha) {
        if (empty($linha['id'])) continue;
        $stmt->execute([$linha['id'], json_encode($linha, JSON_UNESCAPED_UNICODE), substr($linha['atualizadoEm'] ?? date('c'), 0, 19)]);
      }
    }
    $pdo->commit();
    saida(['ok' => true]);
  }

  if (!in_array($s, $STORES, true)) erro('Store inválida: ' . $s);
  $tb = $tabela($s);

  switch ($a) {
    case 'listar':
      $linhas = $pdo->query('SELECT dados FROM ' . $tb)->fetchAll();
      saida(array_map(fn($r) => json_decode($r['dados'], true), $linhas));

    case 'obter':
      $id = $_GET['id'] ?? $corpo['id'] ?? '';
      $stmt = $pdo->prepare('SELECT dados FROM ' . $tb . ' WHERE id = ?');
      $stmt->execute([$id]);
      $r = $stmt->fetch();
      saida($r ? json_decode($r['dados'], true) : null);

    case 'salvar':
      $o = $corpo['o'] ?? null;
      if (!$o || empty($o['id'])) erro('Objeto inválido (sem id).');
      $o['atualizadoEm'] = date('c');
      $stmt = $pdo->prepare('REPLACE INTO ' . $tb . ' (id, dados, atualizado_em) VALUES (?, ?, ?)');
      $stmt->execute([$o['id'], json_encode($o, JSON_UNESCAPED_UNICODE), date('Y-m-d H:i:s')]);
      saida($o);

    case 'excluir':
      $id = $_GET['id'] ?? $corpo['id'] ?? '';
      if ($id === '') erro('Id ausente.');
      $pdo->prepare('DELETE FROM ' . $tb . ' WHERE id = ?')->execute([$id]);
      saida(['ok' => true]);

    default:
      erro('Ação inválida: ' . $a);
  }
} catch (Throwable $e) {
  erro('Erro interno: ' . $e->getMessage(), 500);
}
