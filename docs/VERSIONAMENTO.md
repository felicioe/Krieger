# Versões e Registro de Alterações

Decisão do responsável em 22/10/2026, issue #77: a versão inicial é **1.0**,
com o marco **Implantação do sistema**. Ela representa o conjunto implantado;
não reconstruir versões antigas a partir dos commits de ajustes anteriores.

## Quando criar uma versão

Registrar nova versão, como 1.01, somente para mudança estrutural ou importante
para quem usa o sistema: recurso relevante, mudança de fluxo, cálculo/regra,
segurança ou modelo de dados com impacto significativo. Pequenos ajustes de
texto, espaçamento, cor, manutenção interna e correções rotineiras ficam nas
issues/PRs/commits, sem novo marco público por padrão. A importância é uma
decisão de revisão do release; nenhum script aumenta a versão automaticamente.

Versões são strings: 1.0, 1.01, 1.02 e assim por diante. Não interpretar como
número decimal nem impor SemVer de três partes. Não publicar entradas futuras
ou um marco ainda não entregue. Mudança grande proposta vai para a issue/PR
antes de aparecer como versão publicada.

## Fonte única e atualização

O arquivo frontend/src/data/versoes.json contém versaoAtual e a lista versoes,
da mais recente para a mais antiga. Login e Registro de Alterações leem os
mesmos dados públicos. Não colocar credenciais, nomes/dados de clientes,
valores financeiros ou detalhes de exploração no histórico público.

1. Editar `frontend/src/data/versoes.json` (atualizar os dados do marco e a versão
   atual, preservando versões anteriores) — desde 24/10/2026 direto no Claude,
   junto com o resto do frontend; o arquivo não passa mais pelo Lovable (ver
   `docs/DECISOES.md`, "Lovable descontinuado").
2. Commitar na branch da entrega.
3. Executar npm run changelog:gerar para atualizar CHANGELOG.md a partir do JSON.
4. Revisar a descrição em linguagem do usuário e executar npm run changelog:check.
5. PR, testes, CI, main, artefato e Hostinger conforme PUBLICACAO.md.
6. Confirmar que rodapé e histórico no site publicado mostram o mesmo release.

CHANGELOG.md é gerado; não editar separadamente. O CI falha se ele divergir
da fonte única ou se versão atual/histórico forem inválidos. Registro público
não substitui documentação técnica, critérios de aceite e evidências no GitHub.

O login deve expor somente a autoria “Feito pela Therafinancial” e a versão.
Decisão posterior do responsável em 22/10/2026, issue #81: o Registro de
Alterações fica dentro do sistema, após login, no menu recolhível do usuário.
Essa decisão substitui o acesso sem sessão previsto inicialmente na #77.
O menu fica fechado por padrão e abre sob demanda; mantém troca de senha,
saída e opções de administração conforme as permissões existentes.
Abrir/fechar o histórico não apaga dados da tela atual; teclado e retorno
de foco devem funcionar. Isso não altera autenticação.
