<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** Compatibilidade da coleção opcional da PR73 enquanto a migração não chega ao servidor. */
function tabela_anexos_disponivel(PDO $pdo): bool {
  try { $pdo->query('SELECT id FROM kr_anexos_importacao LIMIT 1'); return true; }
  catch (PDOException $e) { if ($e->getCode() === '42S02') return false; throw $e; }
}
function ler_colecao_backup(PDO $pdo, string $store): array {
  if ($store === 'anexos_importacao' && !tabela_anexos_disponivel($pdo)) return [];
  $linhas = $pdo->query('SELECT dados FROM kr_' . $store)->fetchAll(PDO::FETCH_COLUMN);
  return array_map(static fn(string $json) => json_decode($json, true, 512, JSON_THROW_ON_ERROR), $linhas);
}
/** Nunca ignorar anexos presentes num backup: impedir restauração antes de alterar dados. */
function stores_restauraveis(PDO $pdo, array $dados, array $stores): array {
  if (!in_array('anexos_importacao', $stores, true) || tabela_anexos_disponivel($pdo)) return $stores;
  if (!empty($dados['anexos_importacao'])) throw new RuntimeException('Este backup contém anexos. Aplique a tabela kr_anexos_importacao antes de restaurar.', 409);
  return array_values(array_filter($stores, static fn(string $s) => $s !== 'anexos_importacao'));
}
