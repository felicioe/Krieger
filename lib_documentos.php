<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

// Consulta Inteligente de Documentos: busca local (FULLTEXT), cache persistente e registro de
// documentos indexados pelo agente externo. Escopo deliberado: só convenção, regimento e atas de
// assembleia (ver docs/ do recurso) — nunca o acervo financeiro inteiro do NAS da empresa.

const TIPOS_DOCUMENTO = ['convencao', 'regimento', 'ata'];

/** Normaliza espaços/caixa pra perguntas equivalentes caírem na mesma chave de cache. */
function normalizar_pergunta(string $pergunta): string {
  $t = trim(preg_replace('/\s+/u', ' ', $pergunta) ?? $pergunta);
  return mb_strtolower($t, 'UTF-8');
}

function hash_pergunta(string $perguntaNormalizada): string {
  return hash('sha256', $perguntaNormalizada);
}

/**
 * Resume o estado dos documentos do condomínio (quantidade + indexação mais recente) numa chave
 * curta. Qualquer documento novo, alterado ou reindexado muda essa chave — e com ela a combinação
 * única do cache, sem precisar de nenhuma rotina de invalidação à parte.
 */
function versao_indices(PDO $pdo, string $condoId): string {
  $st = $pdo->prepare('SELECT COUNT(*) AS n, MAX(indexado_em) AS m FROM kr_documentos WHERE condo_id = ?');
  $st->execute([$condoId]);
  $r = $st->fetch();
  return hash('sha1', ($r['n'] ?? 0) . '|' . ($r['m'] ?? ''));
}

/** Resposta em cache, se existir pra esta pergunta+condomínio+versão dos índices. Marca o uso. */
function cache_buscar(PDO $pdo, string $condoId, string $perguntaHash, string $versaoIndices): ?array {
  $st = $pdo->prepare('SELECT id, resposta FROM kr_consulta_cache WHERE condo_id = ? AND pergunta_hash = ? AND versao_indices = ?');
  $st->execute([$condoId, $perguntaHash, $versaoIndices]);
  $r = $st->fetch();
  if (!$r) return null;
  $pdo->prepare('UPDATE kr_consulta_cache SET usado_em = ?, usos = usos + 1 WHERE id = ?')
    ->execute([date('Y-m-d H:i:s'), $r['id']]);
  return json_decode($r['resposta'], true);
}

function cache_salvar(PDO $pdo, string $condoId, string $perguntaHash, string $perguntaNormalizada, string $versaoIndices, array $resposta): void {
  $agora = date('Y-m-d H:i:s');
  $stmt = $pdo->prepare(
    'REPLACE INTO kr_consulta_cache (id, condo_id, pergunta_hash, pergunta_normalizada, resposta, versao_indices, criado_em, usado_em, usos) ' .
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
  );
  $id = 'cch-' . substr($perguntaHash, 0, 16) . '-' . substr($versaoIndices, 0, 8);
  $stmt->execute([$id, $condoId, $perguntaHash, $perguntaNormalizada, json_encode($resposta, JSON_UNESCAPED_UNICODE), $versaoIndices, $agora, $agora]);
}

/**
 * Trechos mais relevantes pra pergunta, dentro do condomínio (nunca de outro). Pesquisa textual
 * do MySQL (FULLTEXT) — determinística, sem IA, sem custo. Vazio não é erro: só significa que a
 * busca local não achou nada (quem chama decide se tenta o Claude ou avisa que não há evidência).
 */
function buscar_trechos(PDO $pdo, string $condoId, string $perguntaNormalizada, int $limite = 8): array {
  if (trim($perguntaNormalizada) === '') return [];
  $st = $pdo->prepare(
    'SELECT dt.documento_id, dt.pagina_inicial, dt.pagina_final, dt.texto, d.nome_arquivo, d.tipo, ' .
    'MATCH(dt.texto) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevancia ' .
    'FROM kr_documento_trechos dt JOIN kr_documentos d ON d.id = dt.documento_id ' .
    'WHERE dt.condo_id = ? AND MATCH(dt.texto) AGAINST (? IN NATURAL LANGUAGE MODE) ' .
    'ORDER BY relevancia DESC LIMIT ?'
  );
  $st->bindValue(1, $perguntaNormalizada);
  $st->bindValue(2, $condoId);
  $st->bindValue(3, $perguntaNormalizada);
  $st->bindValue(4, $limite, PDO::PARAM_INT);
  $st->execute();
  return $st->fetchAll();
}

/** Documentos já indexados deste condomínio (id, caminho, hash, tamanho) — o agente compara com o que tem no NAS e só reenvia o que mudou. */
function manifesto_condominio(PDO $pdo, string $condoId): array {
  $st = $pdo->prepare('SELECT id, caminho_relativo, hash, tamanho FROM kr_documentos WHERE condo_id = ?');
  $st->execute([$condoId]);
  return $st->fetchAll();
}

/**
 * Upsert de um documento indexado + substituição dos trechos dele, numa transação (nunca deixa um
 * documento com trechos de duas versões diferentes misturados).
 */
function registrar_documento(PDO $pdo, array $doc): array {
  $condoId = is_string($doc['condoId'] ?? null) ? $doc['condoId'] : '';
  $tipo = is_string($doc['tipo'] ?? null) ? $doc['tipo'] : '';
  $caminho = is_string($doc['caminhoRelativo'] ?? null) ? $doc['caminhoRelativo'] : '';
  $hash = is_string($doc['hash'] ?? null) ? $doc['hash'] : '';
  $trechos = is_array($doc['trechos'] ?? null) ? $doc['trechos'] : [];
  if ($condoId === '') throw new InvalidArgumentException('Condomínio obrigatório.');
  if (!in_array($tipo, TIPOS_DOCUMENTO, true)) throw new InvalidArgumentException('Tipo de documento inválido.');
  if ($caminho === '') throw new InvalidArgumentException('Caminho do arquivo obrigatório.');
  if (!preg_match('/^[0-9a-f]{64}$/', $hash)) throw new InvalidArgumentException('Hash inválido (esperado SHA-256 em hex).');

  $id = 'doc-' . hash('sha1', $condoId . '|' . $caminho);
  $agora = date('Y-m-d H:i:s');

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare(
      'REPLACE INTO kr_documentos (id, condo_id, tipo, nome_arquivo, caminho_relativo, hash, tamanho, paginas, mtime_origem, status, erro, indexado_em) ' .
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
      $id, $condoId, $tipo,
      is_string($doc['nomeArquivo'] ?? null) ? $doc['nomeArquivo'] : basename($caminho),
      $caminho, $hash,
      (int) ($doc['tamanho'] ?? 0),
      isset($doc['paginas']) ? (int) $doc['paginas'] : null,
      is_string($doc['mtimeOrigem'] ?? null) ? str_replace('T', ' ', substr($doc['mtimeOrigem'], 0, 19)) : null,
      is_string($doc['status'] ?? null) && $doc['status'] === 'erro' ? 'erro' : 'ok',
      is_string($doc['erro'] ?? null) ? $doc['erro'] : null,
      $agora,
    ]);

    $pdo->prepare('DELETE FROM kr_documento_trechos WHERE documento_id = ?')->execute([$id]);
    $ins = $pdo->prepare('INSERT INTO kr_documento_trechos (documento_id, condo_id, pagina_inicial, pagina_final, texto) VALUES (?, ?, ?, ?, ?)');
    foreach ($trechos as $t) {
      if (!is_array($t) || !is_string($t['texto'] ?? null) || trim($t['texto']) === '') continue;
      $ins->execute([$id, $condoId, (int) ($t['paginaInicial'] ?? 1), (int) ($t['paginaFinal'] ?? ($t['paginaInicial'] ?? 1)), $t['texto']]);
    }
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }

  return ['id' => $id, 'condoId' => $condoId, 'tipo' => $tipo, 'indexadoEm' => str_replace(' ', 'T', $agora)];
}

function registrar_historico_consulta(
  PDO $pdo, string $usuarioId, string $condoId, string $pergunta, string $origem,
  int $tokensEntrada, int $tokensSaida, int $custoEstimadoCentavos, int $duracaoMs, string $status
): void {
  $stmt = $pdo->prepare(
    'INSERT INTO kr_consulta_historico (id, usuario_id, condo_id, pergunta, origem, tokens_entrada, tokens_saida, custo_estimado_centavos, duracao_ms, status, criado_em) ' .
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  $stmt->execute([
    'his-' . bin2hex(random_bytes(8)), $usuarioId, $condoId, $pergunta, $origem,
    $tokensEntrada, $tokensSaida, $custoEstimadoCentavos, $duracaoMs, $status, date('Y-m-d H:i:s'),
  ]);
}

/**
 * Pergunta sobre os documentos de um condomínio: cache → busca local → (se configurado e
 * necessário) Claude. Nunca lê nem retorna trecho de outro condomínio.
 */
function consulta_perguntar(PDO $pdo, string $condoId, string $pergunta, string $usuarioId): array {
  $inicio = microtime(true);
  $normalizada = normalizar_pergunta($pergunta);
  if ($normalizada === '') throw new InvalidArgumentException('Digite uma pergunta.');
  $perguntaHash = hash_pergunta($normalizada);
  $versao = versao_indices($pdo, $condoId);

  $emCache = cache_buscar($pdo, $condoId, $perguntaHash, $versao);
  if ($emCache !== null) {
    registrar_historico_consulta($pdo, $usuarioId, $condoId, $pergunta, 'cache', 0, 0, 0, (int) ((microtime(true) - $inicio) * 1000), 'ok');
    return $emCache + ['origem' => 'cache'];
  }

  $trechos = buscar_trechos($pdo, $condoId, $normalizada);
  $fontes = array_map(fn($t) => [
    'documentoId' => $t['documento_id'], 'arquivo' => $t['nome_arquivo'], 'tipo' => $t['tipo'],
    'paginaInicial' => (int) $t['pagina_inicial'], 'paginaFinal' => (int) $t['pagina_final'],
  ], $trechos);

  $resposta = null;
  $origem = 'local';
  $tokensEntrada = 0;
  $tokensSaida = 0;
  $custoCentavos = 0;

  if (count($trechos) > 0) {
    $chave = chave_claude();
    if ($chave !== null) {
      $r = chamar_claude_sobre_trechos($chave, $pergunta, $trechos);
      $resposta = ['texto' => $r['texto'], 'fontes' => $fontes, 'semEvidencia' => false];
      $origem = 'claude';
      $tokensEntrada = $r['tokensEntrada'];
      $tokensSaida = $r['tokensSaida'];
      $custoCentavos = custo_estimado_centavos($tokensEntrada, $tokensSaida);
    } else {
      // Sem chave configurada: devolve os trechos crus como evidência, sem interpretação por IA.
      $resposta = [
        'texto' => 'Não foi possível interpretar os trechos automaticamente (integração com IA não configurada). Veja os trechos encontrados abaixo.',
        'fontes' => $fontes,
        'semEvidencia' => false,
      ];
    }
  } else {
    $resposta = ['texto' => 'Não foram localizadas informações suficientes nos documentos disponibilizados para responder à pergunta com segurança.', 'fontes' => [], 'semEvidencia' => true];
    $origem = 'local';
  }

  $status = $resposta['semEvidencia'] ? 'sem_evidencia' : 'ok';
  registrar_historico_consulta($pdo, $usuarioId, $condoId, $pergunta, $origem, $tokensEntrada, $tokensSaida, $custoCentavos, (int) ((microtime(true) - $inicio) * 1000), $status);
  if (!$resposta['semEvidencia']) cache_salvar($pdo, $condoId, $perguntaHash, $normalizada, $versao, $resposta);
  return $resposta + ['origem' => $origem];
}
