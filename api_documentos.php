<?php
// API do Drive de Documentos e da Consulta Inteligente de Documentos.
declare(strict_types=1);
require __DIR__ . '/lib_auth.php';
require __DIR__ . '/lib_documentos.php';
require __DIR__ . '/lib_claude.php';
aplicar_cabecalhos_seguranca();

function erro(string $msg, int $codigo = 400): never { json_erro($msg, $codigo); }
function saida($dados): never { json_ok($dados); }
function condo_id_valido($v, bool $permitirGlobal = false): string {
  if ($permitirGlobal && $v === '*') return '*';
  if (!is_string($v) || $v === '' || strlen($v) > 64) erro('Condomínio inválido (obrigatório).');
  return $v;
}

try { $pdo = conectar(); }
catch (Throwable $e) { error_log('[krieger] ' . $e->getMessage()); erro('Não foi possível conectar ao banco de dados. Confira a configuração (docs/PUBLICACAO.md).', 500); }

checar_origem();
$usuario = exigir_login($pdo);
session_write_close();

$corpo = json_decode(file_get_contents('php://input') ?: '', true);
$corpo = is_array($corpo) ? $corpo : [];
$param = fn(string $k) => $_GET[$k] ?? $corpo[$k] ?? '';
$a = is_string($param('a')) ? $param('a') : '';

if (in_array($a, ['documentos_registrar', 'documento_atualizar', 'documento_excluir'], true)) {
  exigir_permissao($usuario, 'drive_documentos.editar');
} elseif (str_starts_with($a, 'consulta_')) {
  exigir_permissao($usuario, 'consulta_documentos.visualizar');
} elseif (in_array($a, ['documentos_listar', 'documentos_resumo', 'documento_conteudo'], true)) {
  if (!tem_permissao($usuario, 'drive_documentos.visualizar') && !tem_permissao($usuario, 'consulta_documentos.visualizar')) {
    json_erro('Você não tem permissão para consultar documentos.', 403);
  }
}

try {
  // Manifesto para o agente local de indexação
  if ($a === 'documentos_manifesto') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem consultar o manifesto de documentos.', 403);
    $condoId = condo_id_valido($param('condoId'));
    saida(manifesto_condominio($pdo, $condoId));
  }

  // Registro/upload de documento (pelo Drive no navegador ou pelo agente local)
  if ($a === 'documentos_registrar') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para registrar um documento.', 405);
    $doc = $corpo['documento'] ?? null;
    if (!is_array($doc)) erro('Documento inválido.');
    try { $registrado = registrar_documento($pdo, $doc); }
    catch (InvalidArgumentException $e) { erro($e->getMessage()); }
    saida($registrado);
  }

  // Listagem de documentos do Drive (por condomínio ou global '*')
  if ($a === 'documentos_listar') {
    $condoId = condo_id_valido($param('condoId') ?: '*', true);
    saida(listar_documentos_drive($pdo, $condoId));
  }

  // Resumo de quantos documentos cada condomínio possui no Drive
  if ($a === 'documentos_resumo') {
    saida(resumo_documentos_por_condominio($pdo));
  }

  // Conteúdo binário (PDF inline e/ou arquivo original) de um documento do Drive
  if ($a === 'documento_conteudo') {
    $id = is_string($param('id')) ? trim($param('id')) : '';
    if ($id === '') erro('Identificador do documento obrigatório.');
    $conteudo = obter_conteudo_documento($pdo, $id);
    if (!$conteudo) erro('Documento não encontrado.', 404);
    saida($conteudo);
  }

  // Renomear ou alterar categoria/data de um documento do Drive
  if ($a === 'documento_atualizar') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para atualizar o documento.', 405);
    $id = is_string($corpo['id'] ?? null) ? trim($corpo['id']) : '';
    if ($id === '') erro('Identificador do documento obrigatório.');
    try { saida(atualizar_documento_drive($pdo, $id, $corpo)); }
    catch (InvalidArgumentException $e) { erro($e->getMessage(), 404); }
  }

  // Excluir documento do Drive
  if ($a === 'documento_excluir') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para excluir o documento.', 405);
    $id = is_string($corpo['id'] ?? null) ? trim($corpo['id']) : '';
    if ($id === '') erro('Identificador do documento obrigatório.');
    excluir_documento_drive($pdo, $id);
    saida(['ok' => true]);
  }

  // Consulta Inteligente (em 1 condomínio, em um documento específico ou em todos '*')
  if ($a === 'consulta_perguntar') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para fazer uma pergunta.', 405);
    $condoId = condo_id_valido($corpo['condoId'] ?? null, true);
    $pergunta = is_string($corpo['pergunta'] ?? null) ? $corpo['pergunta'] : '';
    $documentoId = is_string($corpo['documentoId'] ?? null) && trim($corpo['documentoId']) !== ''
      ? trim($corpo['documentoId'])
      : null;
    try { $resultado = consulta_perguntar($pdo, $condoId, $pergunta, $usuario['id'], $documentoId); }
    catch (InvalidArgumentException $e) { erro($e->getMessage()); }
    catch (RuntimeException $e) {
      error_log('[krieger] consulta_perguntar: ' . $e->getMessage());
      erro('Não foi possível obter uma resposta no momento. Tente novamente em instantes.', 502);
    }
    saida($resultado);
  }

  if ($a === 'consulta_historico') {
    $condoId = condo_id_valido($param('condoId') ?: '*', true);
    if ($condoId === '*') {
      $stmt = $pdo->query(
        'SELECT id, usuario_id, condo_id, pergunta, origem, tokens_entrada, tokens_saida, custo_estimado_centavos, status, criado_em ' .
        'FROM kr_consulta_historico ORDER BY criado_em DESC LIMIT 200'
      );
      $linhas = $stmt ? $stmt->fetchAll() : [];
    } else {
      $stmt = $pdo->prepare(
        'SELECT id, usuario_id, condo_id, pergunta, origem, tokens_entrada, tokens_saida, custo_estimado_centavos, status, criado_em ' .
        'FROM kr_consulta_historico WHERE condo_id = ? ORDER BY criado_em DESC LIMIT 200'
      );
      $stmt->execute([$condoId]);
      $linhas = $stmt->fetchAll();
    }
    $nomes = mapa_nomes_condominios($pdo);
    saida(array_map(fn($r) => [
      'id' => $r['id'],
      'usuarioId' => $r['usuario_id'],
      'condoId' => $r['condo_id'],
      'condoNome' => $r['condo_id'] === '*' ? 'Todos os condomínios' : ($nomes[$r['condo_id']] ?? $r['condo_id']),
      'pergunta' => $r['pergunta'],
      'origem' => $r['origem'],
      'tokensEntrada' => (int) $r['tokens_entrada'],
      'tokensSaida' => (int) $r['tokens_saida'],
      'custoEstimadoCentavos' => (int) $r['custo_estimado_centavos'],
      'status' => $r['status'],
      'criadoEm' => str_replace(' ', 'T', $r['criado_em']),
    ], $linhas));
  }

  erro('Ação inválida.');
} catch (Throwable $e) {
  error_log('[krieger] ' . $e->getMessage());
  if ($e instanceof PDOException && $e->getCode() === '42S02') {
    erro('Tabela do banco ausente: ' . $e->getMessage() . '. Aplique schema.sql (docs/PUBLICACAO.md).', 500);
  }
  erro('Erro interno. Tente novamente ou contate o administrador.', 500);
}
