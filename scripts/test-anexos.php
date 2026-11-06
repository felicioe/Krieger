<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib_anexos.php';
// Integração somente no MySQL efêmero do CI; nunca apontar para produção.
$dsn = getenv('KRIEGER_TEST_DSN') ?: '';
if ($dsn !== 'mysql:host=127.0.0.1;port=3306;dbname=krieger_test;charset=utf8mb4') throw new RuntimeException('DSN deve apontar ao banco efêmero krieger_test em loopback.');
$pdo = new PDO($dsn, 'root', getenv('KRIEGER_TEST_PASSWORD') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE IF NOT EXISTS kr_anexos_importacao (id VARCHAR(64) PRIMARY KEY, dados LONGTEXT NOT NULL, atualizado_em DATETIME NOT NULL) ENGINE=InnoDB');
$assert = static function (bool $ok, string $mensagem): void { if (!$ok) throw new RuntimeException($mensagem); };
$pdo->beginTransaction();
try {
  $inserir = static function (string $id, string $exercicio, string $arquivo) use ($pdo): void {
    $stmt = $pdo->prepare('INSERT INTO kr_anexos_importacao VALUES (?, ?, NOW())');
    $stmt->execute([$id, json_encode(['id' => $id, 'exercicioId' => $exercicio, 'arquivo' => 'Fictício & teste.pdf', 'arquivoDataUrl' => $arquivo, 'relatorio' => ['layout' => 'comparativo']], JSON_UNESCAPED_UNICODE)]);
  };
  $inserir('auditoria-anexo-1', 'auditoria-exercicio-a', 'data:application/pdf;base64,AQ==');
  $inserir('auditoria-anexo-2', 'auditoria-exercicio-a', 'data:application/pdf;base64,AQI=');
  $inserir('auditoria-anexo-3', 'auditoria-exercicio-a', 'data:application/pdf;base64,AQID');
  $inserir('auditoria-anexo-vazio', 'auditoria-exercicio-a', '');
  $inserir('auditoria-anexo-grande', 'auditoria-exercicio-b', 'data:application/pdf;base64,' . str_repeat('AAAA', 262144));
  $lista = listar_metadados_anexos($pdo, 'auditoria-exercicio-a');
  $assert(count($lista) === 4, 'Listagem deve filtrar o exercício no banco.');
  $porId = array_column($lista, null, 'id');
  foreach ($lista as $anexo) {
    $assert(!array_key_exists('arquivoDataUrl', $anexo), 'Metadados não podem conter o PDF.');
    $assert($anexo['arquivo'] === 'Fictício & teste.pdf', 'Metadados devem preservar nome e acentos.');
  }
  foreach ([1, 2, 3] as $bytes) {
    $anexo = $porId['auditoria-anexo-' . $bytes];
    $assert($anexo['arquivoBytes'] === $bytes && $anexo['temArquivo'] === true, 'Tamanho base64 ou sinalização incorretos.');
  }
  $assert($porId['auditoria-anexo-vazio']['arquivoBytes'] === 0 && !$porId['auditoria-anexo-vazio']['temArquivo'], 'Arquivo ausente deve permanecer identificável.');
  $grande = listar_metadados_anexos($pdo, 'auditoria-exercicio-b');
  $assert($grande[0]['arquivoBytes'] === 786432 && strlen(json_encode($grande)) < 1024, 'Resposta de metadados não deve crescer com o PDF.');
  $assert(listar_metadados_anexos($pdo, "' OR 1=1 --") === [], 'Filtro deve usar parâmetro SQL.');
  $assert(listar_metadados_anexos($pdo, 'auditoria-exercicio-inexistente') === [], 'Exercício sem anexos deve produzir lista vazia.');
  $stmt = $pdo->prepare('SELECT dados FROM kr_anexos_importacao WHERE id = ?');
  $stmt->execute(['auditoria-anexo-grande']);
  $assert(strlen(json_decode($stmt->fetchColumn(), true)['arquivoDataUrl']) > 1000000, 'Projeção de leitura não pode alterar o arquivo armazenado.');
  echo "Metadados de anexos: filtro, tamanho, ausência do PDF e preservação do original aprovados.\n";
} finally {
  $pdo->rollBack();
}
