# Estado atual e passagem de contexto

Snapshot de 20/10/2026. Conferir issues/PRs online antes de continuar.

## O que existe

- `main` criada no commit 823d88d e definida como branch padrão.
- Domínio TypeScript com 101 testes aprovados na inspeção inicial.
- Backend PHP/MySQL e frontend já compilado versionados.
- PR #18: empacotamento, CI, documentação operacional e instruções de agentes.
- Os fontes React não estão presentes na árvore atual; não há build/dev React.

## Pendências e sequência sugerida

| Issue | Estado na inspeção | Próxima ação |
| --- | --- | --- |
| [#15](https://github.com/felicioe/Krieger/issues/15) | Implementação em PR #18 | Conferir SHA final e CI antes de integrar |
| [#16](https://github.com/felicioe/Krieger/issues/16) | Aberta | Recuperar fontes React e build reproduzível; preservação do histórico |
| [#17](https://github.com/felicioe/Krieger/issues/17) | Aberta | Corrigir alertas Vitest/transitivas e revalidar |
| [#19](https://github.com/felicioe/Krieger/issues/19) | Parcial: main alinhada | Inspecionar conector e destino Hostinger; documentar integração real |
| [#2](https://github.com/felicioe/Krieger/issues/2) | Aberta | Concluir integração frontend/build e publicação; depende de #16/#19 |
| [#6](https://github.com/felicioe/Krieger/issues/6) | Aberta | Executar roteiro com PDFs reais localmente ou fixtures fiéis anonimizadas |

As issues #1, #3, #4, #5 e #7 não estavam abertas na consulta inicial; há merges
relacionados no histórico. Isso não comprova que todos os recursos estão ligados
à UI servida. Quando os fontes forem recuperados, conferir essa correspondência.

## Limitações conhecidas

- Testes do domínio não validam navegador/PDF worker, backend/banco ou produção.
- Alertas npm audit: Vitest, @vitest/mocker e tinypool, registrados na #17.
- Integração Hostinger não inspecionada por ferramenta nesta sessão; deploy não realizado.
- Fontes originais podem estar em histórico/branches ou no projeto Lovable histórico;
  ainda não se comprovou a localização da revisão correspondente ao bundle atual.

## Ao retomar

Ler AGENTS.md, consultar GitHub e buscar origin/main. Verificar se #18 já foi
integrado; se não, trabalhar a partir da branch apropriada sem duplicar o PR.
Atualizar este snapshot quando uma limitação estrutural for resolvida e registrar
evidências na issue correspondente. Nunca depender apenas de mensagens de chat.
