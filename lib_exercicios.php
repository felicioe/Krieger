<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

require_once __DIR__ . '/lib_previsoes.php';

/** Leitura com lock usada dentro da mesma transação da escrita. */
function ler_registro_exercicio(PDO $pdo, string $store, string $id): ?array {
  // `historico_rateios` tem colunas normalizadas + espelho em `dados`; a leitura genérica
  // só decodificava o JSON e perdia os campos estruturados após upsert. Reconstruímos aqui
  // o objeto completo a partir das colunas, fundindo com o payload gravado em `dados`.
  if ($store === 'historico_rateios') {
    $st = $pdo->prepare('SELECT * FROM kr_historico_rateios WHERE id = ? FOR UPDATE');
    $st->execute([$id]);
    $row = $st->fetch();
    if ($row === false) return null;
    $dados = is_array($row['dados'] ?? null)
      ? $row['dados']
      : json_decode((string)($row['dados'] ?? '{}'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($dados)) $dados = [];
    return array_merge($dados, [
      'id' => (string)$row['id'],
      'condoId' => (string)$row['condo_id'],
      'ano' => (int)$row['ano'],
      'rateioAtual' => $row['rateio_atual'] !== null ? (float)$row['rateio_atual'] : null,
      'rateioSugerido' => $row['rateio_sugerido'] !== null ? (float)$row['rateio_sugerido'] : null,
      'variacao' => $row['variacao'] !== null ? (float)$row['variacao'] : null,
      'rateioAprovado' => (float)$row['rateio_aprovado'],
      'travadoEm' => (string)$row['travado_em'],
      'fonte' => $row['fonte'],
      'exercicioId' => $row['exercicio_id'],
    ]);
  }
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
/** Mês e ano de uma data dd/mm/aaaa ou mm/aaaa (como `mesAnoDe`, em domain/mensal.ts). */
function mes_ano_de_texto($texto): ?array {
  if (!preg_match('/^(?:[0-9]{1,2}\/)?([0-9]{1,2})\/([0-9]{4})$/', trim((string)$texto), $m)) return null;
  $mes = (int)$m[1];
  return $mes >= 1 && $mes <= 12 ? ['mes' => $mes, 'ano' => (int)$m[2]] : null;
}

/** Competência de um relatório mensal: mês da data final do período, ou da inicial (como `competenciaMensal`). */
function competencia_mensal_registro(array $mensal): ?array {
  $p = $mensal['demonstrativo']['periodo'] ?? [];
  return mes_ano_de_texto($p['fim'] ?? '') ?? mes_ano_de_texto($p['ini'] ?? '');
}

/**
 * Regra do responsável: mês de exercício fechado só muda depois de reabrir a prestação de contas.
 * Bloqueia relatório mensal cuja competência cai no período de um exercício FECHADO do mesmo condomínio
 * (vale para DRE mensal e Comparativo Financeiro, que geram um relatório por competência).
 */
function exigir_mes_fora_de_exercicio_fechado(PDO $pdo, ?array $mensal): void {
  if (!$mensal) return;
  $c = competencia_mensal_registro($mensal);
  if (!$c) return;
  $condoId = (string)($mensal['condoId'] ?? '');
  $chave = $c['ano'] * 100 + $c['mes'];
  foreach ($pdo->query('SELECT dados FROM kr_exercicios FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN) as $json) {
    $e = json_decode((string)$json, true, 512, JSON_THROW_ON_ERROR);
    if (empty($e['fechado']) || ($e['condoId'] ?? '') !== $condoId) continue;
    $ini = mes_ano_de_texto($e['demonstrativo']['periodo']['ini'] ?? '');
    $fim = mes_ano_de_texto($e['demonstrativo']['periodo']['fim'] ?? '');
    if (!$ini || !$fim) continue;
    if ($chave >= $ini['ano'] * 100 + $ini['mes'] && $chave <= $fim['ano'] * 100 + $fim['mes']) {
      throw new RuntimeException(sprintf('O mês %02d/%d pertence ao exercício %s, que está fechado. Reabra a prestação de contas para alterar este mês.', $c['mes'], $c['ano'], (string)($e['ano'] ?? '')), 409);
    }
  }
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
    // Confirmação repetida devolve o fechamento existente, sem refazer nem duplicar nada.
    if ($fechar && !empty($e['fechado'])) { $pdo->commit(); return $e; }
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
      $proximoFechado = false;
      foreach ($pdo->query('SELECT dados FROM kr_exercicios FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $outro = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (($outro['condoId'] ?? '') !== $e['condoId']) continue;
        if ((int)($outro['ano'] ?? 0) === (int)$e['ano'] - 1) $anterior = $outro;
        if ((int)($outro['ano'] ?? 0) === (int)$e['ano'] + 1 && !empty($outro['fechado'])) $proximoFechado = true;
      }
      inicializar_indices_importados($pdo, $e);
      // Previsto aprovado de N+1: realizado de N × (1 + % do histórico de rateios). Sem percentual (ou
      // sem a tabela) o fechamento não conclui; o que foi gravado antes volta atrás no rollback.
      $anoN = (int)$e['ano'];
      $calculoProximo = null;
      $percentualProximo = null;
      if (previsao_tem_despesas($e['demonstrativo'])) {
        if (!previsao_tabela_existe($pdo)) throw new RuntimeException('Aplique a migration 20261121_previsoes_aprovadas.sql antes de fechar exercícios.', 409);
        $percentualProximo = previsao_percentual_historico($pdo, (string)$e['condoId'], $anoN);
        if ($percentualProximo === null) throw new RuntimeException('Percentual aprovado não encontrado no histórico de rateios de ' . $anoN . '. Trave o rateio na previsão orçamentária antes de fechar o exercício.', 409);
        $calculoProximo = previsao_calcular($e['demonstrativo'], $percentualProximo, $c['mapeamento'] ?? []);
        $existenteProximo = ler_previsao_aprovada($pdo, (string)$e['condoId'], $anoN + 1, true);
        $igual = $existenteProximo && abs($existenteProximo['percentualAprovado'] - $percentualProximo) < 0.0001 && abs($existenteProximo['totalPrevisto'] - $calculoProximo['totalPrevisto']) < 0.005;
        if ($proximoFechado && !$igual) throw new RuntimeException('Reabra o exercício ' . ($anoN + 1) . ' antes de fechar o ' . $anoN . ': o previsto dele seria substituído.', 409);
        if (!$igual) gravar_previsao_aprovada($pdo, (string)$e['condoId'], $anoN + 1, (string)$e['id'], $percentualProximo, $calculoProximo, 'aprovacao', (string)$usuario['id']);
      }
      $congelado = previsao_tabela_existe($pdo) ? ler_previsao_aprovada($pdo, (string)$e['condoId'], $anoN) : null;
      $e['fechamento'] = [
        'versao' => 1, 'fechadoEm' => date('c'), 'fechadoPor' => (string)$usuario['id'],
        'condominio' => $c, 'mensais' => $mensais,
        'exercicioAnterior' => $anterior ? ['demonstrativo' => $anterior['demonstrativo'] ?? null] : null,
        'escritorio' => ler_registro_exercicio($pdo, 'config', 'escritorio'),
        // Previsto aprovado que este exercício usa no comparativo, congelado para reproduzi-lo depois.
        'previstoAprovado' => $congelado,
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
