# Estado atual e passagem de contexto

Snapshot de 20/10/2026 (atualizado após a consolidação de branches e a correção do Vitest). Conferir issues/PRs online antes de continuar.

## O que existe

- `main` é a branch padrão e de integração (commit atual: `git log -1 origin/main`). As branches antigas já mescladas foram removidas na consolidação #22/PR #23; novos trabalhos usam branches temporárias por issue.
- Domínio TypeScript (`domain/`+`lib/`) com 101 testes, `tsc --noEmit` limpo, `npm audit` sem vulnerabilidades (Vitest atualizado para 5.0.5 na #17).
- Backend PHP/MySQL e frontend compilado versionados na raiz (fluxo de publicação em `docs/PUBLICACAO.md`).
- **Os fontes React agora estão presentes em `frontend/`** (PR #21/#23, issue #2): espelho integral do projeto Lovable ao vivo (project_id `aa3c8b14-19f5-402a-87df-2d6d01f6de4c`), 184 arquivos de texto; faltam só 4 PNGs (binários, o MCP de leitura do Lovable não devolve conteúdo binário utilizável). Isso é um snapshot do código-fonte, não um pipeline de build integrado — ver #16.
- Issue #1 (migração da lógica de negócio pro Claude) teve a correspondência `domain/` ↔ `src/domain/` do Lovable conferida arquivo a arquivo (sem divergência) — ver comentário na issue. Ressalva registrada lá: não há import cross-repo de verdade (impossível, são deploys separados); a lógica é mantida em `domain/` e colada em `src/domain/` do Lovable sempre que muda.
- Hostinger acessível; site PHP/MySQL e auto-deploy Git confirmados. A configuração
  ainda referencia a branch antiga removida, conforme [CONEXOES.md](CONEXOES.md).

## Pendências e sequência sugerida

| Issue | Estado | Próxima ação |
| --- | --- | --- |
| [#16](https://github.com/felicioe/Krieger/issues/16) | Aberta, parcial | Fontes recuperados (`frontend/`); falta rodar o build de verdade e validar que bate com o bundle publicado |
| [#19](https://github.com/felicioe/Krieger/issues/19) | Conexão verificada; publicação pendente | Backup/preservação e alinhamento com main; **não publicar até o responsável confirmar que o sistema está completo** |
| [#6](https://github.com/felicioe/Krieger/issues/6) | Aberta, bloqueada | Só o responsável pode validar com um PDF real do Systemar (dados sensíveis não podem sair da máquina local) |
| [#24](https://github.com/felicioe/Krieger/issues/24) | Auditoria documentada | Integração de produção segue na #19 |

Fechadas nesta consolidação: #1, #2, #3, #4, #5, #7, #15, #17, #20, #22. #16 e #19 continuam com o Codex; #6 depende do usuário.

## Limitações conhecidas

- Auditoria técnica [Impeccable de 20/10/2026](auditorias/IMPECCABLE-2026-10-20.md):
  triagem provisória 11/20, sem correções ou deploy. #29 acompanha #30–#33 e a
  pendência existente #16; evidências de fontes e bundle publicado estão separadas.

- Testes do domínio não validam navegador/PDF worker, backend/banco ou produção.
- `frontend/` é um espelho pontual do Lovable, não um build verificado — ver #16.
- Hostinger foi inspecionada; deploy não realizado. A configuração ainda aponta para
  a branch antiga. Backup e preservação de config.php não foram verificados (#19).
- frontend/src/domain e domain/ são cópias separadas; a correspondência foi conferida
  anteriormente, mas a atualização conjunta precisa continuar documentada (#16).

## Ao retomar

Ler AGENTS.md, consultar GitHub (`gh issue list --state all`) e sincronizar `origin/main`
(`git fetch && git merge --ff-only origin/main` — nunca `reset --hard`, fica bloqueado
pelo classificador de segurança do Claude Code). Trabalhar em branch própria por issue,
a partir de `main`, apagando a branch (local e remota) depois do merge — uma de cada vez
se estiver apagando várias, o classificador bloqueia exclusões em lote/rápidas demais.
Atualizar este snapshot quando uma limitação estrutural for resolvida e registrar
evidências na issue correspondente. Nunca depender apenas de mensagens de chat.
