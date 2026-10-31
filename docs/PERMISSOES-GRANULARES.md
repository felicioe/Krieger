# Permissões granulares

A permissão de tela é independente do menu visual. O frontend usa o catálogo para esconder menus e botões; o PHP deve validar a mesma chave antes de executar a operação.

## Formato da chave

`modulo.tela.acao`

Exemplos:

- `painel.visualizar`
- `condominios.visualizar`
- `condominios.editar`
- `prestacao_contas.visualizar`
- `prestacao_contas.importar`
- `relatorio_mensal.visualizar`
- `editais.visualizar`
- `modelos_edital.editar`
- `drive_documentos.visualizar`
- `drive_documentos.editar`
- `usuarios.visualizar`
- `usuarios.editar`
- `backup.visualizar`
- `backup.restaurar`

## Resolução

1. O perfil `admin` mantém acesso total para compatibilidade.
2. Para usuários comuns, uma permissão explícita de usuário prevalece sobre a permissão do perfil.
3. Uma regra `negar` prevalece sobre `permitir`.
4. Sem regra permitida, a tela/ação fica bloqueada.
5. O frontend esconde o item; o backend responde 403 se houver tentativa direta.

## Navegação

Botões que levam a uma tela devem verificar a permissão da tela de destino. Se o destino não for permitido, o botão não é renderizado. Links salvos ou hashes digitados devem cair em uma tela de acesso negado ou no primeiro módulo autorizado.

## Migração

Aplicar `migrations/20261031_permissoes_granulares.sql` após backup. O script não remove colunas nem altera usuários atuais. A implementação do middleware e da administração de permissões será feita em PRs posteriores.
