<?php
declare(strict_types=1);

// Confere as migrations dos modelos de ata prontos no MySQL efêmero do CI.
//
// Simula o caminho de atualização: aplica primeiro a migration antiga (só o Lago
// Negro), depois a nova duas vezes. Assim prova de uma vez a idempotência, a
// atualização de quem já tinha os dois modelos e o conjunto final de oito.

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

$raiz = dirname(__DIR__);
$antiga = (string) file_get_contents($raiz . '/migrations/20261110_modelos_ata_lago_negro.sql');
$nova = (string) file_get_contents($raiz . '/migrations/20261111_modelos_ata_por_cidade.sql');

// Instalação que já tinha só os dois modelos do Lago Negro.
$pdo->exec($antiga);
$antes = (int) $pdo->query('SELECT COUNT(*) FROM kr_modelos_ata')->fetchColumn();
$verificar($antes === 2, 'Esperava 2 modelos após a migration antiga, achei ' . $antes . '.');

// Atualização: aplicada duas vezes, não pode duplicar nem estragar os antigos.
$pdo->exec($nova);
$pdo->exec($nova);

$linhas = $pdo->query('SELECT id, dados FROM kr_modelos_ata ORDER BY id')->fetchAll();
$verificar(count($linhas) === 8, 'Esperava 8 modelos após aplicar a migration nova duas vezes, achei ' . count($linhas) . '.');

$porId = [];
foreach ($linhas as $linha) {
    $m = json_decode((string) $linha['dados'], true, 512, JSON_THROW_ON_ERROR);
    $verificar(($m['id'] ?? '') === $linha['id'], 'Id do JSON diverge da coluna para ' . $linha['id'] . '.');
    $verificar(($m['cartorio'] ?? null) === '', 'Cartório deveria estar vazio em ' . $linha['id'] . '.');
    $verificar(($m['ativo'] ?? false) === true, 'Modelo deveria estar ativo: ' . $linha['id'] . '.');
    $verificar(($m['logoEscritorio'] ?? true) === false, 'Modelo de ata não pode ter logo do escritório: ' . $linha['id'] . '.');
    $verificar(($m['bordaPagina'] ?? false) === true, 'Modelo de ata precisa de borda de página: ' . $linha['id'] . '.');
    $verificar(strlen((string) ($m['texto'] ?? '')) > 1000, 'Texto curto demais em ' . $linha['id'] . '.');
    $verificar(
        str_starts_with((string) ($m['texto'] ?? ''), '# ATA DA ASSEMBLEIA GERAL'),
        'Texto sem título em ' . $linha['id'] . '.'
    );
    $porId[$linha['id']] = $m;
}

foreach ([
    'mod-ata-balneario-camboriu-ordinaria' => ['Balneário Camboriú', 'ordinaria'],
    'mod-ata-balneario-camboriu-extraordinaria' => ['Balneário Camboriú', 'extraordinaria'],
    'mod-ata-camboriu-ordinaria' => ['Camboriú', 'ordinaria'],
    'mod-ata-camboriu-extraordinaria' => ['Camboriú', 'extraordinaria'],
    'mod-ata-itajai-ordinaria' => ['Itajaí', 'ordinaria'],
    'mod-ata-itajai-extraordinaria' => ['Itajaí', 'extraordinaria'],
    'mod-ata-lago-negro-ordinaria' => ['Rancho Queimado', 'ordinaria'],
    'mod-ata-lago-negro-extraordinaria' => ['Rancho Queimado', 'extraordinaria'],
] as $id => [$cidade, $tipo]) {
    $verificar(isset($porId[$id]), 'Modelo ausente: ' . $id . '.');
    $verificar(($porId[$id]['cidade'] ?? '') === $cidade, 'Cidade incorreta em ' . $id . '.');
    $verificar(($porId[$id]['tipo'] ?? '') === $tipo, 'Tipo incorreto em ' . $id . '.');
}

echo "Modelos de ata: migration antiga e nova aplicadas duas vezes sem duplicar; "
    . "oito modelos, cidade, tipo, borda e ausência de logo validados.\n";
