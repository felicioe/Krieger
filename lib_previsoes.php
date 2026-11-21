<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/**
 * Previsto aprovado (issues #285 e #286). Espelha `domain/previstoAprovado.ts`: previsto simples =
 * realizado de cada conta do exercício-base × (1 + percentual), arredondado em centavos por linha;
 * os totais fecham pela soma das linhas gravadas. O percentual vem do histórico de rateios.
 * Os números devem coincidir com o domínio TypeScript (fixtures compartilhadas em
 * `domain/fixtures/previsto-aprovado.json`, conferidas por `scripts/test-previsoes-aprovadas.php`).
 */

function previsao_centavos(float $n): float {
  $r = round(abs($n) * 100 + 1e-7) / 100;
  return $n < 0 ? -$r : $r;
}

/** Chave de comparação de rótulos: sem acentos, minúsculas, espaços simples (igual a `chaveConta`). */
function previsao_chave(string $s): string {
  static $mapa = [
    'á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','Á'=>'a','À'=>'a','Â'=>'a','Ã'=>'a','Ä'=>'a',
    'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','É'=>'e','È'=>'e','Ê'=>'e','Ë'=>'e',
    'í'=>'i','ì'=>'i','î'=>'i','ï'=>'i','Í'=>'i','Ì'=>'i','Î'=>'i','Ï'=>'i',
    'ó'=>'o','ò'=>'o','ô'=>'o','õ'=>'o','ö'=>'o','Ó'=>'o','Ò'=>'o','Ô'=>'o','Õ'=>'o','Ö'=>'o',
    'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u','Ú'=>'u','Ù'=>'u','Û'=>'u','Ü'=>'u',
    'ç'=>'c','Ç'=>'c','ñ'=>'n','Ñ'=>'n',
  ];
  $s = strtr($s, $mapa);
  $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
  $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
  return trim($s);
}

function previsao_tem_despesas(?array $dem): bool {
  foreach (($dem['despesas']['grupos'] ?? []) as $g) {
    foreach (($g['itens'] ?? []) as $it) {
      if (trim((string)($it['nome'] ?? '')) !== '' || (float)($it['valor'] ?? 0) != 0.0) return true;
    }
  }
  return false;
}

/** Previsto por grupo e conta a partir do demonstrativo do exercício-base. */
function previsao_calcular(array $demonstrativoBase, float $percentual, array $mapeamento = []): array {
  $mapa = [];
  foreach ($mapeamento as $d) {
    $de = trim((string)($d['de'] ?? ''));
    if ($de !== '') $mapa[previsao_chave($de)] = (string)($d['para'] ?? '');
  }
  $nomeDe = static fn(string $s): string => $mapa[previsao_chave($s)] ?? $s;
  $fator = 1 + $percentual / 100;
  $grupos = [];
  foreach (($demonstrativoBase['despesas']['grupos'] ?? []) as $g) {
    $nomeGrupo = $nomeDe((string)($g['nome'] ?? ''));
    $gk = previsao_chave($nomeGrupo);
    if (!isset($grupos[$gk])) $grupos[$gk] = ['nome' => $nomeGrupo, 'contas' => []];
    foreach (($g['itens'] ?? []) as $it) {
      $nomeConta = $nomeDe((string)($it['nome'] ?? ''));
      $ck = previsao_chave($nomeConta);
      if (!isset($grupos[$gk]['contas'][$ck])) $grupos[$gk]['contas'][$ck] = ['nome' => $nomeConta, 'realizado' => 0.0];
      $grupos[$gk]['contas'][$ck]['realizado'] += (float)($it['valor'] ?? 0);
    }
  }
  $total = 0.0;
  $saida = [];
  foreach ($grupos as $gk => $g) {
    $contas = [];
    $totalGrupo = 0.0;
    foreach ($g['contas'] as $ck => $c) {
      $previsto = previsao_centavos($c['realizado'] * $fator);
      $contas[] = ['grupo' => $g['nome'], 'nome' => $c['nome'], 'chave' => $ck, 'realizadoOrigem' => previsao_centavos($c['realizado']), 'previsto' => $previsto];
      $totalGrupo += $previsto;
    }
    $totalGrupo = previsao_centavos($totalGrupo);
    $total += $totalGrupo;
    $saida[] = ['nome' => $g['nome'], 'chave' => $gk, 'totalPrevisto' => $totalGrupo, 'contas' => $contas];
  }
  return ['totalPrevisto' => previsao_centavos($total), 'grupos' => $saida];
}

function previsao_tabela_existe(PDO $pdo): bool {
  try { $pdo->query('SELECT 1 FROM kr_previsoes_aprovadas LIMIT 1'); return true; }
  catch (PDOException) { return false; }
}

/** Percentual aprovado do ano-base no histórico de rateios (0 é válido; null = não encontrado). */
function previsao_percentual_historico(PDO $pdo, string $condoId, int $ano): ?float {
  try {
    $st = $pdo->prepare('SELECT variacao, rateio_atual, rateio_sugerido, rateio_aprovado FROM kr_historico_rateios WHERE condo_id = ? AND ano = ?');
    $st->execute([$condoId, $ano]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
  } catch (PDOException) { return null; }
  if (!$r) return null;
  if ($r['variacao'] !== null) return (float)$r['variacao'];
  $base = $r['rateio_atual'] ?? $r['rateio_sugerido'];
  if ($base === null || (float)$base == 0.0 || $r['rateio_aprovado'] === null) return null;
  return round(((float)$r['rateio_aprovado'] / (float)$base - 1) * 10000) / 100;
}

function previsao_id(string $condoId, int $ano): string {
  return 'pa-' . substr(sha1($condoId . '|' . $ano), 0, 24);
}

function previsao_da_linha(array $r): array {
  return [
    'id' => (string)$r['id'], 'condoId' => (string)$r['condo_id'], 'exercicioDestino' => (int)$r['exercicio_destino'],
    'versao' => (int)$r['versao'], 'exercicioBaseId' => $r['exercicio_base_id'] !== null ? (string)$r['exercicio_base_id'] : null,
    'percentualAprovado' => (float)$r['percentual_aprovado'], 'totalPrevisto' => (float)$r['total_previsto'],
    'grupos' => json_decode((string)$r['detalhamento'], true, 512, JSON_THROW_ON_ERROR),
    'origem' => (string)$r['origem'], 'aprovadoEm' => (string)$r['aprovado_em'],
    'aprovadoPor' => $r['aprovado_por'] !== null ? (string)$r['aprovado_por'] : null,
    'anterior' => $r['anterior'] !== null ? json_decode((string)$r['anterior'], true, 512, JSON_THROW_ON_ERROR) : null,
  ];
}

function ler_previsao_aprovada(PDO $pdo, string $condoId, int $ano, bool $bloquear = false): ?array {
  $st = $pdo->prepare('SELECT * FROM kr_previsoes_aprovadas WHERE condo_id = ? AND exercicio_destino = ?' . ($bloquear ? ' FOR UPDATE' : ''));
  $st->execute([$condoId, $ano]);
  $r = $st->fetch(PDO::FETCH_ASSOC);
  return $r ? previsao_da_linha($r) : null;
}

function listar_previsoes_aprovadas(PDO $pdo): array {
  try { $linhas = $pdo->query('SELECT * FROM kr_previsoes_aprovadas ORDER BY condo_id, exercicio_destino')->fetchAll(PDO::FETCH_ASSOC); }
  catch (PDOException) { return []; }
  return array_map('previsao_da_linha', $linhas);
}

/**
 * Grava (ou substitui por nova versão) o previsto aprovado do condomínio/exercício de destino.
 * Deve rodar dentro de uma transação; o chamador decide o `origem` ('aprovacao' ou 'carga_inicial').
 */
function gravar_previsao_aprovada(PDO $pdo, string $condoId, int $anoDestino, ?string $exercicioBaseId, float $percentual, array $calculo, string $origem, ?string $usuarioId): array {
  $existente = ler_previsao_aprovada($pdo, $condoId, $anoDestino, true);
  $agora = date('Y-m-d H:i:s');
  $detalhe = json_encode($calculo['grupos'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
  if ($existente) {
    $anterior = json_encode([
      'versao' => $existente['versao'], 'exercicioBaseId' => $existente['exercicioBaseId'], 'percentualAprovado' => $existente['percentualAprovado'],
      'totalPrevisto' => $existente['totalPrevisto'], 'origem' => $existente['origem'], 'aprovadoEm' => $existente['aprovadoEm'], 'aprovadoPor' => $existente['aprovadoPor'],
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $st = $pdo->prepare('UPDATE kr_previsoes_aprovadas SET versao = ?, exercicio_base_id = ?, percentual_aprovado = ?, total_previsto = ?, detalhamento = ?, origem = ?, aprovado_em = ?, aprovado_por = ?, anterior = ? WHERE condo_id = ? AND exercicio_destino = ?');
    $st->execute([$existente['versao'] + 1, $exercicioBaseId, $percentual, $calculo['totalPrevisto'], $detalhe, $origem, $agora, $usuarioId, $anterior, $condoId, $anoDestino]);
  } else {
    $st = $pdo->prepare('INSERT INTO kr_previsoes_aprovadas (id, condo_id, exercicio_destino, versao, exercicio_base_id, percentual_aprovado, total_previsto, detalhamento, origem, aprovado_em, aprovado_por, anterior) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, NULL)');
    $st->execute([previsao_id($condoId, $anoDestino), $condoId, $anoDestino, $exercicioBaseId, $percentual, $calculo['totalPrevisto'], $detalhe, $origem, $agora, $usuarioId]);
  }
  return ler_previsao_aprovada($pdo, $condoId, $anoDestino) ?? throw new RuntimeException('Previsto aprovado não foi gravado.');
}

/**
 * Carga inicial: gera o previsto de N+1 para cada exercício N com demonstrativo e percentual
 * identificáveis no histórico de rateios. Com `$aplicar = false` só simula (nada é gravado). Nunca
 * substitui um previsto existente nem altera exercícios (fechados ou não).
 */
function previsoes_carga_inicial(PDO $pdo, bool $aplicar, ?string $usuarioId): array {
  if ($aplicar && !previsao_tabela_existe($pdo)) throw new RuntimeException('Aplique a migration 20261121_previsoes_aprovadas.sql antes da carga.', 409);
  $exercicios = [];
  foreach ($pdo->query('SELECT dados FROM kr_exercicios')->fetchAll(PDO::FETCH_COLUMN) as $json) $exercicios[] = json_decode((string)$json, true, 512, JSON_THROW_ON_ERROR);
  $condos = [];
  foreach ($pdo->query('SELECT dados FROM kr_condominios')->fetchAll(PDO::FETCH_COLUMN) as $json) { $c = json_decode((string)$json, true, 512, JSON_THROW_ON_ERROR); $condos[(string)($c['id'] ?? '')] = $c; }
  $destinoFechado = [];
  foreach ($exercicios as $e) if (!empty($e['fechado'])) $destinoFechado[($e['condoId'] ?? '') . '|' . (int)($e['ano'] ?? 0)] = true;
  usort($exercicios, static fn($a, $b) => [($a['condoNome'] ?? ''), (int)($a['ano'] ?? 0)] <=> [($b['condoNome'] ?? ''), (int)($b['ano'] ?? 0)]);
  $linhas = [];
  $gravados = 0;
  if ($aplicar) $pdo->beginTransaction();
  try {
    foreach ($exercicios as $e) {
      $condoId = (string)($e['condoId'] ?? '');
      $ano = (int)($e['ano'] ?? 0);
      $linha = [
        'condoId' => $condoId, 'condoNome' => (string)($e['condoNome'] ?? ($condos[$condoId]['nome'] ?? '')), 'exercicioBaseId' => (string)($e['id'] ?? ''),
        'anoBase' => $ano, 'exercicioDestino' => $ano + 1, 'percentual' => null, 'totalPrevisto' => null, 'status' => 'pronto', 'motivo' => '',
        'destinoFechado' => isset($destinoFechado[$condoId . '|' . ($ano + 1)]),
      ];
      if (!previsao_tem_despesas($e['demonstrativo'] ?? null)) { $linha['status'] = 'pendente'; $linha['motivo'] = 'Exercício sem demonstrativo com despesas.'; $linhas[] = $linha; continue; }
      $pct = previsao_percentual_historico($pdo, $condoId, $ano);
      if ($pct === null) { $linha['status'] = 'pendente'; $linha['motivo'] = 'Percentual aprovado não encontrado no histórico de rateios de ' . $ano . '.'; $linhas[] = $linha; continue; }
      $calculo = previsao_calcular($e['demonstrativo'], $pct, $condos[$condoId]['mapeamento'] ?? []);
      $linha['percentual'] = $pct;
      $linha['totalPrevisto'] = $calculo['totalPrevisto'];
      if (previsao_tabela_existe($pdo) && ler_previsao_aprovada($pdo, $condoId, $ano + 1)) { $linha['status'] = 'ja_existe'; $linha['motivo'] = 'Já existe previsto aprovado para o exercício de destino.'; $linhas[] = $linha; continue; }
      if ($aplicar) {
        gravar_previsao_aprovada($pdo, $condoId, $ano + 1, (string)($e['id'] ?? ''), $pct, $calculo, 'carga_inicial', $usuarioId);
        $linha['status'] = 'gravado';
        $gravados++;
      }
      $linhas[] = $linha;
    }
    if ($aplicar) $pdo->commit();
  } catch (Throwable $erro) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $erro; }
  return ['aplicado' => $aplicar, 'gravados' => $gravados, 'linhas' => $linhas];
}
