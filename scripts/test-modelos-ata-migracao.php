<?php
declare(strict_types=1);

// Confere a migration dos modelos de ata prontos no MySQL efêmero do CI:
// cria a tabela, aplica duas vezes (idempotência) e valida o conteúdo gravado.

$dsn = getenv('KRIEGER_TEST_DSN') ?: '';
if ($dsn !== 'mysql:host=127.0.0.1;port=3306;dbname=krieger_test;charset=utf8mb4') {
    throw new RuntimeException('Use apenas o banco efêmero do CI.');
}
$pdo = new PDO($dsn, 'root', getenv('KRIEGER_TEST_PASSWORD') ?: '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$verificar = static function (bool $ok, string $msg): void {
    if (!$ok) throw new RuntimeException($msg);
};

$sql = file_get_contents(dirname(__DIR__) . '/migrations/20261110_modelos_ata_lago_negro.sql');
$pdo->exec($sql);
$pdo->exec($sql);

$linhas = $pdo->query('SELECT id, dados FROM kr_modelos_ata ORDER BY id')->fetchAll();
$verificar(count($linhas) === 2, 'Esperava 2 modelos após aplicar a migration duas vezes.');

$ids = array_column($linhas, 'id');
$verificar($ids === ['mod-ata-lago-negro-extraordinaria', 'mod-ata-lago-negro-ordinaria'], 'Ids inesperados: ' . implode(', ', $ids));

foreach ($linhas as $linha) {
    $m = json_decode((string) $linha['dados'], true, 512, JSON_THROW_ON_ERROR);
    $verificar(($m['id'] ?? '') === $linha['id'], 'Id do JSON diverge da coluna para ' . $linha['id'] . '.');
    $verificar(($m['cidade'] ?? '') === 'Rancho Queimado', 'Cidade incorreta em ' . $linha['id'] . '.');
    $verificar(($m['cartorio'] ?? null) === '', 'Cartório deveria estar vazio em ' . $linha['id'] . '.');
    $verificar(($m['ativo'] ?? false) === true, 'Modelo deveria estar ativo: ' . $linha['id'] . '.');
    $verificar(strlen((string) ($m['texto'] ?? '')) > 1000, 'Texto curto demais em ' . $linha['id'] . '.');
    $verificar(str_starts_with((string) ($m['texto'] ?? ''), '# ATA DA ASSEMBLEIA GERAL'), 'Texto sem título em ' . $linha['id'] . '.');
}

$porId = [];
foreach ($linhas as $linha) {
    $porId[$linha['id']] = json_decode((string) $linha['dados'], true, 512, JSON_THROW_ON_ERROR);
}
$verificar(($porId['mod-ata-lago-negro-ordinaria']['tipo'] ?? '') === 'ordinaria', 'Tipo da ordinária incorreto.');
$verificar(($porId['mod-ata-lago-negro-extraordinaria']['tipo'] ?? '') === 'extraordinaria', 'Tipo da extraordinária incorreto.');

echo "Modelos de ata: migration aplicada duas vezes sem duplicar; conteúdo e tipo validados.\n";
