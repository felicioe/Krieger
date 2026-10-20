# Estado atual e passagem de contexto

Snapshot de 20/10/2026 (atualizado após o primeiro build real de `frontend/` e a migração do deploy Hostinger pra branch dedicada). Conferir issues/PRs online antes de continuar.

## O que existe

- `main` é a branch padrão e de integração (commit atual: `git log -1 origin/main`). Branches de trabalho são temporárias por issue, apagadas (local e remota) depois do merge.
- Domínio TypeScript (`domain/`+`lib/`) com 105 testes, `tsc --noEmit` limpo, `npm audit` sem vulnerabilidades.
- **`frontend/` compila de verdade agora** (PR #39): `npm install && npm run build` completam sem erro (Node v26.12.0), gerando `.output/public/index.html` + `assets/*.js` — SPA estática compatível com a hospedagem PHP atual (confirma o `spa.enabled`/prerender do `vite.config.ts`). Testado localmente servindo o build: login, painel, condomínios, prestação de contas, previsão orçamentária (bate com `domain/previsao.ts`) e relatório final renderizam certo, sem erro de console. Ainda não testado: importação de PDF real nessa build específica (só no preview de dev do Lovable), e `frontend/src/domain` continua sendo cópia colada, não import compartilhado — ver #16.
- `frontend/` é o espelho do projeto Lovable ao vivo (project_id `aa3c8b14-19f5-402a-87df-2d6d01f6de4c`); mantido manualmente (sem automação) sempre que o Lovable muda.
- **Publicação em produção usa uma branch dedicada `deploy-hostinger`** (órfã, raiz = exatamente `npm run package:hostinger`), não `main` diretamente — `main` tem a árvore inteira do repo, inadequada pra publicar direto. Atualizar essa branch ainda é manual (rodar o empacotamento e sobrescrever o conteúdo dela); não há CI pra isso ainda.
- **Produção (`krieger.therafinancial.com.br`) publica hoje o sistema legado** (HTML/JS estático + PHP), o mesmo de sempre — só a forma de deploy mudou (pacote curado em vez da raiz crua do repo). O frontend React novo nunca foi publicado em produção; essa decisão continua em aberto, aguardando o responsável.
- **Incidente registrado**: trocar a branch/repositório do auto-deploy do Hostinger apaga arquivos fora do Git (não preserva como a API sugere) — `config.php` foi apagado e recriado manualmente. Ver `docs/DECISOES.md`. Banco de dados não foi afetado.

## Pendências e sequência sugerida

| Issue | Estado | Próxima ação |
| --- | --- | --- |
| [#16](https://github.com/felicioe/Krieger/issues/16) | Build validado; critérios residuais abertos | Decidir mecanismo pra eliminar a duplicação domain/↔frontend/src/domain; validar PDF real nesta build |
| [#19](https://github.com/felicioe/Krieger/issues/19) | Deploy migrado pra `deploy-hostinger`; config.php recuperado | Falta registrar plano formal de rollback; **não publicar o frontend novo em produção até o responsável confirmar que o sistema está completo** |

Fechadas: #1, #2, #3, #4, #5, #6, #7, #15, #17, #20, #22. #16 e #19 seguem abertas (critérios residuais, não bloqueantes do dia a dia).

## Limitações conhecidas

- Testes do domínio não validam navegador/PDF worker, backend/banco ou produção.
- `frontend/src/domain` e `domain/` são cópias separadas (sem import compartilhado real) — ver #16.
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
