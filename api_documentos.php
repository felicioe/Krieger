<?php
// API da Consulta Inteligente de Documentos (convenção/regimento/atas). Endpoint separado de
// api.php porque as tabelas aqui são relacionais de verdade (hash, FULLTEXT), não o padrão
// id+dados JSON das demais — ver schema.sql e docs/ESTADO-ATUAL.md.
declare(strict_types=1);
require __DIR__ . '/lib_auth.php';
require __DIR__ . '/lib_documentos.php';
require __DIR__ . '/lib_claude.php';
aplicar_cabecalhos_seguranca();

function erro(string $msg, int $codigo = 400): never { json_erro($msg, $codigo); }
function saida($dados): never { json_ok($dados); }
function condo_id_valido($v): string {
  if (!is_string($v) || $v === '' || strlen($v) > 64) erro('Condomínio inválido (obrigatório).');
  return $v;
}

try { $pdo = conectar(); }
catch (Throwable $e) { error_log('[krieger] ' . $e->getMessage()); erro('Não foi possível conectar ao banco de dados. Confira a configuração (docs/PUBLICACAO.md).', 500); }

checar_origem();
$usuario = exigir_login($pdo);
session_write_close(); // só lê a sessão; evita travar requisições simultâneas (mesmo motivo de api.php)

$corpo = json_decode(file_get_contents('php://input') ?: '', true);
$corpo = is_array($corpo) ? $corpo : [];
$param = fn(string $k) => $_GET[$k] ?? $corpo[$k] ?? '';
$a = is_string($param('a')) ? $param('a') : '';

try {
  // Lado do agente local de indexação (NAS → API): exige perfil admin, mesmo usuário de
  // serviço descrito no plano — sem token/credencial nova nesta v1.
  if ($a === 'documentos_manifesto') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem consultar o manifesto de documentos.', 403);
    $condoId = condo_id_valido($param('condoId'));
    saida(manifesto_condominio($pdo, $condoId));
  }

  if ($a === 'documentos_registrar') {
    if ($usuario['perfil'] !== 'admin') erro('Apenas administradores podem registrar documentos indexados.', 403);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para registrar um documento.', 405);
    $doc = $corpo['documento'] ?? null;
    if (!is_array($doc)) erro('Documento inválido.');
    try { $registrado = registrar_documento($pdo, $doc); }
    catch (InvalidArgumentException $e) { erro($e->getMessage()); }
    saida($registrado);
  }

  // Lado do app (qualquer usuário logado) — sem ACL por usuário/condomínio nesta v1.
  if ($a === 'consulta_perguntar') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erro('Use POST para fazer uma pergunta.', 405);
    $condoId = condo_id_valido($corpo['condoId'] ?? null);
    $pergunta = is_string($corpo['pergunta'] ?? null) ? $corpo['pergunta'] : '';
    try { $resultado = consulta_perguntar($pdo, $condoId, $pergunta, $usuario['id']); }
    catch (InvalidArgumentException $e) { erro($e->getMessage()); }
    catch (RuntimeException $e) {
      error_log('[krieger] consulta_perguntar: ' . $e->getMessage());
      erro('Não foi possível obter uma resposta no momento. Tente novamente em instantes.', 502);
    }
    saida($resultado);
  }

  if ($a === 'consulta_historico') {
    $condoId = condo_id_valido($param('condoId'));
    $stmt = $pdo->prepare(
      'SELECT id, usuario_id, pergunta, origem, tokens_entrada, tokens_saida, custo_estimado_centavos, status, criado_em ' .
      'FROM kr_consulta_historico WHERE condo_id = ? ORDER BY criado_em DESC LIMIT 200'
    );
    $stmt->execute([$condoId]);
    saida(array_map(fn($r) => [
      'id' => $r['id'],
      'usuarioId' => $r['usuario_id'],
      'pergunta' => $r['pergunta'],
      'origem' => $r['origem'],
      'tokensEntrada' => (int) $r['tokens_entrada'],
      'tokensSaida' => (int) $r['tokens_saida'],
      'custoEstimadoCentavos' => (int) $r['custo_estimado_centavos'],
      'status' => $r['status'],
      'criadoEm' => str_replace(' ', 'T', $r['criado_em']),
    ], $stmt->fetchAll()));
  }

  erro('Ação inválida.');
} catch (Throwable $e) {
  error_log('[krieger] ' . $e->getMessage());
  if ($e instanceof PDOException && $e->getCode() === '42S02') {
    erro('Tabela do banco ausente: ' . $e->getMessage() . '. Aplique schema.sql (docs/PUBLICACAO.md).', 500);
  }
  erro('Erro interno. Tente novamente ou contate o administrador.', 500);
}
