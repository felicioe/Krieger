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

1. O perfil `admin` (**SuperADM**) mantém acesso total e nem consulta a matriz: `permissoes_usuario()` devolve `['*']`.
2. Os demais perfis leem a matriz de `kr_perfil_permissoes`; sem linha para a chave, negam.
3. Uma permissão explícita de usuário (`kr_usuario_permissoes`) prevalece sobre a do perfil.
4. Uma regra `negar` prevalece sobre `permitir`.
5. Sem regra permitida, a tela/ação fica bloqueada.
6. O frontend esconde o item; o backend responde 403 se houver tentativa direta.

## Três níveis

| Perfil | Valor gravado | Acesso |
| --- | --- | --- |
| SuperADM | `admin` | Total; administra usuários, perfis e a matriz; restaura backup |
| ADM | `adm` | Tudo menos as telas de administração (`usuarios`, `backup`, `escritorio`) |
| Usuário | `user` | Começa como o ADM; o SuperADM restringe na matriz ou por exceção individual |

O rótulo da interface é novo, o valor gravado de `admin` não mudou: nenhuma linha de
`kr_usuarios` foi reescrita e nenhum login quebrou. O ADM e o Usuário nascem do padrão de
`migrations/20261108_perfis_tres_niveis.sql`, e o SuperADM edita a matriz em **Perfis e
permissões** (tela de Usuários), chave por chave, com gravação imediata.

## Quem controla cada função

Itens controlados pela matriz (ADM e Usuário, com exceções por usuário):

- Telas: as chaves `modulo.visualizar`, do menu e das rotas (`lib/permissoes.ts`).
- Ações de edição: as chaves `modulo.editar`.
- Aba **Configuração** do cadastro do condomínio: `condominios.configurar` (regras de dedução,
  rubricas de água, energia e elevadores, fornecedor dos elevadores, arredondamento e de-para).
  Ao salvar, o PHP exige a permissão quando algum desses campos muda; o ADM a recebe na migração.

Exclusivo do SuperADM, fixo fora da matriz (decisão de 22/11/2026):

- Usuários, perfis e a matriz de permissões (`usuarios`).
- Validar, restaurar, excluir backups e criar backup integral.
- Limpeza de dados em massa (consultar e apagar cadastros).
- Carga inicial do previsto aprovado.

Limitação conhecida: os fluxos de importação e de prestação de contas também gravam o cadastro do
condomínio (`api.salvar("condominios")`). Por isso o salvamento aceita `importador.editar` além de
`condominios.editar`. Separar esses caminhos exige mudar essas telas, e fica como próxima etapa.

## Navegação

Botões que levam a uma tela devem verificar a permissão da tela de destino. Se o destino não for permitido, o botão não é renderizado. Links salvos ou hashes digitados devem cair em uma tela de acesso negado ou no primeiro módulo autorizado.

## Migração

Aplicar `migrations/20261031_permissoes_granulares.sql` após backup. O script não remove colunas nem altera usuários atuais.

O `schema.sql` passou a incluir as mesmas quatro tabelas e o catálogo (idempotente, `INSERT IGNORE`), para que uma instalação nova já nasça com as permissões configuradas. A migração continua sendo o caminho para bancos já existentes, como o de produção.
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

