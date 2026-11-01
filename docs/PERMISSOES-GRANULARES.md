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
# Verificação da migração em produção

Em 01/11/2026, o responsável informou ter executado a migração pelo phpMyAdmin
e confirmou 25 registros em `kr_permissoes`. Os avisos de chave duplicada no
segundo `INSERT IGNORE` do perfil são esperados e não duplicam registros.
Essa contagem confirma o catálogo; ainda exige validação funcional das permissões.

## Contrato de telas e dados compartilhados

Permissões delimitam telas e ações, não condomínios individuais. As consultas
compartilhadas de condomínios, exercícios, relatórios, modelos e configuração
podem ser usadas pelos módulos consumidores autorizados, sem liberar navegação
para a tela de origem. A API mantém a matriz de consumidores em `api.php`.
Previsão e importação podem gravar os registros compartilhados necessários ao seu
fluxo; excluir continua dependente do módulo proprietário. Backup integral exige
acesso de leitura a todos os módulos de dados para não contornar restrições.

A navegação usa `podeAcessarRota` e `LinkPermitido`, inclusive nos botões `asChild`.
O menu aplica o mesmo controle; rotas administrativas continuam exclusivas de
administradores. A sessão é relida ao navegar, enquanto o PHP revalida cada chamada.
Sem telas concedidas, o destino é Minha senha. Administradores conservam acesso total.
O catálogo mock contém as mesmas 25 chaves e persiste exceções por usuário.

