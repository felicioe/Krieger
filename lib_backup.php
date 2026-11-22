<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

require_once __DIR__ . '/lib_exercicios.php';
require_once __DIR__ . '/lib_previsoes.php';

/** Compatibilidade da coleção opcional da PR73 enquanto a migração não chega ao servidor. */
function tabela_anexos_disponivel(PDO $pdo): bool {
  try { $pdo->query('SELECT id FROM kr_anexos_importacao LIMIT 1'); return true; }
  catch (PDOException $e) { if ($e->getCode() === '42S02') return false; throw $e; }
}
/**
 * Stores com tabela própria (colunas normalizadas), que não usam o REPLACE genérico de id/dados:
 * `historico_rateios` e `previsoes_aprovadas`. Backups antigos podem não ter a chave; nesse caso a
 * restauração não toca na tabela, nem com "substituir tudo" (os dados não seriam recuperáveis).
 */
function backup_store_especial(string $store): bool {
  return in_array($store, ['historico_rateios', 'previsoes_aprovadas'], true);
}

function ler_colecao_backup(PDO $pdo, string $store): array {
  if ($store === 'previsoes_aprovadas') return listar_previsoes_aprovadas($pdo);
  if ($store === 'historico_rateios') {
    $ids = $pdo->query('SELECT id FROM kr_historico_rateios ORDER BY condo_id, ano')->fetchAll(PDO::FETCH_COLUMN);
    return array_values(array_filter(array_map(static fn($id) => ler_registro_exercicio($pdo, 'historico_rateios', (string)$id), $ids)));
  }
  if ($store === 'anexos_importacao' && !tabela_anexos_disponivel($pdo)) return [];
  $linhas = $pdo->query('SELECT dados FROM kr_' . $store)->fetchAll(PDO::FETCH_COLUMN);
  return array_map(static function(string $json) use ($pdo, $store) { $o = json_decode($json, true, 512, JSON_THROW_ON_ERROR); return $store === 'condominios' ? incluir_indices_tabela($pdo, $o) : $o; }, $linhas);
}
/** Nunca ignorar anexos presentes num backup: impedir restauração antes de alterar dados. */
function stores_restauraveis(PDO $pdo, array $dados, array $stores): array {
  if (!in_array('anexos_importacao', $stores, true) || tabela_anexos_disponivel($pdo)) return $stores;
  if (!empty($dados['anexos_importacao'])) throw new RuntimeException('Este backup contém anexos. Aplique a tabela kr_anexos_importacao antes de restaurar.', 409);
  return array_values(array_filter($stores, static fn(string $s) => $s !== 'anexos_importacao'));
}

/** Soma com tolerância de centavos (valores gravados em DECIMAL e somados em ponto flutuante). */
function backup_soma_confere(float $total, array $valores): bool {
  return abs($total - array_sum($valores)) < 0.015;
}

/**
 * Valida os previstos aprovados de um backup antes de qualquer gravação. Devolve a mensagem do
 * primeiro problema ou null. `$condoIds` são os condomínios do backup e do sistema.
 */
function validar_previsoes_backup(array $lista, array $condoIds): ?string {
  $pares = [];
  foreach ($lista as $i => $p) {
    $rot = "Previsto aprovado '" . (is_array($p) ? (string)($p['id'] ?? $i) : $i) . "'";
    if (!is_array($p)) return "Item inválido em 'previsoes_aprovadas' (posição $i).";
    $condo = $p['condoId'] ?? null;
    $ano = $p['exercicioDestino'] ?? null;
    if (!is_string($condo) || $condo === '') return "$rot sem condomínio.";
    if (!isset($condoIds[$condo])) return "$rot vinculado a condomínio que não existe no backup nem no sistema.";
    if (!is_int($ano) && !(is_string($ano) && ctype_digit($ano))) return "$rot sem exercício de destino válido.";
    $ano = (int)$ano;
    if ($ano < 1900 || $ano > 2999) return "$rot com exercício de destino fora do intervalo.";
    $chave = $condo . '|' . $ano;
    if (isset($pares[$chave])) return "Previsto aprovado duplicado para o condomínio '$condo' e o exercício $ano.";
    $pares[$chave] = true;
    if (!is_numeric($p['percentualAprovado'] ?? null)) return "$rot sem percentual aprovado.";
    if (!is_numeric($p['totalPrevisto'] ?? null)) return "$rot sem total previsto.";
    if (!is_int($p['versao'] ?? null) || $p['versao'] < 1) return "$rot com versão inválida.";
    if (!is_array($p['grupos'] ?? null)) return "$rot sem detalhamento.";
    $totaisGrupos = [];
    foreach ($p['grupos'] as $g) {
      if (!is_array($g) || !is_numeric($g['totalPrevisto'] ?? null) || !is_array($g['contas'] ?? null)) return "$rot com grupo inválido no detalhamento.";
      $previstos = [];
      foreach ($g['contas'] as $c) {
        if (!is_array($c) || !is_numeric($c['previsto'] ?? null)) return "$rot com conta inválida no detalhamento.";
        $previstos[] = (float)$c['previsto'];
      }
      if (!backup_soma_confere((float)$g['totalPrevisto'], $previstos)) return "$rot com total de grupo que não fecha pela soma das contas.";
      $totaisGrupos[] = (float)$g['totalPrevisto'];
    }
    if (!backup_soma_confere((float)$p['totalPrevisto'], $totaisGrupos)) return "$rot com total que não fecha pela soma dos grupos.";
  }
  return null;
}

/** Grava um previsto aprovado do backup preservando versão, origem e histórico (sem criar versão nova). */
function restaurar_previsao_aprovada(PDO $pdo, array $p): void {
  $quando = static fn($v) => is_string($v) && $v !== '' ? str_replace('T', ' ', substr($v, 0, 19)) : date('Y-m-d H:i:s');
  $st = $pdo->prepare(
    'INSERT INTO kr_previsoes_aprovadas (id, condo_id, exercicio_destino, versao, exercicio_base_id, percentual_aprovado, total_previsto, detalhamento, origem, aprovado_em, aprovado_por, anterior)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = VALUES(id), versao = VALUES(versao), exercicio_base_id = VALUES(exercicio_base_id),
       percentual_aprovado = VALUES(percentual_aprovado), total_previsto = VALUES(total_previsto), detalhamento = VALUES(detalhamento),
       origem = VALUES(origem), aprovado_em = VALUES(aprovado_em), aprovado_por = VALUES(aprovado_por), anterior = VALUES(anterior)'
  );
  $st->execute([
    (string)$p['id'], (string)$p['condoId'], (int)$p['exercicioDestino'], (int)$p['versao'],
    isset($p['exercicioBaseId']) ? (string)$p['exercicioBaseId'] : null, (float)$p['percentualAprovado'], (float)$p['totalPrevisto'],
    json_encode($p['grupos'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), (string)($p['origem'] ?? 'aprovacao'),
    $quando($p['aprovadoEm'] ?? null), isset($p['aprovadoPor']) ? (string)$p['aprovadoPor'] : null,
    is_array($p['anterior'] ?? null) ? json_encode($p['anterior'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : null,
  ]);
}

/**
 * Restaura uma store com tabela própria dentro da transação de `restaurar_dados`. Sem a chave no
 * backup (backup antigo) a tabela não é tocada. Previstos aprovados exigem a tabela criada pela
 * migration 20261121; sem ela e com dados no backup, a restauração é recusada antes de gravar.
 */
function restaurar_store_especial(PDO $pdo, string $store, array $dados, bool $substituir): void {
  if (!array_key_exists($store, $dados)) return;
  $lista = is_array($dados[$store]) ? $dados[$store] : [];
  if ($store === 'previsoes_aprovadas') {
    if (!previsao_tabela_existe($pdo)) {
      if ($lista) throw new RuntimeException('Este backup contém previstos aprovados. Aplique a migration 20261121_previsoes_aprovadas.sql antes de restaurar.', 409);
      return;
    }
    if ($substituir) $pdo->exec('DELETE FROM kr_previsoes_aprovadas');
    foreach ($lista as $p) if (is_array($p)) restaurar_previsao_aprovada($pdo, $p);
    return;
  }
  if ($store === 'historico_rateios') {
    if ($substituir) $pdo->exec('DELETE FROM kr_historico_rateios');
    foreach ($lista as $linha) if (is_array($linha) && !empty($linha['id'])) gravar_registro_exercicio($pdo, 'historico_rateios', $linha);
  }
}

