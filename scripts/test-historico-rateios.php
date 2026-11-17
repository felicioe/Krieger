<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib_exercicios.php';
// Somente o serviço efêmero do CI; nunca apontar este script para produção.
$dsn = getenv('KRIEGER_TEST_DSN') ?: '';
if ($dsn !== 'mysql:host=127.0.0.1;port=3306;dbname=krieger_test;charset=utf8mb4') throw new RuntimeException('Use apenas o banco efêmero do CI.');
$pdo = new PDO($dsn, 'root', getenv('KRIEGER_TEST_PASSWORD') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec((string)file_get_contents(dirname(__DIR__) . '/migrations/20261116_historico_rateios.sql'));
$pdo->exec('DELETE FROM kr_historico_rateios');
$verificar = static function (bool $ok, string $msg): void { if (!$ok) throw new RuntimeException($msg); };

// 1. Primeiro travamento grava todas as colunas e o JSON espelho.
$linha1 = [
  'id' => 'hist-1',
  'condoId' => 'condo-a',
  'condoNome' => 'Condomínio A',
  'ano' => 2025,
  'rateioAtual' => 300.0,
  'rateioSugerido' => 369.71,
  'variacao' => 23.237,
  'rateioAprovado' => 369.71,
  'travadoEm' => '2026-11-17T10:00:00.000Z',
  'fonte' => 'calculo',
  'exercicioId' => 'ex-2025',
];
$salvo = gravar_registro_exercicio($pdo, 'historico_rateios', $linha1);
$verificar($salvo['atualizadoEm'] !== '', 'atualizadoEm não preenchido.');
$r = $pdo->query("SELECT * FROM kr_historico_rateios WHERE id = 'hist-1'")->fetch();
$verificar($r !== false, 'Linha não gravada.');
$verificar((float)$r['rateio_aprovado'] === 369.71, 'rateio_aprovado incorreto.');
$verificar((float)$r['rateio_atual'] === 300.0, 'rateio_atual incorreto.');
$verificar((int)$r['ano'] === 2025, 'ano incorreto.');
$verificar($r['fonte'] === 'calculo', 'fonte incorreta.');
$verificar($r['travado_em'] === '2026-11-17 10:00:00', 'travado_em não convertido de ISO para DATETIME.');
$espelho = json_decode((string)$r['dados'], true, 512, JSON_THROW_ON_ERROR);
$verificar($espelho['condoId'] === 'condo-a' && $espelho['condoNome'] === 'Condomínio A', 'JSON espelho incompleto.');

// 2. Retravar o mesmo condo/ano com OUTRO id atualiza a linha existente (chave única), não duplica.
$linha2 = array_merge($linha1, ['id' => 'hist-2', 'rateioAprovado' => 400.0, 'rateioSugerido' => 400.0, 'variacao' => 33.333, 'fonte' => 'importacao']);
gravar_registro_exercicio($pdo, 'historico_rateios', $linha2);
$verificar((int)$pdo->query("SELECT COUNT(*) FROM kr_historico_rateios WHERE condo_id = 'condo-a'")->fetchColumn() === 1, 'Upsert duplicou linha (deveria atualizar pela chave condo/ano).');
$r2 = $pdo->query("SELECT * FROM kr_historico_rateios WHERE condo_id = 'condo-a'")->fetch();
$verificar($r2['id'] === 'hist-2', 'Upsert não assumiu o id novo.');
$verificar((float)$r2['rateio_aprovado'] === 400.0, 'Upsert não atualizou o aprovado.');
$verificar($r2['fonte'] === 'importacao', 'Upsert não atualizou a fonte.');

// 3. Outro condomínio no mesmo ano continua linha própria.
$linha3 = array_merge($linha1, ['id' => 'hist-3', 'condoId' => 'condo-b', 'ano' => 2025]);
gravar_registro_exercicio($pdo, 'historico_rateios', $linha3);
$verificar((int)$pdo->query('SELECT COUNT(*) FROM kr_historico_rateios')->fetchColumn() === 2, 'Condomínios distintos compartilharam linha.');

// 4. Leitura genérica (listar/obter) segue funcionando: decodifica `dados`.
$viaListar = json_decode((string)$pdo->query("SELECT dados FROM kr_historico_rateios WHERE id = 'hist-2'")->fetchColumn(), true, 512, JSON_THROW_ON_ERROR);
$verificar($viaListar['rateioAprovado'] === 400.0, 'Leitura pelo JSON não reflete o upsert.');

// 5. Stores legados continuam pelo caminho REPLACE (id/dados/atualizado_em).
$pdo->exec('CREATE TABLE IF NOT EXISTS kr_decisoes_previsao (id VARCHAR(64) PRIMARY KEY, dados JSON NULL, atualizado_em DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
gravar_registro_exercicio($pdo, 'decisoes_previsao', ['id' => 'd1', 'status' => 'ok']);
$r5 = $pdo->query("SELECT * FROM kr_decisoes_previsao WHERE id = 'd1'")->fetch();
$verificar($r5 !== false && $r5['atualizado_em'] !== null, 'Caminho legado quebrou.');

$pdo->exec('DELETE FROM kr_historico_rateios');
$pdo->exec("DELETE FROM kr_decisoes_previsao WHERE id = 'd1'");
echo "Histórico de rateios: upsert por condo/ano, JSON espelho, ISO→DATETIME, leitura e caminho legado validados.\n";
