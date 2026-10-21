# Estado atual e passagem de contexto

Snapshot atualizado em 21/10/2026 após reauditoria do site publicado. Conferir issues/PRs online antes de continuar.

## O que existe

- `main` é a branch padrão e de integração (commit atual: `git log -1 origin/main`). Branches de trabalho são temporárias por issue, apagadas (local e remota) depois do merge.
- Domínio TypeScript (`domain/`+`lib/`) com 114 testes aprovados em 21/10/2026, `tsc --noEmit` limpo; instalação da raiz reportou zero vulnerabilidades.
- **`frontend/` compila de verdade agora** (PR #39): `npm install && npm run build` completam sem erro (Node v26.12.0), gerando `.output/public/index.html` + `assets/*.js` — SPA estática compatível com a hospedagem PHP atual (confirma o `spa.enabled`/prerender do `vite.config.ts`). Testado localmente servindo o build: login, painel, condomínios, prestação de contas, previsão orçamentária (bate com `domain/previsao.ts`) e relatório final renderizam certo, sem erro de console. Importação de PDF real já validada pelo responsável (issue #6, fechada).
- **Duplicação `domain/`↔`frontend/src/domain` eliminada** (PR #41): os 20 arquivos de `frontend/src/domain/` e os 2 de `frontend/src/lib/` (format.ts, id.ts) agora são re-exports de uma linha pra raiz (`export * from`), não cópias de conteúdo. `domain/`+`lib/` na raiz é a única fonte real no repositório GitHub. Isso não muda o projeto Lovable ao vivo (sandbox isolado, só vê os próprios arquivos) — colar conteúdo atualizado no chat do Lovable continua sendo a única forma de manter o preview deles sincronizado.
- `frontend/` é o espelho do projeto Lovable ao vivo (project_id `aa3c8b14-19f5-402a-87df-2d6d01f6de4c`); mantido manualmente (sem automação) sempre que o Lovable muda (exceto `src/domain`/`src/lib/format.ts`/`id.ts`, que agora são shims e não precisam de re-sincronização).
- **Publicação em produção usa uma branch dedicada `deploy-hostinger`** (órfã, raiz = exatamente `npm run package:hostinger`), não `main` diretamente — `main` tem a árvore inteira do repo, inadequada pra publicar direto. Atualizar essa branch ainda é manual (rodar o empacotamento e sobrescrever o conteúdo dela); não há CI pra isso ainda.
- **Produção já serve o frontend React**, confirmado por DOM e navegação em 21/10/2026. Branch deploy-hostinger no commit 4d3bfd1, com origem declarada main 5709184; main auditada 960d6fc. O backend continua PHP/MySQL. A auditoria não realizou a publicação.
- **Incidente registrado**: trocar a branch/repositório do auto-deploy do Hostinger apaga arquivos fora do Git (não preserva como a API sugere) — `config.php` foi apagado e recriado manualmente. Ver `docs/DECISOES.md`. Banco de dados não foi afetado.

## Pendências e sequência sugerida

| Issue | Estado | Próxima ação |
| --- | --- | --- |
| [#19](https://github.com/felicioe/Krieger/issues/19) | React publicado em deploy-hostinger; config.php recuperado no incidente anterior | Formalizar rollback e vínculo de SHAs; alterações futuras passam por GitHub antes de publicar |
| [#46](https://github.com/felicioe/Krieger/issues/46) | Reauditoria da produção | Acompanhar #30/#31/#32/#47/#48 e medição #33 |
| [#49](https://github.com/felicioe/Krieger/issues/49) | CI sem build frontend antes do pacote | Definir instalação/lock, construir e empacotar no runner |

Fechadas anteriormente: #1, #2, #3, #4, #5, #6, #7, #15, #16, #17, #20, #22. Há pendências abertas de integração e auditoria; a lista online prevalece sobre este snapshot.

## Limitações conhecidas

- Reauditoria [Impeccable em produção em 21/10/2026](auditorias/IMPECCABLE-PRODUCAO-2026-10-21.md),
  issue #46: React efetivamente publicado em deploy-hostinger (4d3bfd1, origem
  declarada main 5709184), entrada index-D_dJBo1m.js. Isso atualiza a observação
  anterior de produção legada. Main consultada 960d6fc; achados seguem em
  #30–#33/#47–#49. Nenhuma correção de UI ou deploy feito na auditoria.

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
