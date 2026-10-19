<?php
// API do Sistema Krieger (condomínios). Um único arquivo, sem framework: lista/obtém/salva/exclui
// registros em tabelas MySQL (cada "store" do sistema vira uma tabela kr_<nome>), e exporta/importa
// tudo de uma vez (usado no Backup). Exige usuário logado (ver auth.php). Front-end: ver src/db.js.
declare(strict_types=1);
require __DIR__ . '/lib_auth.php';
aplicar_cabecalhos_seguranca();

function erro(string $msg, int $codigo = 400): never { json_erro($msg, $codigo); }
function saida($dados): never { json_ok($dados); }
function id_valido($v): string {
  if (!is_string($v) || $v === '' || strlen($v) > 64) erro('Id inválido (obrigatório, até 64 caracteres).');
  return $v;
}

$STORES = ['condominios', 'exercicios', 'mensais', 'assembleias', 'modelos', 'config', 'importacoes', 'atas'];
$tabela = fn(string $s) => 'kr_' . $s;

try { $pdo = conectar(); }
catch (Throwable $e) { error_log('[krieger] ' . $e->getMessage()); erro('Não foi possível conectar ao banco de dados. Confira config.php.', 500); }

checar_origem();
$usuario = exigir_login($pdo);
session_write_close(); // a API só lê a sessão; evita travar requisições simultâneas

$corpo = json_decode(file_get_contents('php://input') ?: '', true);
$corpo = is_array($corpo) ? $corpo : [];
$param = fn(string $k) => $_GET[$k] ?? $corpo[$k] ?? '';
$a = is_string($param('a')) ? $param('a') : '';
$s = is_string($param('s')) ? $param('s') : '';

function validar_backup_dados(array $dados, PDO $pdo, bool $substituir, array $stores): array {
  if (($dados['app'] ?? '') !== 'krieger-condominios') {
    erro('Arquivo de backup inválido: identificador do aplicativo incorreto.');
  }
  $versao = (string) ($dados['versao'] ?? '');
  if (!in_array($versao, ['1', '2'], true)) {
    erro('Versão de backup não suportada (' . htmlspecialchars($versao) . ').');
  }

  $contagens = [];
  $total = 0;
  $condoIds = [];

  // 1. Valida estrutura básica de cada store
  foreach ($stores as $st) {
    $lista = $dados[$st] ?? [];
    if (!is_array($lista)) erro("A coleção '$st' no arquivo de backup deve ser uma lista.");
    $ids = [];
    foreach ($lista as $idx => $item) {
      if (!is_array($item)) erro("Item inválido na coleção '$st' (posição $idx).");
      $id = $item['id'] ?? null;
      if (!is_string($id) || trim($id) === '' || strlen($id) > 64) {
        erro("Identificador ausente ou inválido na coleção '$st' (posição $idx).");
      }
      if (isset($ids[$id])) erro("Identificador duplicado ('$id') na coleção '$st'.");
      $ids[$id] = true;
      if ($st === 'condominios') {
        if (!is_string($item['nome'] ?? null) || trim($item['nome']) === '') {
          erro("Condomínio '$id' sem nome no arquivo de backup.");
        }
        $condoIds[$id] = true;
      }
    }
    $contagens[$st] = count($lista);
    $total += count($lista);
  }

  if ($total > 30000) erro('Backup excede o limite máximo permitido de registros (30.000).');

  // 2. Valida referências de condomínio se não estiver substituindo tudo
  if (!$substituir) {
    try {
      $existentes = $pdo->query('SELECT id FROM kr_condominios')->fetchAll(PDO::FETCH_COLUMN);
      foreach ($existentes as $cid) $condoIds[$cid] = true;
    } catch (Throwable) {}
  }

  // Verifica se registros que exigem condomínio apontam para condomínio existente
  $dependentes = ['exercicios', 'assembleias'];
  foreach ($dependentes as $dep) {
    $lista = $dados[$dep] ?? [];
    foreach ($lista as $item) {
      $cid = $item['condoId'] ?? null;
      if (is_string($cid) && $cid !== '' && !isset($condoIds[$cid])) {
        $tipo = ($dep === 'exercicios') ? 'Prestação de contas' : 'Edital/assembleia';
        erro("$tipo ('{$item['id']}') vinculado a condomínio que não existe no backup nem no sistema.");
      }
    }
  }

  return [
    'app' => $dados['app'],
    'versao' => $versao,
    'exportadoEm' => is_string($dados['exportadoEm'] ?? null) ? $dados['exportadoEm'] : null,
    'contagens' => $contagens,
    'total' => $total,
  ];
}

try {
  if ($a === 'exportar') {
    $o = ['app' => 'krieger-condominios', 'versao' => 1, 'exportadoEm' => date('c')];
    foreach ($STORES as $st) {
      $linhas = $pdo->query('SELECT dados FROM ' . $tabela($st))->fetchAll();
      $o[$st] = array_map(fn($r) => json_decode($r['dados'], true), $linhas);
    }
    saida($o);
  }

  if ($a === 'validar_backup') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem validar ou restaurar backup.', 403);
    $dados = $corpo['dados'] ?? null;
    $substituir = !empty($corpo['substituir']);
    if (!is_array($dados)) erro('Nenhum dado de backup fornecido.');
    $resumo = validar_backup_dados($dados, $pdo, $substituir, $STORES);
    saida(['ok' => true, 'resumo' => $resumo]);
  }

  if ($a === 'importar') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem restaurar um backup.', 403);
    $dados = $corpo['dados'] ?? null;
    $substituir = !empty($corpo['substituir']);
    if (!is_array($dados)) erro('Arquivo de backup inválido.');
    $resumo = validar_backup_dados($dados, $pdo, $substituir, $STORES);

    $pdo->beginTransaction();
    try {
      foreach ($STORES as $st) {
        if ($substituir) $pdo->exec('DELETE FROM ' . $tabela($st));
        $stmt = $pdo->prepare('REPLACE INTO ' . $tabela($st) . ' (id, dados, atualizado_em) VALUES (?, ?, ?)');
        $lista = is_array($dados[$st] ?? null) ? $dados[$st] : [];
        foreach ($lista as $linha) {
          if (!is_array($linha) || empty($linha['id'])) continue;
          $id = id_valido($linha['id']);
          $quando = is_string($linha['atualizadoEm'] ?? null) ? str_replace('T', ' ', substr($linha['atualizadoEm'], 0, 19)) : date('Y-m-d H:i:s');
          $stmt->execute([$id, json_encode($linha, JSON_UNESCAPED_UNICODE), $quando]);
        }
      }
      $pdo->commit();
    } catch (Throwable $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      throw $e;
    }
    saida(['ok' => true, 'resumo' => $resumo]);
  }

  if (!in_array($s, $STORES, true)) erro('Store inválida.');
  $tb = $tabela($s);

  switch ($a) {
    case 'listar':
      $linhas = $pdo->query('SELECT dados FROM ' . $tb)->fetchAll();
      saida(array_map(fn($r) => json_decode($r['dados'], true), $linhas));

    case 'obter':
      $stmt = $pdo->prepare('SELECT dados FROM ' . $tb . ' WHERE id = ?');
      $stmt->execute([id_valido($param('id'))]);
      $r = $stmt->fetch();
      saida($r ? json_decode($r['dados'], true) : null);

    case 'salvar':
      $o = $corpo['o'] ?? null;
      if (!is_array($o) || empty($o['id'])) erro('Objeto inválido (sem id).');
      $id = id_valido($o['id']);
      $o['atualizadoEm'] = date('c');
      $stmt = $pdo->prepare('REPLACE INTO ' . $tb . ' (id, dados, atualizado_em) VALUES (?, ?, ?)');
      $stmt->execute([$id, json_encode($o, JSON_UNESCAPED_UNICODE), date('Y-m-d H:i:s')]);
      saida($o);

    case 'excluir':
      $pdo->prepare('DELETE FROM ' . $tb . ' WHERE id = ?')->execute([id_valido($param('id'))]);
      saida(['ok' => true]);

    default:
      erro('Ação inválida.');
  }
} catch (Throwable $e) {
  error_log('[krieger] ' . $e->getMessage());
  erro('Erro interno. Tente novamente ou contate o administrador.', 500);
}
