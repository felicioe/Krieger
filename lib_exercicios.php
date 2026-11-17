<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** Leitura com lock usada dentro da mesma transação da escrita. */
function ler_registro_exercicio(PDO $pdo, string $store, string $id): ?array {
  $st = $pdo->prepare('SELECT dados FROM kr_' . $store . ' WHERE id = ? FOR UPDATE');
  $st->execute([$id]);
  $json = $st->fetchColumn();
  return $json === false ? null : json_decode($json, true, 512, JSON_THROW_ON_ERROR);
}
function gravar_registro_exercicio(PDO $pdo, string $store, array $o): array {
  $o['atualizadoEm'] = (new DateTimeImmutable())->format('Y-m-d\TH:i:s.uP');
  $json = json_encode($o, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

  // `historico_rateios` foi criado com colunas normalizadas (e `dados` apenas para o
  // espelho do objeto), diferente dos stores legados que têm só id/dados/atualizado_em.
  // O INSERT genérico tentava gravar em uma coluna `atualizado_em` inexistente e causava
  // "Erro interno" depois de salvar o exercício. Mantemos o upsert pela chave natural
  // condomínio/ano para não duplicar histórico nem substituir outra linha do condomínio.
  if ($store === 'historico_rateios') {
    $travadoEm = new DateTimeImmutable((string)($o['travadoEm'] ?? 'now'));
    $st = $pdo->prepare(
      'INSERT INTO kr_historico_rateios
        (id, condo_id, ano, rateio_atual, rateio_sugerido, variacao, rateio_aprovado,
         travado_em, fonte, exercicio_id, dados)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         id = VALUES(id), rateio_atual = VALUES(rateio_atual),
         rateio_sugerido = VALUES(rateio_sugerido), variacao = VALUES(variacao),
         rateio_aprovado = VALUES(rateio_aprovado), travado_em = VALUES(travado_em),
         fonte = VALUES(fonte), exercicio_id = VALUES(exercicio_id), dados = VALUES(dados)'
    );
    $st->execute([
      $o['id'],
      $o['condoId'] ?? '',
      (int)($o['ano'] ?? 0),
      $o['rateioAtual'] ?? null,
      $o['rateioSugerido'] ?? null,
      $o['variacao'] ?? null,
      $o['rateioAprovado'] ?? 0,
      $travadoEm->format('Y-m-d H:i:s'),
      $o['fonte'] ?? null,
      $o['exercicioId'] ?? null,
      $json,
    ]);
    return $o;
  }

  $st = $pdo->prepare('REPLACE INTO kr_' . $store . ' (id,dados,atualizado_em) VALUES (?,?,?)');
  $st->execute([$o['id'], $json, date('Y-m-d H:i:s')]);
  return $o;
}
function validar_edicao_exercicio(?array $anterior, array $novo): void {
  if (!empty($anterior['fechado'])) throw new RuntimeException('Exercício fechado. Reabra pela prestação de contas antes de editar ou importar.', 409);
  if (!empty($novo['fechado']) || isset($novo['fechamento'])) throw new RuntimeException('Use o botão Fechar exercício para consolidar os dados.', 409);
}
function exigir_exercicios_abertos(PDO $pdo, ?string $condoId = null): void {
  foreach ($pdo->query('SELECT dados FROM kr_exercicios FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN) as $json) {
    $e = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    if (!empty($e['fechado']) && ($condoId === null || ($e['condoId'] ?? '') === $condoId)) {
      throw new RuntimeException('Há exercício fechado. Reabra explicitamente antes de excluir o condomínio, limpar ou restaurar dados.', 409);
    }
  }
}
/** O cliente não fornece snapshot, usuário nem data: são capturados do banco pelo servidor. */
function alterar_fechamento_exercicio(PDO $pdo, string $id, bool $fechar, array $usuario, string $motivo = '', ?string $versao = null): array {
  if (!$fechar && trim($motivo) === '') throw new InvalidArgumentException('Informe o motivo da reabertura.');
  $pdo->beginTransaction();
  try {
    $e = ler_registro_exercicio($pdo, 'exercicios', $id);
    if (!$e) throw new RuntimeException('Prestação de contas não encontrada.', 409);
    if ($versao !== ($e['atualizadoEm'] ?? null)) throw new RuntimeException('A prestação foi alterada por outra pessoa. Atualize a página antes de fechar ou reabrir.', 409);
    if ((!empty($e['fechado'])) === $fechar) throw new RuntimeException($fechar ? 'Exercício já fechado.' : 'Exercício já aberto.', 409);
    if ($fechar) {
      if (!is_array($e['demonstrativo'] ?? null)) throw new InvalidArgumentException('Informe o demonstrativo antes de fechar.');
      $c = ler_registro_exercicio($pdo, 'condominios', (string)$e['condoId']);
      if (!$c) throw new InvalidArgumentException('Condomínio não encontrado.');
      $mensais = [];
      foreach ($pdo->query('SELECT dados FROM kr_mensais FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $m = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (($m['condoId'] ?? '') === $e['condoId']) $mensais[] = $m;
      }
      $anterior = null;
      foreach ($pdo->query('SELECT dados FROM kr_exercicios FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $outro = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (($outro['condoId'] ?? '') === $e['condoId'] && (int)($outro['ano'] ?? 0) === (int)$e['ano'] - 1) $anterior = $outro;
      }
      inicializar_indices_importados($pdo, $e);
      $e['fechamento'] = [
        'versao' => 1, 'fechadoEm' => date('c'), 'fechadoPor' => (string)$usuario['id'],
        'condominio' => $c, 'mensais' => $mensais,
        'exercicioAnterior' => $anterior ? ['demonstrativo' => $anterior['demonstrativo'] ?? null] : null,
        'escritorio' => ler_registro_exercicio($pdo, 'config', 'escritorio'),
      ];
    } else {
      unset($e['fechamento']);
    }
    $e['fechado'] = $fechar;
    $e['historicoFechamento'][] = ['acao' => $fechar ? 'fechar' : 'reabrir', 'em' => date('c'), 'por' => (string)$usuario['id'], 'motivo' => trim($motivo)];
    $salvo = gravar_registro_exercicio($pdo, 'exercicios', $e);
    $pdo->commit();
    return $salvo;
  } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
