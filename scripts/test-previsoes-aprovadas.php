<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib_exercicios.php';
require dirname(__DIR__) . '/lib_previsoes.php';
$assert = static function (bool $ok, string $msg): void { if (!$ok) throw new RuntimeException($msg); };
$igual = static fn($a, $b): bool => abs((float)$a - (float)$b) < 0.0001;

// 1. Paridade com o domínio TypeScript: mesmas fixtures de domain/previstoAprovado.test.ts.
$casos = json_decode((string)file_get_contents(dirname(__DIR__) . '/domain/fixtures/previsto-aprovado.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($casos as $c) {
  $r = previsao_calcular(['despesas' => ['grupos' => $c['grupos']]], (float)$c['percentual'], $c['mapeamento']);
  $assert($igual($r['totalPrevisto'], $c['esperado']['totalPrevisto']), 'Total divergente do domínio: ' . $c['nome']);
  $assert(count($r['grupos']) === count($c['esperado']['grupos']), 'Quantidade de grupos divergente: ' . $c['nome']);
  foreach ($r['grupos'] as $i => $g) {
    $e = $c['esperado']['grupos'][$i];
    $assert($g['nome'] === $e['nome'] && $g['chave'] === $e['chave'] && $igual($g['totalPrevisto'], $e['totalPrevisto']), 'Grupo divergente: ' . $c['nome'] . ' / ' . $g['nome']);
    $assert(count($g['contas']) === count($e['contas']), 'Contas divergentes: ' . $c['nome']);
    foreach ($g['contas'] as $j => $conta) {
      $ec = $e['contas'][$j];
      $assert($conta['nome'] === $ec['nome'] && $conta['chave'] === $ec['chave'] && $igual($conta['previsto'], $ec['previsto']) && $igual($conta['realizadoOrigem'], $ec['realizadoOrigem']), 'Conta divergente: ' . $c['nome'] . ' / ' . $conta['nome']);
    }
  }
}
$assert(previsao_chave("  ÁGUA   e  Gás ") === 'agua e gas', 'Chave normalizada incorreta.');

// 2. Banco efêmero do CI.
$dsn = getenv('KRIEGER_TEST_DSN') ?: '';
if ($dsn !== 'mysql:host=127.0.0.1;port=3306;dbname=krieger_test;charset=utf8mb4') throw new RuntimeException('Use apenas o banco efêmero do CI.');
$pdo = new PDO($dsn, 'root', getenv('KRIEGER_TEST_PASSWORD') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
foreach (['condominios', 'exercicios', 'mensais', 'config'] as $t) $pdo->exec("CREATE TABLE IF NOT EXISTS kr_$t (id VARCHAR(64) PRIMARY KEY, dados LONGTEXT NOT NULL, atualizado_em DATETIME NOT NULL) ENGINE=InnoDB");
foreach (['kr_condominios', 'kr_exercicios', 'kr_mensais'] as $t) $pdo->exec("DELETE FROM $t");
$pdo->exec((string)file_get_contents(dirname(__DIR__) . '/migrations/20261116_historico_rateios.sql'));
$pdo->exec('DELETE FROM kr_historico_rateios');

// 2a. Sem a tabela (migration pendente): leitura devolve lista vazia e a carga não é aplicada.
$pdo->exec('DROP TABLE IF EXISTS kr_previsoes_aprovadas');
$assert(listar_previsoes_aprovadas($pdo) === [], 'Leitura sem tabela deveria devolver lista vazia.');
$assert(previsao_tabela_existe($pdo) === false, 'Detecção de tabela ausente falhou.');
try { previsoes_carga_inicial($pdo, true, 'adm'); $assert(false, 'Carga sem tabela deveria ser recusada.'); } catch (RuntimeException $e) { $assert($e->getCode() === 409, 'Carga sem tabela deveria dar 409.'); }
$pdo->exec((string)file_get_contents(dirname(__DIR__) . '/migrations/20261121_previsoes_aprovadas.sql'));
$assert(previsao_tabela_existe($pdo) === true, 'Migration não criou a tabela.');
$pdo->exec('DELETE FROM kr_previsoes_aprovadas');

// 2b. Gravação, versão e substituição.
$base = ['despesas' => ['grupos' => [['nome' => 'Pessoal', 'itens' => [['nome' => 'Salários', 'valor' => 120000]]]]]];
$calc = previsao_calcular($base, 10.0);
$assert($igual($calc['totalPrevisto'], 132000), 'Exemplo da especificação: 120.000 com 10% deve gerar 132.000.');
$pdo->beginTransaction();
$v1 = gravar_previsao_aprovada($pdo, 'condo-1', 2026, 'ex-2025', 10.0, $calc, 'aprovacao', 'usuario-1');
$pdo->commit();
$assert($v1['versao'] === 1 && $igual($v1['totalPrevisto'], 132000) && $v1['anterior'] === null, 'Primeira versão incorreta.');
$assert($v1['grupos'][0]['contas'][0]['chave'] === 'salarios', 'Chave da conta não preservada.');
$pdo->beginTransaction();
$v2 = gravar_previsao_aprovada($pdo, 'condo-1', 2026, 'ex-2025', 5.0, previsao_calcular($base, 5.0), 'aprovacao', 'usuario-2');
$pdo->commit();
$assert($v2['versao'] === 2 && $igual($v2['totalPrevisto'], 126000), 'Substituição não gerou a versão 2.');
$assert($v2['anterior'] !== null && $v2['anterior']['versao'] === 1 && $igual($v2['anterior']['totalPrevisto'], 132000), 'Resumo da versão anterior perdido.');
$assert((int)$pdo->query("SELECT COUNT(*) FROM kr_previsoes_aprovadas WHERE condo_id = 'condo-1'")->fetchColumn() === 1, 'Substituição duplicou o previsto.');
$pdo->beginTransaction();
gravar_previsao_aprovada($pdo, 'condo-1', 2026, 'ex-2025', 1.0, previsao_calcular($base, 1.0), 'aprovacao', 'usuario-3');
$pdo->rollBack();
$assert($igual(ler_previsao_aprovada($pdo, 'condo-1', 2026)['totalPrevisto'], 126000), 'Rollback deixou a gravação pela metade.');
$assert(count(listar_previsoes_aprovadas($pdo)) === 1, 'Listagem incorreta.');

// 2c. Percentual do histórico: variação gravada, recalculada pelos rateios e ausente; 0% é válido.
$hist = static function (string $id, string $condo, int $ano, ?float $var, ?float $atual, ?float $sug, float $aprovado) use ($pdo): void {
  $pdo->prepare('INSERT INTO kr_historico_rateios (id, condo_id, ano, rateio_atual, rateio_sugerido, variacao, rateio_aprovado, travado_em, fonte, exercicio_id, dados) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      ->execute([$id, $condo, $ano, $atual, $sug, $var, $aprovado, '2026-01-01 00:00:00', 'calculo', null, '{}']);
};
$hist('h1', 'condo-a', 2025, 10.0, null, null, 100);
$hist('h2', 'condo-b', 2025, null, 321.0, null, 370.0);
$hist('h3', 'condo-c', 2025, null, null, null, 370.0);
$hist('h4', 'condo-d', 2025, 0.0, null, null, 100);
$assert($igual(previsao_percentual_historico($pdo, 'condo-a', 2025), 10.0), 'Variação gravada não lida.');
$assert($igual(previsao_percentual_historico($pdo, 'condo-b', 2025), 15.26), 'Recálculo 321 → 370 deveria dar 15,26%.');
$assert(previsao_percentual_historico($pdo, 'condo-c', 2025) === null, 'Sem base e sem variação o percentual deveria ser nulo.');
$assert(previsao_percentual_historico($pdo, 'condo-x', 2025) === null, 'Sem linha de histórico o percentual deveria ser nulo.');
$assert(previsao_percentual_historico($pdo, 'condo-d', 2025) !== null && $igual(previsao_percentual_historico($pdo, 'condo-d', 2025), 0.0), '0% deveria ser válido.');

// 2d. Carga inicial: simular não grava; aplicar grava só o pronto, sem tocar exercícios nem repetir.
$dem = static fn(float $v): array => ['periodo' => ['ini' => '01/01/2025', 'fim' => '31/12/2025'], 'despesas' => ['grupos' => [['nome' => 'Pessoal', 'itens' => [['nome' => 'Salários', 'valor' => $v]]]]]];
$exe = static function (string $id, string $condo, int $ano, ?array $demonstrativo, bool $fechado = false) use ($pdo): void {
  $o = ['id' => $id, 'condoId' => $condo, 'condoNome' => 'Cond ' . $condo, 'ano' => $ano, 'demonstrativo' => $demonstrativo, 'fechado' => $fechado, 'atualizadoEm' => 'v0'];
  gravar_registro_exercicio($pdo, 'exercicios', $o);
};
foreach (['condo-a', 'condo-b', 'condo-c', 'condo-d', 'condo-e'] as $cid) gravar_registro_exercicio($pdo, 'condominios', ['id' => $cid, 'nome' => $cid, 'mapeamento' => []]);
$exe('ea', 'condo-a', 2025, $dem(1000));          // pronto (10%)
$exe('eb', 'condo-b', 2025, $dem(851955.11));     // pronto (15,26%)
$exe('ec', 'condo-c', 2025, $dem(500));           // sem percentual
$exe('ed', 'condo-d', 2025, $dem(800));           // pronto com 0%
$exe('ee', 'condo-e', 2025, null);                // sem demonstrativo
$exe('ea26', 'condo-a', 2026, $dem(1), true);     // destino de condo-a já fechado
$antes = (string)$pdo->query("SELECT dados FROM kr_exercicios WHERE id = 'ea26'")->fetchColumn();
$sim = previsoes_carga_inicial($pdo, false, 'adm');
$assert($sim['aplicado'] === false && $sim['gravados'] === 0, 'Simulação não deveria gravar.');
$assert((int)$pdo->query("SELECT COUNT(*) FROM kr_previsoes_aprovadas WHERE condo_id <> 'condo-1'")->fetchColumn() === 0, 'Simulação gravou linhas.');
$por = [];
foreach ($sim['linhas'] as $l) $por[$l['exercicioBaseId']] = $l;
$assert($por['ea']['status'] === 'pronto' && $igual($por['ea']['totalPrevisto'], 1100) && $por['ea']['destinoFechado'] === true, 'condo-a deveria estar pronto (destino fechado sinalizado).');
$assert($por['eb']['status'] === 'pronto' && $igual($por['eb']['totalPrevisto'], 981963.46), 'condo-b: 851.955,11 × 1,1526 deveria ser 981.963,46.');
$assert($por['ec']['status'] === 'pendente' && str_contains($por['ec']['motivo'], 'histórico de rateios'), 'condo-c deveria ficar pendente sem percentual.');
$assert($por['ed']['status'] === 'pronto' && $igual($por['ed']['totalPrevisto'], 800), 'condo-d com 0% deveria ficar pronto.');
$assert($por['ee']['status'] === 'pendente', 'condo-e sem demonstrativo deveria ficar pendente.');
$ap = previsoes_carga_inicial($pdo, true, 'adm');
$assert($ap['gravados'] === 3, 'Carga deveria gravar 3 previstos.');
$p = ler_previsao_aprovada($pdo, 'condo-a', 2026);
$assert($p && $p['origem'] === 'carga_inicial' && $p['aprovadoPor'] === 'adm' && $p['exercicioBaseId'] === 'ea', 'Origem da carga não registrada.');
$assert((string)$pdo->query("SELECT dados FROM kr_exercicios WHERE id = 'ea26'")->fetchColumn() === $antes, 'A carga alterou um exercício fechado.');
$de = previsoes_carga_inicial($pdo, true, 'adm');
$assert($de['gravados'] === 0, 'Segunda carga duplicou ou substituiu previstos.');
foreach ($de['linhas'] as $l) if ($l['exercicioBaseId'] === 'ea') $assert($l['status'] === 'ja_existe', 'Segunda carga deveria marcar ja_existe.');
echo "Previsto aprovado: paridade com o domínio, gravação versionada, rollback, percentual do histórico e carga inicial (simulação, aplicação e idempotência) validados.\n";
