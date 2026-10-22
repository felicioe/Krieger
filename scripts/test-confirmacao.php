<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib_importacao.php';
// Somente o serviço efêmero do CI; nunca apontar este script para produção.
$dsn = getenv('KRIEGER_TEST_DSN') ?: '';
if ($dsn !== 'mysql:host=127.0.0.1;port=3306;dbname=krieger_test;charset=utf8mb4') throw new RuntimeException('DSN deve apontar ao banco efêmero krieger_test em loopback.');
$pdo = new PDO($dsn, 'root', getenv('KRIEGER_TEST_PASSWORD') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
foreach (['condominios','mensais','exercicios','importacoes'] as $t) {
  $pdo->exec("CREATE TABLE kr_$t (id VARCHAR(64) PRIMARY KEY, dados LONGTEXT NOT NULL, atualizado_em DATETIME NOT NULL) ENGINE=InnoDB");
}
$assert = static function (bool $ok, string $mensagem): void { if (!$ok) throw new RuntimeException($mensagem); };
$semente = static function (string $id, string $status = 'pendente', string $destino = 'mensais') use ($pdo): void {
  $stmt = $pdo->prepare('INSERT INTO kr_importacoes VALUES (?, ?, NOW())');
  $stmt->execute([$id, json_encode(['id'=>$id,'destino'=>$destino,'status'=>$status,'cadastro'=>[]])]);
};
$pedido = static fn(string $id): array => [
 'importacaoId'=>$id,'destino'=>'mensais',
 'condominio'=>['id'=>'c-'.$id,'nome'=>'Condomínio fictício'],
 'registro'=>['id'=>'r-'.$id,'condoId'=>'c-'.$id,'demonstrativo'=>['periodo'=>['ini'=>'01/08/2026','fim'=>'31/08/2026']]],
 'cadastro'=>['codigo'=>null,'nome'=>'Condomínio fictício','cnpj'=>null]
];
$contar = static fn(string $t): int => (int)$pdo->query('SELECT COUNT(*) FROM kr_'.$t)->fetchColumn();
$esperarFalha = static function (array $p) use ($pdo): void {
  try { confirmar_importacao($pdo, $p); } catch (Throwable) { return; }
  throw new RuntimeException('A operação deveria falhar.');
};
$semente('ok');
$r = confirmar_importacao($pdo, $pedido('ok'));
$assert($r['criouCondominio'] && !$r['reutilizado'], 'Primeira confirmação incorreta.');
$retry = $pedido('ok');
$retry['registro']['id'] = 'outro-id';
$r2 = confirmar_importacao($pdo, $retry);
$assert($r2['reutilizado'] && $r2['registro']['id'] === 'r-ok', 'Retry não retornou registro original.');
$assert($contar('condominios') === 1 && $contar('mensais') === 1, 'Retry duplicou registros.');
$pdo->exec("CREATE TRIGGER falha_condominio BEFORE INSERT ON kr_condominios FOR EACH ROW BEGIN IF NEW.id = 'c-falha-condominio' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha de teste no condomínio'; END IF; END");
$pdo->exec("CREATE TRIGGER falha_relatorio BEFORE INSERT ON kr_mensais FOR EACH ROW BEGIN IF NEW.id = 'r-falha-relatorio' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha de teste após condomínio'; END IF; END");
$pdo->exec("CREATE TRIGGER falha_status BEFORE UPDATE ON kr_importacoes FOR EACH ROW BEGIN IF NEW.id = 'falha-status' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha de teste após relatório'; END IF; END");
foreach (['falha-condominio','falha-relatorio','falha-status'] as $id) {
  $semente($id);
  $esperarFalha($pedido($id));
  $assert($contar('condominios') === 1 && $contar('mensais') === 1, 'Rollback deixou gravação parcial.');
  $stmt=$pdo->prepare('SELECT dados FROM kr_importacoes WHERE id=?'); $stmt->execute([$id]);
  $assert(json_decode($stmt->fetchColumn(),true)['status'] === 'pendente', 'Rollback mudou status.');
  $assert(!$pdo->inTransaction(), 'Transação ficou aberta.');
}
$pdo->exec('DROP TRIGGER falha_condominio'); $pdo->exec('DROP TRIGGER falha_relatorio'); $pdo->exec('DROP TRIGGER falha_status');
$assert(!confirmar_importacao($pdo,$pedido('falha-status'))['reutilizado'], 'Retry após rollback deveria concluir.');
$semente('descartada','descartado'); $esperarFalha($pedido('descartada'));
$semente('invalida'); $p=$pedido('invalida'); $p['registro']['condoId']='incompativel'; $esperarFalha($p);
$semente('duplicado'); $p=$pedido('duplicado'); $p['condominio']=['id'=>'c-ok']; $p['registro']['condoId']='c-ok'; $esperarFalha($p);
$semente('exercicio'); $p=$pedido('exercicio'); $p['destino']='exercicios'; $esperarFalha($p);
$assert($contar('condominios') === 2 && $contar('mensais') === 2, 'Casos inválidos deixaram resíduos.');
$semente('inicio'); $p=$pedido('inicio'); $p['condominio']=['id'=>'c-ok','nome'=>'Não substituir cadastro'];
$p['registro']['condoId']='c-ok'; $p['registro']['demonstrativo']['periodo']=['ini'=>'1/9/2026','fim'=>''];
$assert(!confirmar_importacao($pdo,$p)['criouCondominio'], 'Cadastro existente foi recriado.');
$semente('anual','pendente','exercicios'); $p=$pedido('anual'); $p['destino']='exercicios';
$p['condominio']=['id'=>'c-ok']; $p['registro']['condoId']='c-ok'; $p['registro']['ano']=2999;
$r=confirmar_importacao($pdo,$p); $assert($r['registro']['ano']===2999, 'Limite do domínio foi alterado.');
$assert($contar('condominios')===2 && $contar('mensais')===3 && $contar('exercicios')===1, 'Confirmações válidas incorretas.');
$stmt=$pdo->query("SELECT dados FROM kr_condominios WHERE id='c-ok'");
$assert(json_decode($stmt->fetchColumn(),true)['nome']==='Condomínio fictício', 'Cadastro existente foi sobrescrito.');
echo "Confirmação MySQL: sucesso, retry, rollback entre etapas, recuperação, descartado, referência, duplicidade e destino aprovados.\n";

