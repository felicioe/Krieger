# Instruções para agentes — Krieger

## Comece aqui

1. Leia `README.md`, `docs/ESTADO-ATUAL.md` e `docs/ARQUITETURA.md`.
2. Consulte as issues e PRs no GitHub; o estado online prevalece sobre snapshots.
3. Leia `docs/DESENVOLVIMENTO.md` antes de editar e `docs/PUBLICACAO.md` antes de publicar.
4. Confira `git status`, sincronize `origin/main` e trabalhe em branch própria por issue.

## Responsabilidade permanente pelo frontend

Determinação explícita do responsável em 21/10/2026: o frontend pertence
exclusivamente ao Lovable. Codex/ChatGPT não deve editar componentes, estilos,
layouts, assets ou comportamento do frontend, inclusive para corrigir auditorias.
Esta regra vale para todas as sessões futuras; não presumir exceção a partir de
pedidos genéricos como “corrija tudo”. Mudança desta regra exige instrução
explícita do responsável.

Codex pode auditar e revisar em modo de leitura, documentar achados e critérios
no GitHub, validar testes/build e cuidar de backend, integração e publicação
conforme as regras próprias. Correções de frontend devem ser feitas no Lovable;
não aplicar patches locais concorrentes nem substituir arquivos do frontend
para contornar essa responsabilidade.

## Regras do projeto

- Comunicação, issues, PRs e documentação em pt-BR.
- Desenvolvimento na Claude ou Codex → PR no GitHub → `main` → Hostinger via conector/API.
- `main` é a branch padrão. Não usar branches antigas `claude/*` como base de novos trabalhos.
- Registre problema, critérios de aceite, decisões, testes e limitações no GitHub.
- Toda mudança de comportamento, configuração ou processo deve atualizar a documentação relacionada no mesmo PR.
- Não declarar um recurso pronto porque existe no domínio: conferir ligação ao frontend e comportamento no ambiente real.
- Regras de negócio em `domain/` (TypeScript sem React); formatação compartilhada em `lib/`.
- Não editar bundles minificados em `assets/` para implementar funcionalidades. Recuperar/recompilar os fontes (issue #16).
- Não criar um frontend paralelo, novo backend ou migrar banco sem justificar a decisão na issue.
- Não versionar `config.php`/`krieger-config.php`/`config.local.php`, tokens, backups ou PDFs reais. Usar fixtures fictícias/anonimizadas.
- Não apagar branches antigas enquanto a origem dos fontes não estiver esclarecida.
- Não encerrar issues com critérios pendentes; registrar explicitamente o que falta.

## Validação

Execute `npm ci`, `npm test`, `npm run typecheck`, `npm run docs:check` e
`npm run package:hostinger`. Para PHP, executar `php -l` em cada PHP da raiz
ou conferir o resultado do CI. Escolha testes adicionais conforme a mudança.
Registre os comandos e resultados reais no PR; não declarar testes não executados.
O CI gera artefato, mas não faz deploy. Confira a execução do SHA final do PR.

## Publicação e continuidade

Somente commits de `main` podem ser origem de uma publicação. Conferir capacidade
real do conector para PHP, domínio/conta corretos, preservação de configuração e
dados e estratégia de rollback. Seguir as regras do conector disponível na sessão.
Não improvisar endpoints nem registrar credenciais em documentação pública.

Ao encerrar uma etapa, atualizar a issue e o PR com commit, validações, pendências
e próximo passo. Atualizar `docs/ESTADO-ATUAL.md` quando mudar a situação estrutural.
As decisões duráveis ficam em `docs/DECISOES.md`, sem depender do histórico do chat.
