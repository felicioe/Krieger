# Confirmação da importação

Correção da issue #69: o staging é a chave idempotente da confirmação.
O frontend Lovable envia uma única requisição autenticada POST
`api.php?a=confirmar_importacao`. Não usar sequência de três salvamentos como
fallback em produção. O endpoint exige a mesma sessão e checagem de origem da API.

## Contrato

JSON: `importacaoId`, `destino` (mensais/exercicios), `condominio` (objeto novo
com id ou somente id existente), `registro` (com id e condoId), `cadastro`
(codigo/nome/cnpj, string ou null). O frontend aplica as validações de domínio
antes de enviar. O servidor valida referências, destino, status e duplicidade
de período, sem reinterpretar valores contábeis.

Resposta: `registro`, `condominioId`, `criouCondominio`, `reutilizado`.
Um retry já confirmado retorna o registro vinculado original, mesmo que o
cliente gere outro id. Não sobrescreve condomínio existente nem relatório com
id colidente. Registro removido depois da confirmação exige conferência manual
(409), sem recriar silenciosamente.

## Transação e recuperação

`lib_importacao.php` bloqueia a linha de staging por SELECT FOR UPDATE.
Dentro da transação InnoDB: obtém/cria condomínio, insere relatório, atualiza
staging para confirmado e commit. Qualquer exceção faz rollback de todas as
etapas. Repetir após uma falha é seguro para essa mesma importação.

O lock do condomínio existente serializa confirmações para o mesmo cadastro;
ids distintos de condomínios novos ainda seguem o contrato de identificação
do produto. Este endpoint não introduz unicidade global de CNPJ/código no banco
nem substitui uma política própria de deduplicação de cadastros.

O schema atual já usa InnoDB; não há migração. `lib_importacao.php` integra o
pacote curado e nega acesso direto. Configuração e dados não integram o pacote.

## Testes

O CI usa MySQL8 efêmero, banco krieger_test, sem acesso à produção.
`scripts/test-confirmacao.php` exige DSN de loopback com esse nome exato.
Triggers de teste provocam falhas na criação do condomínio, depois dele e depois do relatório;
os testes verificam rollback, retry sem duplicação, recuperação após rollback,
status descartado, referência, período duplicado e destino divergente. Também
verificam competência pela data inicial, cadastro existente sem sobrescrita e
prestação de contas no limite de ano aceito pelo domínio (2999).
Credencial do serviço CI é descartável e não corresponde à hospedagem.

PHP local tem sintaxe validada; sem driver PDO MySQL local, integração é
confirmada pelo CI. Não declarar persistência em produção com base nesses
testes. Validação visual no site usa PDFs fictícios até prévia; gravação e
falhas de banco exigem ambiente apropriado.
