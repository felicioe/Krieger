<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** Índices próprios do condomínio; nunca um catálogo compartilhado de índices econômicos. */
function validar_indices_condominio(array $indices): array {
  $anos = []; $resultado = [];
  foreach ($indices as $indice) {
    if (!is_array($indice) || !isset($indice['ano'], $indice['pct']) || !is_numeric($indice['ano']) || !is_numeric($indice['pct'])) throw new InvalidArgumentException('Informe ano e percentual de cada índice.');
    $ano = (int)$indice['ano']; $pct = (float)$indice['pct'];
    if ((float)$indice['ano'] !== (float)$ano || $ano < 1900 || $ano > 2999 || !is_finite($pct) || abs($pct) > 999999.9999) throw new InvalidArgumentException('Ano ou percentual do índice inválido.');
    if (isset($anos[$ano])) throw new InvalidArgumentException('Há mais de um índice para o mesmo ano. Revise o histórico antes de salvar.');
    $anos[$ano] = true;
    $resultado[] = ['ano' => $ano, 'pct' => round($pct, 4), 'noRelatorio' => ($indice['noRelatorio'] ?? true) !== false];
  }
  usort($resultado, static fn($a, $b) => $a['ano'] <=> $b['ano']);
  return $resultado;
}
/** Deve participar da transação que grava o condomínio. JSON preservado para backups legados. */
function substituir_indices_condominio(PDO $pdo, array $c): array {
  $indices = validar_indices_condominio($c['indices'] ?? []);
  $antes = $pdo->prepare('SELECT ano,data_aplicacao FROM kr_indices_condominio WHERE condo_id = ?');
  $antes->execute([$c['id']]);
  $datas = $antes->fetchAll(PDO::FETCH_KEY_PAIR);
  $pdo->prepare('DELETE FROM kr_indices_condominio WHERE condo_id = ?')->execute([$c['id']]);
  $st = $pdo->prepare('INSERT INTO kr_indices_condominio (id,condo_id,ano,indice,tipo,mes_referencia,data_aplicacao) VALUES (?,?,?,?,NULL,NULL,?)');
  foreach ($indices as $i) {
    // Data de registro, não uma data histórica de aplicação inventada.
    $st->execute([hash('sha256', $c['id'] . ':' . $i['ano']), $c['id'], $i['ano'], $i['pct'], $datas[$i['ano']] ?? date('Y-m-d H:i:s')]);
  }
  $c['indices'] = $indices;
  $c['indicesInicializados'] = true; // inclusive []: exclusão manual não pode ressuscitar na reimportação.
  return $c;
}
/** Importa índices da prestação de contas para a tabela do condomínio. */
function inicializar_indices_importados(PDO $pdo, array $e): void {
  if (empty($e['consid']['indices']) || empty($e['condoId'])) return;
  $st = $pdo->prepare('SELECT dados FROM kr_condominios WHERE id = ? FOR UPDATE');
  $st->execute([$e['condoId']]); $json = $st->fetchColumn();
  if ($json === false) return;
  $c = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

  // Cada reajuste é negociado por condomínio e ano. Depois da carga inicial,
  // somente o cadastro mantém o histórico, inclusive exclusões intencionais.
  // Reimportar uma prestação não aprova nem substitui reajustes negociados.
  if (!empty($c['indicesInicializados'])) return;
  // Preserva também o histórico legado já informado no cadastro.
  $c['indices'] = !empty($c['indices']) ? $c['indices'] : $e['consid']['indices'];
  $c = substituir_indices_condominio($pdo, $c);
  $pdo->prepare('UPDATE kr_condominios SET dados = ?, atualizado_em = ? WHERE id = ?')->execute([json_encode($c, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), date('Y-m-d H:i:s'), $c['id']]);
}
/** Leitura da tabela; enquanto legado não migrado, exibe o JSON sem perda de informação. */
function incluir_indices_tabela(PDO $pdo, array $c): array {
  if (empty($c['indicesInicializados'])) {
    if (!empty($c['indices'])) return $c;
    $legados = $pdo->query('SELECT dados FROM kr_exercicios ORDER BY atualizado_em,id')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($legados as $json) {
      $e = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
      if (($e['condoId'] ?? '') === $c['id'] && !empty($e['consid']['indices'])) { $c['indices'] = $e['consid']['indices']; break; }
    }
    return $c; // leitura legada sem escrever no GET; Salvar migra para a tabela.
  }
  $st = $pdo->prepare('SELECT ano,indice FROM kr_indices_condominio WHERE condo_id = ? ORDER BY ano');
  $st->execute([$c['id']]);
  $visibilidade = [];
  foreach ($c['indices'] ?? [] as $i) $visibilidade[(int)($i['ano'] ?? 0)] = ($i['noRelatorio'] ?? true) !== false;
  $c['indices'] = array_map(static fn($r) => ['ano' => (int)$r['ano'], 'pct' => (float)$r['indice'], 'noRelatorio' => $visibilidade[(int)$r['ano']] ?? true], $st->fetchAll(PDO::FETCH_ASSOC));
  return $c;
}
