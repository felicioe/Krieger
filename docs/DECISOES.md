# Decisões do projeto

## 2026-10-20 — conexões separadas da publicação

Auditoria #24 confirmou acesso Codex/GitHub/Hostinger e Claude Code autenticado
com MCP Hostinger conectado. A Hostinger já possui auto-deploy, mas segue a branch
antiga; main é a integração desejada. Não renovar tokens ou reinstalar conectores
que respondem corretamente apenas para resolver essa divergência de branch.
Trocar a branch pelo hosting_deploy também publica e requer confirmação específica,
backup e preservação de config.php. Estado detalhado em CONEXOES.md e #19.

PRs #21/#23 trouxeram frontend/ para main; isso resolve localização dos fontes,
mas não demonstra build reproduzível nem centralização das regras duplicadas (#16).

## 2026-10-20 — main como integração

Decisão: `main` é a branch padrão e origem de publicações. Foi criada no commit
823d88d, preservando o estado da antiga `claude/youthful-pascal-lkmbs7`.
As branches antigas foram preservadas para rastreabilidade. PR #18 foi redirecionado.
Não foi feito deploy nessa mudança. A integração Hostinger é acompanhada na #19.

## 2026-10-20 — domínio separado do frontend

Mantém-se a regra da #1: TypeScript puro em `domain/`; UI consome essas funções.
Não mover bundles para `frontend/` apenas para satisfazer um nome de pasta.
A recuperação dos fontes e do processo de build está na #16, vinculada à #2.
O projeto Lovable na especificação é referência histórica, não dependência do
fluxo operacional atual de desenvolvimento Claude/Codex.

## 2026-10-20 — pacote explícito e deploy desacoplado

O pacote contém apenas arquivos necessários à execução, incluindo PHP e .htaccess.
Configuração real e dados não entram no Git nem no artefato. O CI valida e gera
artefato, sem credenciais de produção. Publicação ocorre pelo conector/API a partir
de main, após verificar capacidades reais e preservar o ambiente (#15, #19).

## 2026-10-20 — documentação como parte da entrega

AGENTS.md concentra regras comuns; CLAUDE.md aponta para ele. README indexa os
documentos, issues mantêm pendências e PRs registram mudanças/testes. Estado atual
é um snapshot datado, não substitui consulta ao GitHub. Check automático valida
links locais e presença dos documentos; revisão humana/agente avalia conteúdo.
