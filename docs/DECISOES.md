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

## 2026-10-20 — branch de deploy dedicada (deploy-hostinger) e incidente de config.php

Decisão: em vez de apontar o auto-deploy do Hostinger direto para `main` (que tem
a árvore inteira do repositório — testes, domain/, docs/, scripts/), foi criada uma
branch órfã `deploy-hostinger`, cuja raiz é exatamente o conteúdo de
`npm run package:hostinger` (gerado a partir de `main`). O auto-deploy do Hostinger
foi apontado para essa branch, com a confirmação do responsável.

**Incidente ocorrido na troca**: ao mudar a branch/repositório do auto-deploy, a
ferramenta não preservou `config.php` (nunca esteve no Git) como a descrição da
API sugeria ("reset + pull, preservando o que não é rastreado") — na prática, a
troca de branch limpou a pasta inteira do site antes de clonar o novo conteúdo, e
`config.php` foi apagado junto. O site ficou fora do ar (erro de conexão com banco)
até o responsável recriar `config.php` manualmente pelo Gerenciador de Arquivos do
hPanel. O banco de dados em si não foi afetado, só o arquivo de conexão.

**Regra daqui pra frente**: qualquer troca futura de branch ou repositório no
auto-deploy do Hostinger deve ser seguida imediatamente de reupload manual de
`config.php` — não confiar na preservação automática de arquivos fora do Git.

**Pendência conhecida**: a branch `deploy-hostinger` não é atualizada automaticamente
quando `main` muda — é um processo manual (rodar `npm run package:hostinger` e
sobrescrever o conteúdo da branch). Não há CI/automação disso ainda. Detalhes em #19.

## 2026-10-21 — frontend React novo em produção; config.php some em qualquer push, não só na troca de branch

Decisão do responsável: publicar o frontend React (build de `frontend/`) em produção,
substituindo o sistema legado (HTML/JS estático). Commit publicado: `10a40ca` (main) →
pacote gerado por `npm run package:hostinger` → branch `deploy-hostinger` em `b784b74`.
Essa publicação trouxe a tela "Previsão Orçamentária" (menu próprio, lê/edita a folha
do Systemar) e o backup com histórico no servidor (gerar/baixar/restaurar/excluir).

**Correção à regra registrada em 2026-10-20**: na época, o `config.php` sumir foi
atribuído à troca de branch/repositório do auto-deploy. Hoje, um push normal à mesma
branch já configurada (`deploy-hostinger`, sem trocar nada na configuração) também
apagou `config.php`. Ou seja, **qualquer deploy pelo auto-deploy do Hostinger (troca
de configuração OU push novo na branch já configurada) limpa a pasta do site antes de
aplicar o novo conteúdo**, não preservando arquivos fora do Git — a regra vale pra
_todo_ deploy, não só pra trocas de configuração.

**Regra atualizada**: depois de qualquer publicação via `deploy-hostinger` (push ou
atualização das configurações de auto-deploy), checar se `config.php` ainda existe
(`hosting_files_list-website-and-directories` na raiz do site) e, se não existir,
pedir ao responsável para recriá-lo pelo Gerenciador de Arquivos do hPanel. O
Claude/Codex nunca devem digitar ou repassar a senha real do banco — só o
responsável a insere diretamente no servidor.

## 2026-10-21 — frontend exclusivamente no Lovable

Regra permanente determinada pelo responsável: Codex/ChatGPT nunca edita o
frontend do Krieger. O Lovable é responsável pelas correções de componentes,
estilos, layout, assets e comportamento da interface. Pedidos genéricos de
correção não revogam essa regra. Codex faz auditoria, revisão, testes e
rastreabilidade no GitHub; backend, integração e publicação continuam sujeitos
às suas instruções específicas. Não foi feita alteração de frontend nesta etapa.
As issues #30/#31/#32/#47/#48 devem ser implementadas no Lovable e posteriormente
revisadas com evidências antes de encerrar os critérios de aceite.

## 2026-10-21 — sincronização permitida; exclusividade se refere à autoria

O responsável esclareceu que a sincronização dos arquivos de hoje entre Lovable,
Claude e GitHub não deve ser proibida. A regra de frontend exclusivo no Lovable
limita quem implementa a interface, não o transporte fiel dos arquivos produzidos.
Sincronização é permitida e necessária; comparar versões e preservar avanços,
sem inventar correções de frontend localmente no Codex.

## 2026-10-22 — versão pública e marcos de alteração

O responsável definiu1.0 como implantação do sistema. Rodapé do login identifica
Therafinancial e versão; Registro de Alterações acessível sem sessão. Versões
seguintes, como1.01, representam mudanças estruturais/importantes, não pequenos
ajustes. A fonte única é frontend/src/data/versoes.json, mantida no Lovable;
CHANGELOG.md é gerado a partir dela e verificado pelo CI. Não preencher releases
futuros nem renumerar os commits anteriores. Procedimento em VERSIONAMENTO.md.
