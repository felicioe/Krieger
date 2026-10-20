# Estado atual e passagem de contexto

Snapshot de 20/10/2026. Conferir issues/PRs online antes de continuar.

## O que existe

- `main` criada no commit 823d88d e definida como branch padrão.
- Domínio TypeScript com 101 testes aprovados na inspeção inicial.
- Backend PHP/MySQL e frontend já compilado versionados.
- PR #18 integrado: empacotamento, CI, documentação operacional e instruções de agentes.
- Fontes React incorporados em frontend/ pelos PRs #21/#23, main dfbd702.
- Hostinger acessível; site PHP/MySQL e auto-deploy Git confirmados. A produção
  ainda segue a branch antiga, conforme [CONEXOES.md](CONEXOES.md).

## Pendências e sequência sugerida

| Issue | Estado na inspeção | Próxima ação |
| --- | --- | --- |
| [#15](https://github.com/felicioe/Krieger/issues/15) | Concluída pelo PR #18 | Empacotamento e CI disponíveis |
| [#16](https://github.com/felicioe/Krieger/issues/16) | Fontes recuperados; restante aberto | Validar build reproduzível e centralizar domínio duplicado |
| [#17](https://github.com/felicioe/Krieger/issues/17) | Aberta | Corrigir alertas Vitest/transitivas e revalidar |
| [#19](https://github.com/felicioe/Krieger/issues/19) | Conexão verificada | Backup/preservação e alinhamento da produção com main |
| [#2](https://github.com/felicioe/Krieger/issues/2) | Encerrada após PR #21 | Limitações de build/publicação seguem nas #16/#19 |
| [#6](https://github.com/felicioe/Krieger/issues/6) | Aberta | Executar roteiro com PDFs reais localmente ou fixtures fiéis anonimizadas |

As issues #1, #3, #4, #5 e #7 não estavam abertas na consulta inicial; há merges
relacionados no histórico. Isso não comprova que todos os recursos estão ligados
à UI servida. Quando os fontes forem recuperados, conferir essa correspondência.

## Limitações conhecidas

- Testes do domínio não validam navegador/PDF worker, backend/banco ou produção.
- Alertas npm audit: Vitest, @vitest/mocker e tinypool, registrados na #17.
- Hostinger foi inspecionada; deploy não realizado. A branch publicada ainda é a antiga.
- Fontes recuperados não comprovam build reproduzível ou correspondência com o bundle
  servido. frontend/src/domain duplica domain/; reconciliação ainda necessária.

## Ao retomar

Ler AGENTS.md, consultar GitHub e buscar origin/main. Verificar se #18 já foi
integrado; se não, trabalhar a partir da branch apropriada sem duplicar o PR.
Atualizar este snapshot quando uma limitação estrutural for resolvida e registrar
evidências na issue correspondente. Nunca depender apenas de mensagens de chat.
