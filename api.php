<?php
// API do Sistema Krieger (condomínios). Um único arquivo, sem framework: lista/obtém/salva/exclui
// registros em tabelas MySQL (cada "store" do sistema vira uma tabela kr_<nome>), e exporta/importa
// tudo de uma vez (usado no Backup). Exige usuário logado (ver auth.php). Front-end: ver src/db.js.
declare(strict_types=1);
require __DIR__ . '/lib_auth.php';
require __DIR__ . '/lib_importacao.php';
require __DIR__ . '/lib_backup.php';
aplicar_cabecalhos_seguranca();

function erro(string $msg, int $codigo = 400): never { json_erro($msg, $codigo); }
function saida($dados): never { json_ok($dados); }
function id_valido($v): string {
  if (!is_string($v) || $v === '' || strlen($v) > 64) erro('Id inválido (obrigatório, até 64 caracteres).');
  return $v;
}

function codigo_condo_normal(?string $s): string {
  $d = preg_replace('/\D/', '', (string) ($s ?? ''));
  return $d !== '' ? str_pad($d, 3, '0', STR_PAD_LEFT) : '';
}

/**
 * Evita duplicar condomínio quando o cliente envia um novo id aleatório para um condomínio cujo
 * código (ou CNPJ, quando sem código) já está cadastrado em kr_condominios.
 */
function resolver_id_condominio(PDO $pdo, array $o, string $idProposto): string {
  $chk = $pdo->prepare('SELECT id FROM kr_condominios WHERE id = ?');
  $chk->execute([$idProposto]);
  if ($chk->fetchColumn()) return $idProposto;

  $cod = codigo_condo_normal(is_string($o['codigo'] ?? null) ? $o['codigo'] : '');
  $cnpj = preg_replace('/\D/', '', is_string($o['cnpj'] ?? null) ? $o['cnpj'] : '');
  if ($cod === '' && $cnpj === '') return $idProposto;

  $linhas = $pdo->query('SELECT id, dados FROM kr_condominios')->fetchAll();
  foreach ($linhas as $r) {
    $ex = json_decode((string) $r['dados'], true);
    if (!is_array($ex)) continue;
    $exCod = codigo_condo_normal(is_string($ex['codigo'] ?? null) ? $ex['codigo'] : '');
    if ($cod !== '' && $exCod === $cod) {
      return (string) $r['id'];
    }
  }
  if ($cod === '' && $cnpj !== '') {
    foreach ($linhas as $r) {
      $ex = json_decode((string) $r['dados'], true);
      if (!is_array($ex)) continue;
      $exCnpj = preg_replace('/\D/', '', is_string($ex['cnpj'] ?? null) ? $ex['cnpj'] : '');
      if ($exCnpj === $cnpj) {
        return (string) $r['id'];
      }
    }
  }
  return $idProposto;
}

$ALVOS_LIMPEZA = [
  'condominios' => ['kr_condominios'],
  'exercicios' => ['kr_exercicios'],
  'mensais' => ['kr_mensais'],
  'assembleias' => ['kr_assembleias'],
  'atas' => ['kr_atas'],
  'modelos' => ['kr_modelos'],
  'importacoes' => ['kr_importacoes'],
  'anexos_importacao' => ['kr_anexos_importacao'],
  'decisoes_previsao' => ['kr_decisoes_previsao'],
  'documentos' => ['kr_documento_trechos', 'kr_drive_arquivos', 'kr_documentos', 'kr_consulta_cache', 'kr_consulta_historico'],
  'backups' => ['kr_backups'],
];

function contar_tabela_seguro(PDO $pdo, string $tb): int {
  try {
    return (int) $pdo->query('SELECT COUNT(*) FROM ' . $tb)->fetchColumn();
  } catch (Throwable) {
    return 0;
  }
}

$STORES = ['condominios', 'exercicios', 'mensais', 'assembleias', 'modelos', 'config', 'importacoes', 'atas', 'anexos_importacao', 'decisoes_previsao'];
$tabela = fn(string $s) => 'kr_' . $s;

try { $pdo = conectar(); }
catch (Throwable $e) { error_log('[krieger] ' . $e->getMessage()); erro('Não foi possível conectar ao banco de dados. Confira a configuração (docs/PUBLICACAO.md).', 500); }

checar_origem();
$usuario = exigir_login($pdo);
session_write_close(); // a API só lê a sessão; evita travar requisições simultâneas

$corpo = json_decode(file_get_contents('php://input') ?: '', true);
$corpo = is_array($corpo) ? $corpo : [];
$param = fn(string $k) => $_GET[$k] ?? $corpo[$k] ?? '';
$a = is_string($param('a')) ? $param('a') : '';
$s = is_string($param('s')) ? $param('s') : '';

$permissaoStore = [
  'condominios' => 'condominios',
  'exercicios' => 'prestacao_contas',
  'mensais' => 'relatorio_mensal',
  'assembleias' => 'editais',
  'atas' => 'atas',
  'modelos' => 'modelos',
  'importacoes' => 'importador',
  'anexos_importacao' => 'prestacao_contas',
  'decisoes_previsao' => 'previsao_orcamentaria',
  'config' => 'escritorio',
];
if (in_array($a, ['listar', 'obter', 'salvar', 'excluir'], true) && isset($permissaoStore[$s])) {
  $acaoPermissao = $a === 'excluir' ? 'editar' : ($a === 'salvar' ? 'editar' : 'visualizar');
  exigir_permissao($usuario, $permissaoStore[$s] . '.' . $acaoPermissao);
}

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

function montar_backup(PDO $pdo, array $stores, callable $tabela): array {
  $o = ['app' => 'krieger-condominios', 'versao' => 1, 'exportadoEm' => date('c')];
  foreach ($stores as $st) {
    $o[$st] = ler_colecao_backup($pdo, $st);
  }
  return $o;
}

// Grava os dados de um backup (já validado) nas tabelas, dentro de uma transação. Usado tanto
// por 'importar' (arquivo enviado pelo navegador) quanto por 'backup_restaurar' (backup salvo no
// servidor) — mesma lógica, duas origens diferentes do $dados.
function restaurar_dados(PDO $pdo, array $dados, bool $substituir, array $stores, callable $tabela): void {
  $stores = stores_restauraveis($pdo, $dados, $stores);
  $pdo->beginTransaction();
  try {
    foreach ($stores as $st) {
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
}

try {
  if ($a === 'confirmar_importacao') {
    exigir_permissao($usuario, 'importador.editar');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para confirmar a importação.', 405);
    try { $resultado = confirmar_importacao($pdo, $corpo); }
    catch (InvalidArgumentException $e) { erro($e->getMessage()); }
    catch (RuntimeException $e) {
      if (in_array($e->getCode(), [404, 409], true)) erro($e->getMessage(), $e->getCode());
      throw $e;
    }
    saida($resultado);
  }
  if ($a === 'exportar') {
    saida(montar_backup($pdo, $STORES, $tabela));
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
    restaurar_dados($pdo, $dados, $substituir, $STORES, $tabela);
    saida(['ok' => true, 'resumo' => $resumo]);
  }

  // Backup salvo no servidor (histórico), vinculado a quem gerou. Complementa o download direto
  // (a=exportar, que o navegador grava num arquivo local/mídia externa) sem substituí-lo.
  if ($a === 'backup_criar') {
    $o = montar_backup($pdo, $STORES, $tabela);
    $id = 'bkp-' . bin2hex(random_bytes(8));
    $stmt = $pdo->prepare('INSERT INTO kr_backups (id, dados, gerado_por, gerado_por_nome, criado_em) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$id, json_encode($o, JSON_UNESCAPED_UNICODE), $usuario['id'], $usuario['nome'], date('Y-m-d H:i:s')]);
    $contagens = [];
    foreach ($STORES as $st) $contagens[$st] = count($o[$st]);
    saida(['id' => $id, 'geradoPor' => $usuario['id'], 'geradoPorNome' => $usuario['nome'], 'criadoEm' => date('c'), 'contagens' => $contagens]);
  }

  if ($a === 'backup_listar') {
    $linhas = $pdo->query('SELECT id, gerado_por_nome, criado_em, LENGTH(dados) AS tamanho FROM kr_backups ORDER BY criado_em DESC')->fetchAll();
    saida(array_map(fn($r) => [
      'id' => $r['id'],
      'geradoPorNome' => $r['gerado_por_nome'],
      'criadoEm' => str_replace(' ', 'T', $r['criado_em']),
      'tamanhoBytes' => (int) $r['tamanho'],
    ], $linhas));
  }

  if ($a === 'backup_baixar') {
    $stmt = $pdo->prepare('SELECT dados FROM kr_backups WHERE id = ?');
    $stmt->execute([id_valido($param('id'))]);
    $r = $stmt->fetch();
    if (!$r) erro('Backup não encontrado.', 404);
    saida(json_decode($r['dados'], true));
  }

  if ($a === 'backup_restaurar') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem restaurar um backup.', 403);
    $stmt = $pdo->prepare('SELECT dados FROM kr_backups WHERE id = ?');
    $stmt->execute([id_valido($param('id'))]);
    $r = $stmt->fetch();
    if (!$r) erro('Backup não encontrado.', 404);
    $dados = json_decode($r['dados'], true);
    $substituir = !empty($corpo['substituir']);
    $resumo = validar_backup_dados($dados, $pdo, $substituir, $STORES);
    restaurar_dados($pdo, $dados, $substituir, $STORES, $tabela);
    saida(['ok' => true, 'resumo' => $resumo]);
  }

  if ($a === 'backup_excluir') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem excluir backups.', 403);
    $pdo->prepare('DELETE FROM kr_backups WHERE id = ?')->execute([id_valido($param('id'))]);
    saida(['ok' => true]);
  }

  if ($a === 'limpar_contagens') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem consultar ou limpar cadastros em massa.', 403);
    $contagens = [];
    foreach ($ALVOS_LIMPEZA as $chave => $tabelas) {
      if ($chave === 'documentos') {
        $contagens[$chave] =
          contar_tabela_seguro($pdo, 'kr_documentos') +
          contar_tabela_seguro($pdo, 'kr_consulta_cache') +
          contar_tabela_seguro($pdo, 'kr_consulta_historico');
      } else {
        $contagens[$chave] = contar_tabela_seguro($pdo, $tabelas[0]);
      }
    }
    saida($contagens);
  }

  if ($a === 'limpar_dados') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem apagar cadastros em massa.', 403);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para apagar cadastros.', 405);
    $alvo = is_string($param('alvo')) ? $param('alvo') : '';
    $chavesAlvo = [];
    if ($alvo === 'tudo') {
      $chavesAlvo = ['condominios', 'exercicios', 'mensais', 'assembleias', 'atas', 'modelos', 'importacoes', 'anexos_importacao', 'decisoes_previsao', 'documentos'];
    } elseif (isset($ALVOS_LIMPEZA[$alvo])) {
      $chavesAlvo = [$alvo];
    } else {
      erro('Categoria de limpeza inválida.');
    }
    $apagados = 0;
    $pdo->beginTransaction();
    try {
      foreach ($chavesAlvo as $ch) {
        foreach ($ALVOS_LIMPEZA[$ch] as $tbLimpar) {
          try {
            $apagados += (int) $pdo->exec('DELETE FROM ' . $tbLimpar);
          } catch (Throwable) {
            // Tabela opcional ainda não criada no servidor — ignora com segurança.
          }
        }
      }
      $pdo->commit();
    } catch (Throwable $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      throw $e;
    }
    saida(['ok' => true, 'apagados' => $apagados]);
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
      if ($s === 'importacoes') {
        try { $salvo = salvar_staging_importacao($pdo, $o); }
        catch (InvalidArgumentException $e) { erro($e->getMessage()); }
        catch (RuntimeException $e) {
          if ($e->getCode() === 409) erro($e->getMessage(), 409);
          throw $e;
        }
        saida($salvo);
      }
      if ($s === 'condominios') {
        $id = resolver_id_condominio($pdo, $o, $id);
        $o['id'] = $id;
      }
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
  if ($e instanceof RuntimeException && $e->getCode() === 409) erro($e->getMessage(), 409);
  error_log('[krieger] ' . $e->getMessage());
  // Tabela ausente (schema.sql tem uma tabela que o banco deste servidor ainda não tem,
  // ex.: uma tabela nova de uma funcionalidade adicionada depois da instalação inicial).
  // Isso já aconteceu de forma silenciosa (Erro interno genérico, exigiu log manual pra
  // achar a causa) - avisar direto evita repetir a investigação.
  if ($e instanceof PDOException && $e->getCode() === '42S02') {
    erro('Tabela do banco ausente: ' . $e->getMessage() . '. Aplique schema.sql (docs/PUBLICACAO.md).', 500);
  }
  erro('Erro interno. Tente novamente ou contate o administrador.', 500);
}
