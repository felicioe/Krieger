# Estado atual e passagem de contexto

## Login e versionamento — 22/10/2026, issue #77

O login exibe autoria Therafinancial e versão 1.0. O Registro de Alterações
fica na área autenticada. `frontend/src/data/versoes.json` é a fonte única do
rodapé, histórico e `CHANGELOG.md` gerado. O CI verifica a consistência.
1.0 representa a implantação; versões futuras como 1.01 exigem um marco
importante, não pequenos ajustes. Ver [VERSIONAMENTO.md](VERSIONAMENTO.md).
Frontend de autoria Lovable (mensagem `umsg_01m5jaqmn5fzk8y3sayz84bgt2`,
diff base `38178ac` → `a688fb0`; diff por mensagem confirmado idêntico).
O roadmap concorrente do Claude foi preservado, sem substituir seu estado
do Importador/anexos pelo snapshot desatualizado do Lovable.
Entrega inicial pelo PR #78: main `c930a84` → CI `39825154179` aprovado →
artefato `krieger-hostinger` → deploy-hostinger `048e732` → conector
Hostinger. HTML público idêntico ao artefato (SHA256
`579BA54261C84D80C753831E6B10C4DF5272C82851D4DFC4662A60BF2B0A1CC7`).
Rollback `6b814f1`. Sem migração de banco/configuração.
Crítica independente do login/histórico: 31/40, zero achados do detector,
duas prioridades P2, nenhuma P0/P1 demonstrada. Relatório em
[auditorias/IMPECCABLE-LOGIN-2026-10-22.md](auditorias/IMPECCABLE-LOGIN-2026-10-22.md).
Hardening das prioridades via Lovable na issue #79 implementado (diff base
`20be9fe` → `aa97b80`): orientação de acesso, mostrar/ocultar senha,
obrigatoriedade/erros/foco, ocupado e histórico longo. Validação local:
153 testes frontend, tipos e build aprovados nessa etapa. Publicado junto da
mudança #81 pelo PR #80, conforme a cadeia final abaixo.

Pedido posterior #81, publicado pelo PR #80: Registro de Alterações
somente após login, dentro do menu inferior do usuário recolhível, fechado por
padrão. O login mantém apenas autoria e versão. Essa decisão substitui a localização pública inicial,
sem reescrever a evidência histórica da crítica já realizada. Diff de autoria
Lovable: `aa97b80` → `6c29269`, incluindo reorganização das instruções de UI.
Contextos de Importador não presentes em main e o roadmap concorrente não
foram importados; somente o diff funcional solicitado foi sincronizado.

Cadeia final: main `3dbeaad81fed73fabf474ac3f8a50ada94414eae` → CI
`39830694020` aprovado (158 testes frontend, domínio, PHP/MySQL, tipos, build,
docs, changelog e pacote) → artefato `krieger-hostinger` → deploy-hostinger
`bfde51c9696455af5882daf2202eaf5bfd2742aa` → conector Hostinger.
HTML público SHA256 `46AADC8E6949C2A14CC1DD02B1ED05E1885D05BA9157B873E7AC6005132BFFC4`
idêntico ao artefato; rollback `048e732`. Sem migração de banco/configuração.

Validação independente em produção: login sem acionador do histórico,
mostrar/ocultar senha, erro local de senha vazia; sessão autenticada com menu
fechado por padrão, Enter/Espaço, histórico 1.0 e retorno de foco. Em 320 × 740,
gaveta fecha antes do histórico (uma janela), Escape volta a “Abrir menu” e
não resta bloqueio de ponteiro. Viewport restaurado. Nenhum cadastro salvo,
logout ou alteração de senha. Leitor real e toque físico não executados.
Possível overflow extremo do Painel relatado pelo Lovable está na #82 para
reprodução independente. A nota 31/40 é da crítica anterior, não do menu final.
Evidência operacional completa no [PR #80](https://github.com/felicioe/Krieger/pull/80).

Snapshot de 21/10/2026 (atualizado após publicar o frontend React novo em produção, substituindo o sistema legado). Conferir issues/PRs online antes de continuar.

## O que existe

- `main` é a branch padrão e de integração (commit atual: `git log -1 origin/main`). Branches de trabalho são temporárias por issue, apagadas (local e remota) depois do merge.
- Domínio TypeScript (`domain/`+`lib/`) com 117 testes, `tsc --noEmit` limpo, `npm audit` sem vulnerabilidades.
- **`frontend/` compila de verdade** (PR #39): `npm run build` gera `.output/public/index.html` + `assets/*.js` — SPA estática compatível com a hospedagem PHP (hash routing `#/login`, `#/painel` etc.). 76 testes de frontend passando.
- **Duplicação `domain/`↔`frontend/src/domain` eliminada** (PR #41): os arquivos de `frontend/src/domain/` e de `frontend/src/lib/` (format.ts, id.ts) são re-exports de uma linha pra raiz (`export * from`), não cópias de conteúdo. `domain/`+`lib/` na raiz é a única fonte real no repositório GitHub. Isso não muda o projeto Lovable ao vivo (sandbox isolado, só vê os próprios arquivos) — colar conteúdo atualizado no chat do Lovable continua sendo a única forma de manter o preview deles sincronizado, e puxar de volta pra `frontend/` (sync manual, arquivo por arquivo via MCP do Lovable) continua sendo o único jeito de levar as mudanças deles pro Git.
- **Previsão orçamentária sugerida** (`domain/previsaoSugerida.ts`, PR #45 + sync de 21/10/2026): campo próprio no exercício (`Exercicio.previsaoSugerida`), populado ao importar a folha do PDF do Systemar, editável (deduções +/-, variação +/-), com menu dedicado no frontend (`_authenticated.previsao-orcamentaria.tsx`) e consolidado no Relatório Final — inclusive na conferência (compara o rateio aprovado com o valor por unidade dessa previsão quando ela existir; sem ela, cai pro cálculo antigo a partir do demonstrativo).
- **Backup com histórico no servidor** (PR #44 + tela refeita em 21/10/2026): gerar/baixar/restaurar/excluir backups gravados em `kr_backups` (MySQL), vinculados a quem gerou. Tabela `kr_backups` **ainda não foi aplicada no banco de produção** — precisa rodar o `CREATE TABLE` do `schema.sql` via phpMyAdmin antes da função funcionar contra a API real.
- **Frontend React novo publicado em produção em 21/10/2026**, substituindo o sistema legado (HTML/JS estático): commit `main` 10a40ca → `npm run package:hostinger` → branch `deploy-hostinger` em `b784b74`, auto-deploy do Hostinger aplicou.
- **Incidente de `config.php` se repetiu em 21/10/2026**: dessa vez não foi troca de branch/configuração, foi um push normal à branch já configurada — mesmo assim o `config.php` sumiu de novo. Conclusão atualizada: **qualquer** publicação via auto-deploy do Hostinger limpa arquivos fora do Git, não só trocas de configuração. Ver `docs/DECISOES.md` (entrada de 21/10/2026). Checar sempre depois de publicar.
- **CI corrigido em 21/10/2026** (PR #51, issue #49): `validate.yml` vinha falhando em todo push/PR (silenciosamente, ninguém checava `gh run list`) porque nunca compilava `frontend/` antes de `npm run package:hostinger`, que exige o build já pronto. Agora instala e compila o frontend antes de empacotar. Removido `frontend/bun.lock` (nunca usado pra instalar nada aqui; npm + `frontend/package-lock.json` é o real). Verificar `gh run list` depois de cada push a partir de agora — isso deveria ter sido pego antes.

## Pendências e sequência sugerida

| Issue | Estado | Próxima ação |
| --- | --- | --- |
| [#19](https://github.com/felicioe/Krieger/issues/19) | Frontend novo publicado em produção; config.php precisou ser recriado de novo | Confirmar com o responsável que o `config.php` foi restaurado; aplicar `CREATE TABLE kr_backups` no banco de produção; registrar plano formal de rollback |
| [#49](https://github.com/felicioe/Krieger/issues/49) | CI corrigido (PR #51), verde pela primeira vez nesta sessão | Falta só registrar a cadeia SHA main → artefato → deploy-hostinger → validação em produção |

Fechadas: #1, #2, #3, #4, #5, #6, #7, #15, #16, #17, #20, #22. #19 e #49 seguem abertas (checklists de validação pós-deploy/CI).

## Limitações conhecidas

- Testes do domínio não validam navegador/PDF worker, backend/banco ou produção.
- Atualizar a branch `deploy-hostinger` depois de mudanças relevantes em `main` é manual; esquecer isso deixa a produção desatualizada silenciosamente.
- **Qualquer** publicação pelo auto-deploy do Hostinger (push ou atualização de configuração) não preserva arquivos fora do Git (ex.: `config.php`) — checar e, se preciso, reupload manual depois de toda publicação.
- Backup no servidor depende da tabela `kr_backups`, ainda não criada no banco de produção.

## Ao retomar

Ler AGENTS.md, consultar GitHub (`gh issue list --state all`) e sincronizar `origin/main`
(`git fetch && git merge --ff-only origin/main` — nunca `reset --hard`, fica bloqueado
pelo classificador de segurança do Claude Code). Trabalhar em branch própria por issue,
a partir de `main`, apagando a branch (local e remota) depois do merge — uma de cada vez
se estiver apagando várias, o classificador bloqueia exclusões em lote/rápidas demais.
Atualizar este snapshot quando uma limitação estrutural for resolvida e registrar
evidências na issue correspondente. Nunca depender apenas de mensagens de chat.

## Revisão das pendências da auditoria — 21/10/2026

Main revisada 59ba487; deploy-hostinger 205d3e0 declara essa origem, e o runtime
observado index-Doxn9lA8.js coincide com seu index.html. PR #51 corrigiu o build
no CI (run 39634221490 aprovado). #49 permanece parcialmente pendente pela
rastreabilidade completa do artefato/publicação. #30/#31/#32/#47/#48 persistem
na produção; #33 exige medição. Ver [relatório e adendo de revisão](auditorias/IMPECCABLE-PRODUCAO-2026-10-21.md).
As referências anteriores de deploy e estado do banco são snapshots históricos,
não uma revalidação do banco nesta revisão. A configuração real agora é buscada
fora da pasta publicada conforme PUBLICACAO.md; não voltar ao procedimento
antigo de manter credenciais dentro do diretório sobrescrito.

## Coordenação das correções — frontend exclusivo no Lovable

Regra permanente integrada no PR #55. Correções #30/#31/#32/#47/#48 solicitadas
ao Lovable; ver [protocolo e rastreabilidade](LOVABLE-FRONTEND.md). Nenhuma
correção de UI deve ser implementada localmente pelo Codex. Auditoria #50 já
integrada. Base 04ebbd4 validada: 122 testes de raiz, 76 de frontend, typecheck,
docs, build e pacote locais passaram; CI main run 39682696894 aprovado. Esses
resultados são da base anterior às correções do Lovable, ainda em execução no
momento deste registro; não comprovam sua entrega ou publicação.

## Correções Lovable integradas para revisão

PR #56 recebe o diff Lovable 39f8a740: tabelas acessíveis, Field/Selecao,
MenuMovel com foco, layout/alvos móveis e variantes reais da marca. Frontend
permanece de autoria exclusiva do Lovable. Validação local: 122 testes raiz +
90 frontend, tipos, docs, build e pacote aprovados. Publicação e verificação na
Hostinger ainda não comprovadas neste registro; conferir comentários #19/#46/#56.
#32 mantém limites de checkboxes/switches, toque físico e zoom; #33 não tem medição
real de Core Web Vitals. Não encerrar essas pendências sem evidência adicional.

## Publicado: correções da auditoria

PR #56 integrado; main 4aec83a publicada via artefato CI 39686204575 e
branch deploy-hostinger d0284be. HTML/JS/CSS confirmados no ar. Ver
[registro de publicação e limites](auditorias/PUBLICACAO-CORRECOES-2026-10-21.md).
Revisão autenticada aguarda login no site publicado; não tratar como critérios
encerrados. #32/#33 mantêm pendências explícitas. Nenhuma autoria de frontend
pelo Codex nem mudança em banco/configuração foi feita.

## Previsão orçamentária: novo método "valor" (R$ direto) — 21/10/2026

PR #58 (merge 5604e72, em cima da base de acessibilidade do Codex acima):
`VariacaoMetodo` ganha `"valor"` — a variação, nesse método, é um R$ direto
somado à base líquida (sem multiplicar, sem distribuir por despesa/grupo),
em vez de percentual. Não reinterpreta o método `"manual"` existente (seguiria
sendo percentual para quem já usa assim); é um método novo, separado. Motivo:
usuário reportou um condomínio (Solar Juliana) com "Variação 14.000%" —
confirmado que não é bug de importação (domain/importacao.ts e o fluxo de
criação de exercício gravam previsão sugerida e variação em campos
completamente separados); foi um R$ 14.000,00 real do PDF digitado no campo
de percentual por engano. O método "valor" existe pra esse tipo de ajuste
subjetivo da empresa poder ser digitado em R$ sem essa confusão.

**Pendente (mensagem já enviada ao Lovable, sem resposta registrada ainda):**
a tela de Previsão Orçamentária (`PainelPrevisao.tsx`) precisa da opção
"valor" no seletor de método, um campo de dinheiro (não percentual) pra ela,
e trocar a exibição "(+) Variação X%" por "(+) Variação R$ X" quando o
método for "valor", em 3 lugares: `PainelPrevisao.tsx`,
`PreviaRelatorio.tsx`, `documentos/relatorioFinal.ts`. Até isso ser feito,
o método novo existe no domínio mas não é selecionável pela tela.

Também enviado ao Lovable (sem resposta registrada ainda): a tabela
"Previsto × Realizado" no PDF/Word exportado não cabe numa folha pra
condomínios com muitas rubricas — pedido específico de ajustar
`lineHeight` das células em `src/lib/documento/pdf.ts` (`word.ts` já faz
isso, `pdf.ts` não).

Validado antes de publicar: 124 testes raiz (12 novos desde a base de
acessibilidade), typecheck e docs:check limpos, frontend rebuilado com
`npm ci` (pegou a dependência nova `@testing-library/user-event` que o
Codex/Lovable adicionou) — 90 testes de frontend, typecheck limpo.
Publicação em deploy-hostinger feita logo em seguida a este registro.

## Continuidade em22/10/2026 — contraste e UX

Crítica independente26/40 e auditoria sequencial foram consolidadas em
[auditoria/continuidade](auditorias/IMPECCABLE-CRITIQUE-AUDIT-2026-10-22.md).
Issues #59–#62 e resíduos #32/#47 foram encaminhados ao Lovable. Sincronização
permitida, preservando reordenação acessível em execução e mudanças da Claude.
Não presumir implementação concluída: consultar GitHub e status do Lovable.

Na branch do PR #63, reordenação acessível recebida do Lovable SHA
7ee0c30a269437b7e0faf7e2c9696bee8a62033e e sincronizada no commit 557e090;
97 testes frontend e typecheck passaram. O CI passa a exigir esses comandos
antes do build. A base incorpora main 123311c (PR #64, parser comparativo da
Claude), com 125 testes raiz aprovados. Novo alerta Vite documentado na #65;
produção usa build estático/PHP, sem servidor Vite. Não executar correção
forçada de dependências sem revisão pelo Lovable.

O método valor e a compactação PDF citados acima como pendentes já receberam
implementação nos commits 11ad02e/0f376e8. Preservá-los nas próximas integrações.
Reteste móvel publicado confirmou URL/h1/foco do menu após estabilização;
evidência na #47. Correções #59–#62 aguardavam entrega final do Lovable nessa data.

## Correções de importação — PR #74 (22/10/2026)

Issues #68–#71 implementadas na branch codex/issue-68-71-importacao, PR #74
mergeada e **publicada** (commit `9c0c1c1` → `deploy-hostinger` `204bb76`,
confirmado em 22/10/2026 pelo asset novo `textos-*.js` no ar em
krieger.therafinancial.com.br). Domínio representa cobertura da conferência; endpoint
confirmar_importacao é transacional e idempotente, com contrato em
[CONFIRMACAO-IMPORTACAO.md](CONFIRMACAO-IMPORTACAO.md). CI MySQL efêmero verifica
rollback entre etapas, retry e proteção contra descarte atrasado.

Frontend sincronizado fielmente do Lovable: entrega UX acumulada até aaefd0c
e correções de importação até ace43b3. O domínio duplicado do Lovable não
substituiu os shims/código canônico. 133 testes raiz passaram após incorporar
a PR73 da Claude; frontend126 e
typecheck passaram com Node22, runtime do CI. Node26 local apresentou
incompatibilidade de localStorage no ambiente de três testes; não ocultar essa
limitação. Não foi demonstrada falha equivalente no navegador de produção.

A entrega anterior de contraste/UX (#59–#62, resíduos #32/#47) está incluída
na mesma branch, superando o estado de espera registrado acima. Revisão final
é no domínio Hostinger; não abrir Lovable no navegador. Após publicar, executar
critique independente e depois harden, já autorizados pelo responsável.

A dependência da tabela de anexos da PR73 está acompanhada na #75. A publicação
das correções mantém backup legado compatível sem essa tabela opcional;
restauração que contém anexos exige a migração e não ignora dados. Não declarar
o recurso de anexos/hub Importador pronto por causa desta integração.

## Comparativo Financeiro, auditoria de importação e menu "Importador" — 22/10/2026

Pedido do usuário após o incidente dos 14.000%: suportar o layout "Comparativo
Financeiro" (multi-mês) do Systemar, ter um ponto de entrada único pra
importação e uma auditoria obrigatória entre o que foi importado e o que foi
gravado. Decisão de arquitetura (não reabrir sem motivo forte): o Comparativo
Financeiro vira **anexo de referência** de uma Prestação de Contas já
existente, não um `Demonstrativo` — ele é inerentemente multi-mês, não um
snapshot de exercício único.

- **PR #66 (merge b082784):** `domain/importacao.ts` ganha
  `divergenciasImportacao(original, atual)` — compara os 4 totais do
  demonstrativo entre o snapshot importado do PDF e o que está prestes a ser
  salvo, pra pegar erros de digitação tipo os 14.000% antes de gravar, não
  depois. Generaliza a conferência interna do parser (que só valida o PDF
  contra ele mesmo). Pedido de integração enviado ao Lovable (telas de
  Relatório mensal e Prestação de contas); função colada diretamente no chat
  porque o sandbox deles não puxa de `main` automaticamente — ver
  `docs/LOVABLE-FRONTEND.md` se o protocolo mudar.
- **Dois bugs reais de parsing do layout "comparativo" corrigidos** (PR #64,
  merge 123311c): regex de período e de filtro de lixo não toleravam o
  espaçamento largo entre colunas que PDFs reais desse layout usam (dois
  condomínios reais confirmaram, com `conferencia.divergentes: []` limpo
  antes e depois — o fix só removeu lixo, nunca mexeu em total real).
- **Schema novo:** tabela `kr_anexos_importacao` (mesmo padrão
  id/dados/atualizado_em de todas as outras) + store `anexos_importacao` em
  `domain/types.ts`/`api.php`/`domain/backup.ts`. **Aplicada em produção em
  22/10/2026** (usuário rodou o `CREATE TABLE` via phpMyAdmin). `domain/importacao.ts`
  ganha `novoAnexoImportado(...)` pra montar o registro — falta só a tela
  do Lovable (pedido do menu Importador já enviado) pra gravar/exibir de
  verdade.
- **Menu "Importador" (hub único):** pedido enviado ao Lovable em 22/10/2026
  (fila normal) — nova rota reunindo os pontos de entrada hoje espalhados
  (Relatório mensal, Prestação de contas, e o novo Comparativo Financeiro
  como anexo), sem mudar onde os relatórios já processados vivem.

Validado: 130 testes raiz, typecheck e docs:check limpos, `php -l api.php`
sem erro de sintaxe.

## Tabela Previsto × Realizado compacta e gráficos robustos — publicado em 22/10/2026

PR #76 (merge 54bae8b): sincronizado do sandbox do Lovable. `TabelaComparativo`
ganha prop `compacta` (preview do Relatório Final: sem "/mês", sem coluna
Situação → marcador `*` com legenda, já que depende da tolerância de ±5% e
não dá pra inferir só pela cor). PDF/Word redistribui as 6 colunas da tabela
comparativo com folga pra Rubrica. Gráficos: barras horizontais (escalam pra
qualquer quantidade/tamanho de nome de grupo), legenda de todo gráfico do
sistema quebra linha em vez de cortar, paleta de cor ganha `--chart-6` a
`--chart-10` + geração algorítmica a partir da 11ª categoria — nunca repete
cor na mesma pizza/gráfico. Teste novo `documentosLargura.test.ts` confere
automaticamente que toda tabela de todo documento gerado (Relatório final,
Previsto × Realizado avulso, Relatório mensal, Edital, Ata etc.) cabe na
página A4.

Publicado: commit `54bae8b` → `deploy-hostinger` `6b814f1`, confirmado no ar
(assets `relatorioFinal-w7UqQxmU.js`, `styles-D4-nGTCj.css` batendo com os
hashes do commit).

Também nesta sessão: as issues #68–#71 (estados da conferência de
importação, confirmação atômica, divergência, foco) foram implementadas e
publicadas pelo Codex (PR #74, commit `9c0c1c1` → `deploy-hostinger`
`204bb76`) — já estava no ar antes deste registro, só não estava confirmado
aqui (corrigido acima).

## Faxina de PRs/issues/branches perdidas — 22/10/2026

A pedido do usuário: 23 branches remotas já mergeadas em `main` (nunca
apagadas após o merge) foram removidas. PR #34 (auditoria Impeccable de
20/10, em conflito com os docs atuais) foi fechado sem merge — seu conteúdo
já tinha sido recuperado pelo PR #85 do Codex sem sobrescrever a
documentação atual, então mergeá-lo agora só reintroduziria um snapshot de
2 dias atrás. Issues fechadas com evidência (publicado/confirmado):
#19, #24, #29, #47, #48, #49, #67 (e as sub-issues #68–#71, já fechadas pelo
Codex). Issues #46 e #75 receberam comentário de status (só falta #33 na
#46; só falta a integração de frontend do Comparativo Financeiro na #75) —
continuam abertas de propósito. Restam abertas: #31, #32, #33, #46, #59–#62,
#65, #75, #82 — todas com trabalho ativo em andamento (revisão focal pedida
pelo usuário ao Lovable, ou PR #85 do Codex).

## Menu Importador concluído e publicado — 22/10/2026

PR #86 (merge dd994bb): terceiro card do Importador (Comparativo Financeiro)
completo — lê e valida o PDF (recusa quando o layout não é `comparativo`),
sugere condomínio/ano a partir do próprio PDF, grava o anexo com o PDF
original (`arquivoDataUrl`) e lista em "Anexos de referência" na tela da
prestação de contas, com Baixar e Excluir. Também trouxe as correções #82
(overflow do Painel) e #65 (Vite 8.3.5) que o Lovable fez no mesmo lote.

**Descoberta operacional:** o GitHub do Lovable (`felicioe/krieger-projeto-atual`,
feature "sync to GitHub" dele, confirmado pelos commits idênticos ao sandbox)
dá acesso direto via `git clone`/`git diff` ao código do Lovable — bem mais
rápido e preciso que ler arquivo por arquivo via MCP `read_file`. Usar esse
caminho quando disponível; `src/domain/*`, `src/lib/format.ts` e
`src/lib/id.ts` continuam excluídos de qualquer cópia (shims canônicos,
nunca o código duplicado do Lovable). `krieger-projeto-atual` não tem CI,
webhook nem relação com a produção (Hostinger publica só de
`felicioe/Krieger`) — seguro apagar após este registro, a critério do
usuário.

**Decisões em aberto, levantadas pelo Lovable:** excluir uma prestação de
contas deve excluir os anexos dela junto? Há limite de tamanho desejado pro
PDF anexado?

Publicado: commit `dd994bb` → `deploy-hostinger` `64e3b82`, confirmado ao
vivo (`_authenticated.importador-*.js` no ar).
