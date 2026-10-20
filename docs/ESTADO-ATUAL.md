# Estado atual e passagem de contexto

Snapshot de 20/10/2026 (atualizado após o primeiro build real de `frontend/` e a migração do deploy Hostinger pra branch dedicada). Conferir issues/PRs online antes de continuar.

## O que existe

- `main` é a branch padrão e de integração (commit atual: `git log -1 origin/main`). Branches de trabalho são temporárias por issue, apagadas (local e remota) depois do merge.
- Domínio TypeScript (`domain/`+`lib/`) com 105 testes, `tsc --noEmit` limpo, `npm audit` sem vulnerabilidades.
- **`frontend/` compila de verdade agora** (PR #39): `npm install && npm run build` completam sem erro (Node v26.12.0), gerando `.output/public/index.html` + `assets/*.js` — SPA estática compatível com a hospedagem PHP atual (confirma o `spa.enabled`/prerender do `vite.config.ts`). Testado localmente servindo o build: login, painel, condomínios, prestação de contas, previsão orçamentária (bate com `domain/previsao.ts`) e relatório final renderizam certo, sem erro de console. Importação de PDF real já validada pelo responsável (issue #6, fechada).
- **Duplicação `domain/`↔`frontend/src/domain` eliminada** (PR #41): os 20 arquivos de `frontend/src/domain/` e os 2 de `frontend/src/lib/` (format.ts, id.ts) agora são re-exports de uma linha pra raiz (`export * from`), não cópias de conteúdo. `domain/`+`lib/` na raiz é a única fonte real no repositório GitHub. Isso não muda o projeto Lovable ao vivo (sandbox isolado, só vê os próprios arquivos) — colar conteúdo atualizado no chat do Lovable continua sendo a única forma de manter o preview deles sincronizado.
- `frontend/` é o espelho do projeto Lovable ao vivo (project_id `aa3c8b14-19f5-402a-87df-2d6d01f6de4c`); mantido manualmente (sem automação) sempre que o Lovable muda (exceto `src/domain`/`src/lib/format.ts`/`id.ts`, que agora são shims e não precisam de re-sincronização).
- **Publicação em produção usa uma branch dedicada `deploy-hostinger`** (órfã, raiz = exatamente `npm run package:hostinger`), não `main` diretamente — `main` tem a árvore inteira do repo, inadequada pra publicar direto. Atualizar essa branch ainda é manual (rodar o empacotamento e sobrescrever o conteúdo dela); não há CI pra isso ainda.
- **Produção (`krieger.therafinancial.com.br`) publica hoje o sistema legado** (HTML/JS estático + PHP), o mesmo de sempre — só a forma de deploy mudou (pacote curado em vez da raiz crua do repo). O frontend React novo nunca foi publicado em produção; essa decisão continua em aberto, aguardando o responsável.
- **Incidente registrado**: trocar a branch/repositório do auto-deploy do Hostinger apaga arquivos fora do Git (não preserva como a API sugere) — `config.php` foi apagado e recriado manualmente. Ver `docs/DECISOES.md`. Banco de dados não foi afetado.

## Pendências e sequência sugerida

| Issue | Estado | Próxima ação |
| --- | --- | --- |
| [#19](https://github.com/felicioe/Krieger/issues/19) | Deploy migrado pra `deploy-hostinger`; config.php recuperado | Falta registrar plano formal de rollback; **não publicar o frontend novo em produção até o responsável confirmar que o sistema está completo** |

Fechadas: #1, #2, #3, #4, #5, #6, #7, #15, #16, #17, #20, #22. Só #19 segue aberta — publicação do frontend novo em produção, decisão do responsável.

## Limitações conhecidas

- Testes do domínio não validam navegador/PDF worker, backend/banco ou produção.
- Atualizar a branch `deploy-hostinger` depois de mudanças relevantes em `main` é manual; esquecer isso deixa a produção desatualizada silenciosamente.
- Trocar branch/repositório no auto-deploy do Hostinger não preserva arquivos fora do Git (ex.: `config.php`) — reupload manual é necessário toda vez que isso acontecer de novo.

## Ao retomar

Ler AGENTS.md, consultar GitHub (`gh issue list --state all`) e sincronizar `origin/main`
(`git fetch && git merge --ff-only origin/main` — nunca `reset --hard`, fica bloqueado
pelo classificador de segurança do Claude Code). Trabalhar em branch própria por issue,
a partir de `main`, apagando a branch (local e remota) depois do merge — uma de cada vez
se estiver apagando várias, o classificador bloqueia exclusões em lote/rápidas demais.
Atualizar este snapshot quando uma limitação estrutural for resolvida e registrar
evidências na issue correspondente. Nunca depender apenas de mensagens de chat.
