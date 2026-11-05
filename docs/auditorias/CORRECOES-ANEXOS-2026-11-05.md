# Carregamento de anexos por metadados — 05/11/2026

Refs #230, achado 11 da auditoria Impeccable.

Abrir uma prestação consulta somente os metadados de seus próprios anexos. A API
filtra `exercicioId` e remove `arquivoDataUrl` no MySQL antes de enviar a resposta
ao PHP. Nome, período, tipo, data e tamanho continuam disponíveis na listagem.
O PDF completo é obtido pelo identificador apenas quando o usuário pede o download.
A exclusão em cascata também usa os metadados do exercício, sem ler todos os PDFs.

Contrato: `api.anexos.listar(exercicioId)` usa a ação existente
`listar&s=anexos_importacao&metadados=1&exercicioId=...`, mantendo a verificação de
permissão de leitura da prestação. A listagem genérica e os backups preservam os
arquivos completos. O adaptador de demonstração expõe a mesma projeção.
Não há migração de banco, regravação de arquivos nem alteração de configuração.

O helper interno `lib_anexos.php` integra o pacote de publicação e é bloqueado
para acesso direto pelas regras existentes de arquivos `lib_*.php`.

Validação: regressões do frontend cobrem filtro, ausência do PDF, recuperação do
original, autenticação, erro de permissão e codificação do identificador. O teste
`scripts/test-anexos.php` executa a projeção real no MySQL efêmero do CI, conferindo
padding base64, arquivo grande, filtro parametrizado e preservação do original.
Os resultados efetivamente executados ficam registrados no PR.
