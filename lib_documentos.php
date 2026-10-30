<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

// Drive de Documentos e Consulta Inteligente: armazenamento, busca local (FULLTEXT),
// cache persistente e registro de documentos (qualquer categoria ou pasta/subpasta).

const TIPOS_DOCUMENTO = ['convencao', 'regimento', 'ata', 'seguro', 'contrato', 'laudo', 'notificacao', 'outro'];
const FORMATOS_ARQUIVO = ['pdf', 'docx', 'jpg', 'png', 'webp', 'outro'];

/**
 * Garante de forma idempotente que a tabela auxiliar do Drive (`kr_drive_arquivos`) exista
 * e que `kr_documentos.tipo` aceite todas as categorias (migrando de ENUM para VARCHAR(64) se necessário).
 */
function garantir_esquema_documentos(PDO $pdo): void {
  static $verificado = false;
  if ($verificado) return;
  $verificado = true;
  try {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS kr_drive_arquivos (
        id VARCHAR(64) PRIMARY KEY,
        condo_id VARCHAR(64) NOT NULL,
        formato_original VARCHAR(16) NOT NULL DEFAULT 'pdf',
        data_documento VARCHAR(10) NOT NULL DEFAULT '',
        pdf_data_url LONGTEXT NULL,
        original_data_url LONGTEXT NULL,
        atualizado_em DATETIME NOT NULL,
        KEY idx_condo (condo_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $st = $pdo->query("SHOW COLUMNS FROM kr_documentos LIKE 'tipo'");
    $col = $st ? $st->fetch() : false;
    if ($col && isset($col['Type']) && stripos((string) $col['Type'], 'enum') !== false) {
      $pdo->exec("ALTER TABLE kr_documentos MODIFY COLUMN tipo VARCHAR(64) NOT NULL DEFAULT 'outro'");
    }
  } catch (Throwable $e) {
    error_log('[krieger] garantir_esquema_documentos: ' . $e->getMessage());
  }
}

/** Normaliza espaços/caixa pra perguntas equivalentes caírem na mesma chave de cache. */
function normalizar_pergunta(string $pergunta): string {
  $t = trim(preg_replace('/\s+/u', ' ', $pergunta) ?? $pergunta);
  return mb_strtolower($t, 'UTF-8');
}

function hash_pergunta(string $perguntaNormalizada, string $escopoExtra = ''): string {
  return hash('sha256', $perguntaNormalizada . '|' . $escopoExtra);
}

/**
 * Resume o estado dos documentos do condomínio (ou de toda a base quando $condoId === '*')
 * numa chave curta para invalidação automática do cache.
 */
function versao_indices(PDO $pdo, string $condoId): string {
  if ($condoId === '*') {
    $st = $pdo->query('SELECT COUNT(*) AS n, MAX(indexado_em) AS m FROM kr_documentos');
    $r = $st ? $st->fetch() : ['n' => 0, 'm' => ''];
    return hash('sha1', 'global|' . ($r['n'] ?? 0) . '|' . ($r['m'] ?? ''));
  }
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

/** Mapa rápido id → nome dos condomínios cadastrados. */
function mapa_nomes_condominios(PDO $pdo): array {
  $mapa = [];
  try {
    $st = $pdo->query('SELECT id, dados FROM kr_condominios');
    if ($st) {
      foreach ($st->fetchAll() as $r) {
        $d = json_decode((string) $r['dados'], true);
        if (is_array($d)) {
          $nome = trim((string) ($d['nomeRelatorio'] ?? '')) ?: trim((string) ($d['nome'] ?? ''));
          $codigo = trim((string) ($d['codigo'] ?? ''));
          $mapa[$r['id']] = $codigo !== '' ? "{$codigo} - {$nome}" : $nome;
        }
      }
    }
  } catch (Throwable $e) {
    // Continua sem mapa se falhar
  }
  return $mapa;
}

/**
 * Busca trechos mais relevantes para a pergunta:
 * - Se $condoId === '*', pesquisa em todos os condomínios com documentos na base.
 * - Se $documentoId for informado, restringe apenas àquele documento específico.
 * - Usa FULLTEXT primeiro; se não encontrar por FULLTEXT (ex.: pergunta genérica "resuma este documento"),
 *   faz fallback para os primeiros trechos do escopo selecionado.
 */
function buscar_trechos(PDO $pdo, string $condoId, string $perguntaNormalizada, ?string $documentoId = null, int $limite = 8): array {
  if (trim($perguntaNormalizada) === '') return [];
  $global = ($condoId === '*');

  $where = [];
  $params = [$perguntaNormalizada];
  if (!$global) {
    $where[] = 'dt.condo_id = ?';
    $params[] = $condoId;
  }
  if ($documentoId !== null && $documentoId !== '') {
    $where[] = 'dt.documento_id = ?';
    $params[] = $documentoId;
  }
  $whereSql = count($where) > 0 ? implode(' AND ', $where) . ' AND ' : '';

  $sql =
    'SELECT dt.documento_id, dt.condo_id, dt.pagina_inicial, dt.pagina_final, dt.texto, d.nome_arquivo, d.tipo, ' .
    'MATCH(dt.texto) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevancia ' .
    'FROM kr_documento_trechos dt JOIN kr_documentos d ON d.id = dt.documento_id ' .
    'WHERE ' . $whereSql . 'MATCH(dt.texto) AGAINST (? IN NATURAL LANGUAGE MODE) ' .
    'ORDER BY relevancia DESC LIMIT ' . (int) $limite;

  $st = $pdo->prepare($sql);
  $idx = 1;
  foreach ($params as $p) {
    $st->bindValue($idx++, $p);
  }
  $st->bindValue($idx++, $perguntaNormalizada);
  $st->execute();
  $achados = $st->fetchAll();

  // Fallback quando FULLTEXT não bateu (ex.: documentos curtos ou pedido de resumo geral)
  if (count($achados) === 0) {
    $whereFallback = [];
    $paramsFallback = [];
    if (!$global) {
      $whereFallback[] = 'dt.condo_id = ?';
      $paramsFallback[] = $condoId;
    }
    if ($documentoId !== null && $documentoId !== '') {
      $whereFallback[] = 'dt.documento_id = ?';
      $paramsFallback[] = $documentoId;
    }
    $whereFbSql = count($whereFallback) > 0 ? 'WHERE ' . implode(' AND ', $whereFallback) : '';
    $stFb = $pdo->prepare(
      'SELECT dt.documento_id, dt.condo_id, dt.pagina_inicial, dt.pagina_final, dt.texto, d.nome_arquivo, d.tipo ' .
      'FROM kr_documento_trechos dt JOIN kr_documentos d ON d.id = dt.documento_id ' .
      $whereFbSql . ' ORDER BY d.indexado_em DESC, dt.pagina_inicial ASC LIMIT 6'
    );
    $stFb->execute($paramsFallback);
    $achados = $stFb->fetchAll();
  }

  if (count($achados) > 0) {
    $nomes = mapa_nomes_condominios($pdo);
    foreach ($achados as &$item) {
      $cid = (string) ($item['condo_id'] ?? $condoId);
      $item['condo_nome'] = $nomes[$cid] ?? $cid;
    }
    unset($item);
  }

  return $achados;
}

/** Documentos já indexados deste condomínio (id, caminho, hash, tamanho) — usado pelo agente local. */
function manifesto_condominio(PDO $pdo, string $condoId): array {
  $st = $pdo->prepare('SELECT id, caminho_relativo, hash, tamanho FROM kr_documentos WHERE condo_id = ?');
  $st->execute([$condoId]);
  return $st->fetchAll();
}

/** Lista todos os documentos do Drive de um condomínio (ou de todos se $condoId === '*'). */
function listar_documentos_drive(PDO $pdo, string $condoId): array {
  garantir_esquema_documentos($pdo);
  $sql =
    'SELECT d.id, d.condo_id, d.tipo, d.nome_arquivo, d.caminho_relativo, d.hash, d.tamanho, d.paginas, ' .
    'd.mtime_origem, d.status, d.erro, d.indexado_em, ' .
    'COALESCE(a.formato_original, \'pdf\') AS formato_original, ' .
    'COALESCE(a.data_documento, \'\') AS data_documento, ' .
    'CASE WHEN a.pdf_data_url IS NOT NULL AND a.pdf_data_url != \'\' THEN 1 ELSE 0 END AS tem_pdf, ' .
    'CASE WHEN a.original_data_url IS NOT NULL AND a.original_data_url != \'\' THEN 1 ELSE 0 END AS tem_original ' .
    'FROM kr_documentos d LEFT JOIN kr_drive_arquivos a ON a.id = d.id ';

  if ($condoId !== '*') {
    $st = $pdo->prepare($sql . 'WHERE d.condo_id = ? ORDER BY d.indexado_em DESC, d.nome_arquivo ASC');
    $st->execute([$condoId]);
  } else {
    $st = $pdo->query($sql . 'ORDER BY d.indexado_em DESC, d.nome_arquivo ASC');
  }
  $linhas = $st ? $st->fetchAll() : [];
  return array_map(fn($r) => [
    'id' => $r['id'],
    'condoId' => $r['condo_id'],
    'tipo' => trim((string) ($r['tipo'] ?? '')) ?: 'outro',
    'nomeArquivo' => $r['nome_arquivo'],
    'caminhoRelativo' => $r['caminho_relativo'],
    'hash' => $r['hash'],
    'tamanho' => (int) $r['tamanho'],
    'paginas' => $r['paginas'] !== null ? (int) $r['paginas'] : null,
    'dataDocumento' => $r['data_documento'] ?: substr((string) ($r['mtime_origem'] ?? $r['indexado_em']), 0, 10),
    'formatoOriginal' => in_array($r['formato_original'], FORMATOS_ARQUIVO, true) ? $r['formato_original'] : 'pdf',
    'temPdf' => (bool) $r['tem_pdf'],
    'temOriginal' => (bool) $r['tem_original'],
    'status' => $r['status'] === 'erro' ? 'erro' : 'ok',
    'erro' => $r['erro'],
    'indexadoEm' => str_replace(' ', 'T', (string) $r['indexado_em']),
  ], $linhas);
}

/** Contagem de documentos indexados por condomínio (`[condoId => quantidade]`). */
function resumo_documentos_por_condominio(PDO $pdo): array {
  garantir_esquema_documentos($pdo);
  $st = $pdo->query('SELECT condo_id, COUNT(*) AS n FROM kr_documentos GROUP BY condo_id');
  $out = [];
  if ($st) {
    foreach ($st->fetchAll() as $r) {
      $out[(string) $r['condo_id']] = (int) $r['n'];
    }
  }
  return $out;
}

/** Obtém os arquivos binários (Data URL do PDF e/ou do original) para visualização inline ou download. */
function obter_conteudo_documento(PDO $pdo, string $id): ?array {
  garantir_esquema_documentos($pdo);
  $st = $pdo->prepare(
    'SELECT d.id, d.nome_arquivo, COALESCE(a.formato_original, \'pdf\') AS formato_original, ' .
    'a.pdf_data_url, a.original_data_url ' .
    'FROM kr_documentos d LEFT JOIN kr_drive_arquivos a ON a.id = d.id WHERE d.id = ?'
  );
  $st->execute([$id]);
  $r = $st->fetch();
  if (!$r) return null;
  return [
    'id' => $r['id'],
    'nomeArquivo' => $r['nome_arquivo'],
    'formatoOriginal' => $r['formato_original'],
    'pdfDataUrl' => $r['pdf_data_url'] ?? null,
    'originalDataUrl' => $r['original_data_url'] ?? null,
  ];
}

/** Atualiza metadados do documento no Drive (renomear, mudar pasta/subpasta, categoria ou data). */
function atualizar_documento_drive(PDO $pdo, string $id, array $campos): array {
  garantir_esquema_documentos($pdo);
  $st = $pdo->prepare('SELECT id, condo_id, nome_arquivo, tipo, caminho_relativo FROM kr_documentos WHERE id = ?');
  $st->execute([$id]);
  $atual = $st->fetch();
  if (!$atual) throw new InvalidArgumentException('Documento não encontrado.');

  $novoNome = isset($campos['nomeArquivo']) && is_string($campos['nomeArquivo']) && trim($campos['nomeArquivo']) !== ''
    ? trim($campos['nomeArquivo'])
    : (string) $atual['nome_arquivo'];
  $novoTipo = isset($campos['tipo']) && is_string($campos['tipo']) && trim($campos['tipo']) !== ''
    ? substr(trim($campos['tipo']), 0, 64)
    : (string) $atual['tipo'];
  $novoCaminho = isset($campos['caminhoRelativo']) && is_string($campos['caminhoRelativo']) && trim($campos['caminhoRelativo']) !== ''
    ? trim($campos['caminhoRelativo'])
    : (string) ($atual['caminho_relativo'] ?? $novoNome);

  $pdo->prepare('UPDATE kr_documentos SET nome_arquivo = ?, tipo = ?, caminho_relativo = ? WHERE id = ?')
    ->execute([$novoNome, $novoTipo, $novoCaminho, $id]);

  if (isset($campos['dataDocumento']) && is_string($campos['dataDocumento'])) {
    $pdo->prepare('UPDATE kr_drive_arquivos SET data_documento = ?, atualizado_em = ? WHERE id = ?')
      ->execute([trim($campos['dataDocumento']), date('Y-m-d H:i:s'), $id]);
  }

  return ['ok' => true, 'id' => $id, 'nomeArquivo' => $novoNome, 'tipo' => $novoTipo];
}

/** Exclui um documento do Drive e seus respectivos trechos indexados. */
function excluir_documento_drive(PDO $pdo, string $id): void {
  garantir_esquema_documentos($pdo);
  $pdo->beginTransaction();
  try {
    $pdo->prepare('DELETE FROM kr_documento_trechos WHERE documento_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM kr_drive_arquivos WHERE id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM kr_documentos WHERE id = ?')->execute([$id]);
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

/**
 * Upsert de um documento indexado + substituição dos trechos dele + armazenamento no Drive.
 */
function registrar_documento(PDO $pdo, array $doc): array {
  garantir_esquema_documentos($pdo);
  $condoId = is_string($doc['condoId'] ?? null) ? $doc['condoId'] : '';
  $tipo = is_string($doc['tipo'] ?? null) && trim($doc['tipo']) !== '' ? substr(trim($doc['tipo']), 0, 64) : 'outro';
  $caminho = is_string($doc['caminhoRelativo'] ?? null) ? $doc['caminhoRelativo'] : '';
  $hash = is_string($doc['hash'] ?? null) ? $doc['hash'] : '';
  $trechos = is_array($doc['trechos'] ?? null) ? $doc['trechos'] : [];
  if ($condoId === '') throw new InvalidArgumentException('Condomínio obrigatório.');
  if ($caminho === '') throw new InvalidArgumentException('Caminho do arquivo obrigatório.');
  if (!preg_match('/^[0-9a-f]{64}$/', $hash)) throw new InvalidArgumentException('Hash inválido (esperado SHA-256 em hex).');

  $id = 'doc-' . hash('sha1', $condoId . '|' . $caminho);
  $agora = date('Y-m-d H:i:s');
  $nomeArquivo = is_string($doc['nomeArquivo'] ?? null) && trim($doc['nomeArquivo']) !== '' ? trim($doc['nomeArquivo']) : basename($caminho);
  $formatoOriginal = is_string($doc['formatoOriginal'] ?? null) && in_array($doc['formatoOriginal'], FORMATOS_ARQUIVO, true)
    ? $doc['formatoOriginal']
    : 'pdf';
  $dataDocumento = is_string($doc['dataDocumento'] ?? null) && trim($doc['dataDocumento']) !== ''
    ? trim($doc['dataDocumento'])
    : substr($agora, 0, 10);
  $pdfDataUrl = is_string($doc['pdfDataUrl'] ?? null) && $doc['pdfDataUrl'] !== '' ? $doc['pdfDataUrl'] : null;
  $originalDataUrl = is_string($doc['originalDataUrl'] ?? null) && $doc['originalDataUrl'] !== '' ? $doc['originalDataUrl'] : null;

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare(
      'REPLACE INTO kr_documentos (id, condo_id, tipo, nome_arquivo, caminho_relativo, hash, tamanho, paginas, mtime_origem, status, erro, indexado_em) ' .
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
      $id, $condoId, $tipo,
      $nomeArquivo,
      $caminho, $hash,
      (int) ($doc['tamanho'] ?? 0),
      isset($doc['paginas']) ? (int) $doc['paginas'] : null,
      is_string($doc['mtimeOrigem'] ?? null) ? str_replace('T', ' ', substr($doc['mtimeOrigem'], 0, 19)) : null,
      is_string($doc['status'] ?? null) && $doc['status'] === 'erro' ? 'erro' : 'ok',
      is_string($doc['erro'] ?? null) ? $doc['erro'] : null,
      $agora,
    ]);

    if ($pdfDataUrl !== null || $originalDataUrl !== null || isset($doc['formatoOriginal']) || isset($doc['dataDocumento'])) {
      $stmtDrive = $pdo->prepare(
        'REPLACE INTO kr_drive_arquivos (id, condo_id, formato_original, data_documento, pdf_data_url, original_data_url, atualizado_em) ' .
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      $stmtDrive->execute([$id, $condoId, $formatoOriginal, $dataDocumento, $pdfDataUrl, $originalDataUrl, $agora]);
    }

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
 * Pergunta sobre os documentos de um condomínio específico ou de todos os condomínios ('*'):
 * cache → busca local → Claude (com gasto mínimo de tokens).
 */
function consulta_perguntar(PDO $pdo, string $condoId, string $pergunta, string $usuarioId, ?string $documentoId = null): array {
  garantir_esquema_documentos($pdo);
  $inicio = microtime(true);
  $normalizada = normalizar_pergunta($pergunta);
  if ($normalizada === '') throw new InvalidArgumentException('Digite uma pergunta ou questionamento.');
  $escopoExtra = ($documentoId !== null && $documentoId !== '') ? $documentoId : '';
  $perguntaHash = hash_pergunta($normalizada, $escopoExtra);
  $versao = versao_indices($pdo, $condoId);

  $emCache = cache_buscar($pdo, $condoId, $perguntaHash, $versao);
  if ($emCache !== null) {
    registrar_historico_consulta($pdo, $usuarioId, $condoId, $pergunta, 'cache', 0, 0, 0, (int) ((microtime(true) - $inicio) * 1000), 'ok');
    return $emCache + ['origem' => 'cache'];
  }

  $trechos = buscar_trechos($pdo, $condoId, $normalizada, $documentoId);
  $fontes = array_map(fn($t) => [
    'documentoId' => $t['documento_id'],
    'arquivo' => $t['nome_arquivo'],
    'tipo' => trim((string) ($t['tipo'] ?? '')) ?: 'outro',
    'paginaInicial' => (int) $t['pagina_inicial'],
    'paginaFinal' => (int) $t['pagina_final'],
    'condoId' => $t['condo_id'] ?? $condoId,
    'condoNome' => $t['condo_nome'] ?? null,
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
      $resumoLocal = array_map(fn($t) => "• [{$t['nome_arquivo']}, pág. {$t['pagina_inicial']}]: " . mb_substr(trim((string) $t['texto']), 0, 350) . '...', array_slice($trechos, 0, 4));
      $resposta = [
        'texto' => "Trechos localizados na base (integração com IA não configurada no servidor):\n\n" . implode("\n\n", $resumoLocal),
        'fontes' => $fontes,
        'semEvidencia' => false,
      ];
    }
  } else {
    $resposta = [
      'texto' => 'Não foram localizadas informações suficientes nos documentos disponibilizados no Drive para responder a este questionamento com segurança.',
      'fontes' => [],
      'semEvidencia' => true,
    ];
    $origem = 'local';
  }

  $status = $resposta['semEvidencia'] ? 'sem_evidencia' : 'ok';
  registrar_historico_consulta($pdo, $usuarioId, $condoId, $pergunta, $origem, $tokensEntrada, $tokensSaida, $custoCentavos, (int) ((microtime(true) - $inicio) * 1000), $status);
  if (!$resposta['semEvidencia']) cache_salvar($pdo, $condoId, $perguntaHash, $normalizada, $versao, $resposta);
  return $resposta + ['origem' => $origem];
}
