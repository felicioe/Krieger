<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** Confirmação atômica; o id do staging é a chave idempotente de uma tentativa. */
function confirmar_importacao(PDO $pdo, array $pedido): array {
  $id = static function ($valor): string {
    if (!is_string($valor) || trim($valor) === '' || strlen($valor) > 64) throw new InvalidArgumentException('Identificador inválido.');
    return $valor;
  };
  $importacaoId = $id($pedido['importacaoId'] ?? null);
  $destino = $pedido['destino'] ?? '';
  if (!in_array($destino, ['mensais', 'exercicios'], true)) throw new InvalidArgumentException('Destino inválido.');
  $condo = $pedido['condominio'] ?? null;
  $registro = $pedido['registro'] ?? null;
  $cadastro = $pedido['cadastro'] ?? null;
  if (!is_array($condo) || !is_array($registro) || !is_array($cadastro)) throw new InvalidArgumentException('Dados da confirmação incompletos.');
  $condoId = $id($condo['id'] ?? null);
  $registroId = $id($registro['id'] ?? null);
  if (($registro['condoId'] ?? null) !== $condoId) throw new InvalidArgumentException('Relatório e condomínio não correspondem.');
  foreach (['codigo', 'nome', 'cnpj'] as $campo) {
    if (!array_key_exists($campo, $cadastro) || ($cadastro[$campo] !== null && !is_string($cadastro[$campo]))) {
      throw new InvalidArgumentException('Cadastro de conferência inválido.');
    }
  }
  $ler = static function (string $tabela, string $chave, bool $bloquear = true) use ($pdo): ?array {
    $stmt = $pdo->prepare('SELECT dados FROM kr_' . $tabela . ' WHERE id = ?' . ($bloquear ? ' FOR UPDATE' : ''));
    $stmt->execute([$chave]);
    $dados = $stmt->fetchColumn();
    return $dados === false ? null : json_decode($dados, true, 512, JSON_THROW_ON_ERROR);
  };
  $gravar = static function (string $tabela, array $objeto, bool $novo) use ($pdo): array {
    $objeto['atualizadoEm'] = date('c');
    $json = json_encode($objeto, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if ($novo) {
      $stmt = $pdo->prepare('INSERT INTO kr_' . $tabela . ' (id, dados, atualizado_em) VALUES (?, ?, ?)');
      $stmt->execute([$objeto['id'], $json, date('Y-m-d H:i:s')]);
    } else {
      $stmt = $pdo->prepare('UPDATE kr_' . $tabela . ' SET dados = ?, atualizado_em = ? WHERE id = ?');
      $stmt->execute([$json, date('Y-m-d H:i:s'), $objeto['id']]);
    }
    return $objeto;
  };
  $pdo->beginTransaction();
  try {
    $imp = $ler('importacoes', $importacaoId);
    if (!$imp) throw new RuntimeException('Importação não encontrada.', 404);
    if (($imp['destino'] ?? 'mensais') !== $destino) throw new RuntimeException('Destino diferente da importação.', 409);
    if (($imp['status'] ?? '') === 'confirmado') {
      $salvo = $ler($destino, $id($imp['registroId'] ?? null));
      if (!$salvo) throw new RuntimeException('A confirmação anterior perdeu o relatório vinculado. Confira a importação.', 409);
      $pdo->commit();
      return ['registro' => $salvo, 'condominioId' => $id($imp['condominioId'] ?? $salvo['condoId'] ?? null), 'criouCondominio' => false, 'reutilizado' => true];
    }
    if (($imp['status'] ?? '') !== 'pendente') throw new RuntimeException('Esta importação não está pendente.', 409);
    // O lock do condomínio existente serializa confirmações concorrentes para o mesmo cadastro.
    $existente = $ler('condominios', $condoId);
    $criou = $existente === null;
    if ($criou && (!is_string($condo['nome'] ?? null) || trim($condo['nome']) === '')) throw new InvalidArgumentException('Informe o nome do condomínio.');
    // Nunca sobrescrever um relatório já existente por um id fornecido pelo cliente.
    if ($ler($destino, $registroId)) throw new RuntimeException('Identificador de relatório já utilizado.', 409);
    $linhas = $pdo->query('SELECT dados FROM kr_' . $destino)->fetchAll(PDO::FETCH_COLUMN);
    $periodo = static function (array $r): string {
      foreach (['fim', 'ini'] as $campo) {
        $data = trim((string)($r['demonstrativo']['periodo'][$campo] ?? ''));
        if (preg_match('/^(?:[0-9]{1,2}\/)?([0-9]{1,2})\/([0-9]{4})$/', $data, $m)
          && (int)$m[1] >= 1 && (int)$m[1] <= 12 && (int)$m[2] >= 1900 && (int)$m[2] <= 2999) {
          return sprintf('%02d/%s', (int)$m[1], $m[2]);
        }
      }
      return '';
    };
    if ($destino === 'exercicios' && (!preg_match('/^[0-9]{4}$/', (string)($registro['ano'] ?? '')) || (int)$registro['ano'] < 1900 || (int)$registro['ano'] > 2999)) throw new InvalidArgumentException('Ano do exercício inválido.');
    if ($destino === 'mensais' && !preg_match('/^(0[1-9]|1[0-2])\/[0-9]{4}$/', $periodo($registro))) throw new InvalidArgumentException('Competência mensal inválida.');
    foreach ($linhas as $json) {
      $outro = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
      if (($outro['condoId'] ?? '') !== $condoId) continue;
      $mesmo = $destino === 'exercicios' ? (string)($outro['ano'] ?? '') === (string)$registro['ano'] : $periodo($outro) === $periodo($registro);
      if ($mesmo) throw new RuntimeException('Já existe um relatório deste condomínio para o período.', 409);
    }
    if ($criou) $gravar('condominios', $condo, true);
    $salvo = $gravar($destino, $registro, true);
    $imp['status'] = 'confirmado';
    $imp['condominioId'] = $condoId;
    $imp['registroId'] = $registroId;
    $imp['cadastro'] = array_merge($imp['cadastro'] ?? [], $cadastro, ['revisar' => false]);
    $gravar('importacoes', $imp, false);
    $pdo->commit();
    return ['registro' => $salvo, 'condominioId' => $condoId, 'criouCondominio' => $criou, 'reutilizado' => false];
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

/** Impede que descarte/edição atrasados revertam uma confirmação concorrente. */
function salvar_staging_importacao(PDO $pdo, array $objeto): array {
  $id = $objeto['id'] ?? null;
  if (!is_string($id) || trim($id) === '' || strlen($id) > 64) throw new InvalidArgumentException('Identificador inválido.');
  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare('SELECT dados FROM kr_importacoes WHERE id = ? FOR UPDATE');
    $stmt->execute([$id]);
    $json = $stmt->fetchColumn();
    $existente = $json === false ? null : json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    if ($existente && ($existente['status'] ?? '') !== 'pendente') throw new RuntimeException('A importação já foi concluída. Atualize a página para conferir o resultado.', 409);
    if (!in_array($objeto['status'] ?? '', $existente ? ['pendente', 'descartado'] : ['pendente'], true)) {
      throw new RuntimeException('Use a confirmação integrada para concluir a importação.', 409);
    }
    $objeto['atualizadoEm'] = date('c');
    $stmt = $pdo->prepare('REPLACE INTO kr_importacoes (id, dados, atualizado_em) VALUES (?, ?, ?)');
    $stmt->execute([$id, json_encode($objeto, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), date('Y-m-d H:i:s')]);
    $pdo->commit();
    return $objeto;
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}
