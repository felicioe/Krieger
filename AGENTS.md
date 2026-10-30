# Instruções para agentes — Krieger

## Comece aqui

1. Leia `README.md`, `docs/ESTADO-ATUAL.md` e `docs/ARQUITETURA.md`.
2. Consulte as issues e PRs no GitHub; o estado online prevalece sobre snapshots.
3. Leia `docs/DESENVOLVIMENTO.md` antes de editar e `docs/PUBLICACAO.md` antes de publicar.
4. Confira `git status`, sincronize `origin/main` e trabalhe em branch própria por issue.

## Lovable descontinuado (desde 24/10/2026) — frontend e todo o código são do Claude

Determinação explícita do responsável: o Lovable não participa mais do projeto,
em nenhuma frente. **Isto substitui a regra anterior (21/10/2026) de frontend
exclusivo no Lovable**, que não vale mais — não seguir nada deste arquivo ou de
outro documento que ainda a cite como regra vigente (histórico em
`docs/DECISOES.md`). Claude edita `frontend/src/**` diretamente, do mesmo jeito
que edita o resto do repositório (`domain/`, `lib/`, PHP), seguindo os padrões já
estabelecidos — lógica de negócio vindo dos shims `@/domain`/`@/lib`, nunca
duplicada inline nos componentes. Ver detalhes técnicos em `docs/ARQUITETURA.md`
("Frontend: Claude, não mais Lovable").

Codex continua com auditoria, revisão, testes, CI, integração e publicação —
agora também pode revisar/testar o frontend (deixou de ser território exclusivo
do Lovable), mas correções de frontend em si são implementadas pelo Claude.
Não há mais sincronização de arquivos com um projeto Lovable: não presumir essa
etapa em nenhum fluxo novo.

## Ambiente de revisão visual

O responsável se interessa pela versão publicada na Hostinger. A revisão visual
final é no site publicado (ou no preview local do `frontend/`, quando fizer
sentido para a tarefa); não existe mais preview do Lovable para acompanhar
tarefas ou validar entregas.

## Regras do projeto

- Comunicação, issues, PRs e documentação em pt-BR.
- Desenvolvimento na Claude ou Codex → PR no GitHub → `main` → Hostinger via conector/API.
- `main` é a branch padrão. Não usar branches antigas `claude/*` como base de novos trabalhos.
- Registre problema, critérios de aceite, decisões, testes e limitações no GitHub.
- Versão e histórico públicos vêm de frontend/src/data/versoes.json (editado pelo
  Claude, como o resto do frontend; não há mais autoria Lovable).
  Seguir docs/VERSIONAMENTO.md; gerar CHANGELOG.md com npm run changelog:gerar.
  Não incrementar versão por pequenos ajustes ou a cada commit.
- Toda mudança de comportamento, configuração ou processo deve atualizar a documentação relacionada no mesmo PR.
- Não declarar um recurso pronto porque existe no domínio: conferir ligação ao frontend e comportamento no ambiente real.
- Regras de negócio em `domain/` (TypeScript sem React); formatação compartilhada em `lib/`.
- Não editar bundles minificados em `assets/` para implementar funcionalidades. Recuperar/recompilar os fontes (issue #16).
- Não criar um frontend paralelo, novo backend ou migrar banco sem justificar a decisão na issue.
- Não versionar `config.php`/`krieger-config.php`/`config.local.php`, tokens, backups ou PDFs reais. Usar fixtures fictícias/anonimizadas.
- Não apagar branches antigas enquanto a origem dos fontes não estiver esclarecida.
- Não encerrar issues com critérios pendentes; registrar explicitamente o que falta.
- **Fluxo autônomo de PR e publicação** (pedido explícito do responsável, repetido por já ter se
  perdido entre sessões — por isso fica aqui, não só em memória do agente): terminada uma mudança
  com testes/typecheck/docs:check passando e sem decisão de produto pendente pro responsável, abrir o
  PR, mesclar e publicar (pacote + push em `deploy-hostinger` + validação ao vivo) sem parar pra
  pedir confirmação a cada etapa. Registrar tudo no PR e no `docs/ESTADO-ATUAL.md` de qualquer forma.
  Continua valendo pedir confirmação antes de ações destrutivas (force-push, apagar branch não
  mesclada, mudar configuração/banco de produção) e quando há decisão de produto real em aberto.

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
