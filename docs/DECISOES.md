# Decisões do projeto

## 2026-11-11 — cartório exato volta a vir antes da cidade na escolha do modelo de ata

O PR #263 (modelos de ata prontos) inverteu a regra da #256: o campo `tipo` passou a desempatar
antes do cartório, então `escolherModeloAta` escolhia `cidade+tipo` mesmo quando havia
`cidade+cartório` com o mesmo tipo. O cartório perdia para a cidade, contra o texto da issue.

Decidido: a prioridade volta a ser `cidade+cartório > cidade > geral`, e o `tipo` desempata
dentro de cada nível, nunca por cima do cartório exato. Dois testes cobrem o caso, que nenhum
deles alcançava antes. Corrigido na sessão de 11/11/2026 antes de a #256 ser encerrada.

## 2026-11-11 — modelos de ata por cidade copiando o layout praticado nas atas reais

O acervo de atas tem práticas de redação diferentes por município: Balneário Camboriú, Camboriú e
Itajaí escrevem em prosa corrida, enquanto Rancho Queimado usa títulos e listas. Decidido: cadastrar
um par ordinária/extraordinária por município, com o texto tirado das atas reais daquele município,
em vez de um modelo genérico para todos.

Decidido também que a ata **não leva logotipo nem rodapé do escritório e leva borda de página**, e
que o documento sai em Liberation Sans 12 pt — a métrica da Arial usada nas atas —, com o restante do
sistema mantendo a tipografia da interface. Sem timbre, o rodapé do escritório deixa de aparecer; a
numeração de páginas permanece.

A cidade do endereço do condomínio passa a ser reconhecida com `/`, travessão ou hífen antes da UF,
porque cadastros reais usam "Balneário Camboriú – SC" e sem isso o modelo por cidade não casava.

## 2026-11-10 — modelo de ata escolhido pela cidade do condomínio e pelo tipo da assembleia

A #256 criou a store `modelos_ata`, mas a escolha automática comparava o campo `cidade` do modelo
com a cidade do **edital** e, quando o edital não tinha cidade, com a do **escritório** — que é
Balneário Camboriú. Resultado: ata de um condomínio de Rancho Queimado saía assinada em Balneário
Camboriú e nenhum modelo por cidade casava. E os dois modelos de Lago Negro (ordinária e
extraordinária) disputavam a mesma cidade, sem nada que os separasse.

Decidido: a cidade de comparação passa a sair do **endereço do condomínio**
(`enderecoEdital`, via `extrairCidadeDoEndereco`), e o modelo ganha o campo **`tipo`**
(ordinária, extraordinária ou vazio = as duas). A assinatura do documento (`{{cidade}}`) **não**
muda: continua vindo do edital/escritório, porque ali a cidade é a do local da assembleia, não a
do imóvel.

Decidido também que os dois modelos do Lago Negro passam a vir **cadastrados**: `schema.sql` para
instalação nova e migration `20261110_modelos_ata_lago_negro.sql` para as existentes, com
`domain/modelosAtaSeed.ts` como fonte única e um teste que compara código, SQL e o documento de
origem — para o texto não se dividir entre três cópias.

`cidadeDoCondominio` devolve vazio quando o endereço não segue o padrão `... CIDADE/UF ...`; nesse
caso só o modelo geral responde. Cadastrar o endereço no formato é o que ativa o modelo por cidade.

## 2026-11-10 — plano de desenvolvimento por etapa, com modelo e esforço próprios

O responsável perguntou se dava para usar um tipo diferente de modelo em cada etapa do trabalho.
Decidido: sim, mas por risco, não por variedade. Etapa que decide o sistema (regra de negócio,
contrato de dados, backend, publicação) roda em Opus 5.5 com esforço alto; o projeto técnico roda
uma vez em Fable 5.1; etapa de leitura ampla (triagem, investigação) e de acabamento (documentação)
roda em Haiku 5.5 com esforço baixo; interface e validação rodam em Sonnet 5.5.

Cada etapa vira um arquivo em `.claude/agents/`, com `model`, `effort` e `tools` no frontmatter.
Por isso `.gitignore` deixou de ignorar `.claude/` inteiro e passa a ignorar só `.claude/*`,
liberando `.claude/agents/`: a definição só vale para os dois agentes (Claude e Codex) se estiver
versionada. `.claude/settings.local.json` continua ignorado.

A matriz completa, o contrato de passagem entre etapas e a regra de quando subir de nível ficam em
[PLANO-ETAPAS-MODELOS.md](PLANO-ETAPAS-MODELOS.md). Nenhum agente publica: deploy é irreversível e
fica na sessão principal, com o responsável presente e registro na issue.

## 2026-11-09 — três níveis de acesso, com o SuperADM editando a matriz de perfis

O pedido era separar um nível acima do administrador. Havia dois perfis (`admin` e `user`) e o
risco de renomear o valor gravado `admin` estava em reescrever a coluna, as guardas do PHP e a
sessão. Decidido: **o valor gravado continua `admin`** e a interface passa a chamá-lo **SuperADM**;
o perfil novo é `adm` (**ADM**) e o existente `user` continua **Usuário**. Nenhuma linha de
`kr_usuarios` muda e nenhum login quebra.

O SuperADM tem acesso total e é o único que administra usuários, perfis e a matriz. O ADM nasce
com **tudo menos as telas de administração** (`usuarios`, `backup`, `escritorio`); o Usuário
nasce igual ao ADM e é restringido caso a caso. A matriz fica em `kr_perfil_permissoes`, editada
na tela **Perfis e permissões** dentro de Usuários, chave por chave. As exceções individuais
(`kr_usuario_permissoes`) continuam valendo por cima do perfil.

`permissoes_usuario()` segue devolvendo `['*']` para `admin`, o que dispensa consultar a matriz
no caminho mais comum e mantém o comportamento anterior ao SuperADM.

## 2026-11-08 — modelo de edital por condomínio, com modelos gerais

O responsável reuniu modelos reais de ata e edital de um ou dois condomínios e perguntou como
aproveitá-los sem obrigar todos os clientes a um texto único. Entre uma biblioteca de cláusulas e
o modelo por condomínio, escolheu o segundo. Decidido que cada modelo pertence a um condomínio e
que `condoId` vazio significa **geral** — é o que todo modelo gravado antes desta entrega passa a
ser, sem migração de dados, e é o que atende um condomínio que ainda não tem modelo próprio.

A regra de quais modelos valem num condomínio fica em `modelosDoCondominio()`
(`domain/modelo.ts`), fonte única usada pela lista, pelo diálogo de novo edital e pelo seletor
dentro do edital. Sem condomínio escolhido, só os gerais aparecem: nunca oferecer o modelo de um
condomínio para o edital de outro. Um edital que já aponta para modelo de outro condomínio
continua exibindo essa escolha com etiqueta, em vez de descartá-la silenciosamente.

Não há migração de banco: `kr_modelos` guarda o registro em `dados` (LONGTEXT), então o campo
novo viaja no JSON. Uma cláusula compartilhada entre condomínios continua sendo cópia explícita
de um modelo para outro, não herança — decisão revista se a manutenção de cópias se mostrar
custosa.

## 2026-11-13 — a previsão do relatório final é a folha do Systemar, sem o cálculo do Krieger

O responsável reclamou do bloco "Referência histórica importada do Systemar" e mandou o print da
folha 7 do balanço: *"deixa essa parte do relatório final igual ao print"*. Decidido, substituindo a
decisão de 2026-11-08 (que exigia imprimir os critérios do cálculo):

- A seção de previsão do relatório final é **uma só**, no layout da folha: rateio atual → histórico
  por categoria → dedução → total ordinário → variação → rateio anual e mensal → índice, com
  pontilhado condutor entre rótulo e valor. A pedido posterior, a folha não imprime cidade/data ao final.
- O **cálculo do Krieger não é impresso** nessa seção. Ele continua existindo e sendo editável nos
  menus de Previsão orçamentária e Previsto × Realizado; o que saiu foi a impressão duplicada.
- A folha é montada por `domain/previsaoFolha.ts` (`montarFolhaPrevisao`), fonte única dos textos e
  da ordem das linhas para o PDF/Word (`frontend/src/documentos/relatorioFinal.ts`) e para a prévia
  na tela (`PreviaRelatorio.tsx`). Nenhum dos dois reescreve rótulo por conta própria.
- Os dados de origem continuam salvos (`Exercicio.previsaoSugerida`) e a importação/divergências não
  mudou.

**Arredondamento.** O rateio mensal sugerido passa a respeitar `Exercicio.arredondamento` (padrão
`truncar`), como o resto do sistema e como a folha: 590.938,48 ÷ 12 = 49.244,87, impresso 49.244,00.
A conferência contra os totais do PDF usa tolerância de R$ 1,00 nesse campo justamente porque o
truncamento é legítimo, não erro de leitura.

**Duas variantes do rateio atual.** A folha ora traz o total mensal do condomínio (única forma que
permite o índice), ora o valor por unidade com o número de lotes. As duas são lidas
(`rateioMensalAtual` e `rateioUnidadeAtual`/`unidadesRateio`), sem misturar as grandezas: o índice só
aparece quando existe o total mensal.

## 2026-11-13 — consolidar pelos mensais é ação explícita, não efeito de abrir a tela

A prestação de contas do Lago Negro 2025 foi gravada com o demonstrativo errado porque a tela somava
os relatórios mensais do período no próprio render e o Salvar gravava essa soma. O exercício tinha
11 meses e um único mensal dentro dele (o primeiro mês de um comparativo): a soma representava um mês
e substituiu as contas do balanço, gerando 77 divergências na reimportação.

Decidido: **o demonstrativo gravado é a fonte da prestação**. Uma série de mensais só substitui o
salvo quando cobre o período inteiro (um relatório por mês); com cobertura parcial a consolidação é
recusada e o usuário é avisado. Consolidar é a ação do botão **Atualizar dados**, com o resultado
passando pelo Salvar como qualquer edição — nunca um efeito colateral de abrir a tela. O diagnóstico
de cobertura vem de `consolidarPeriodo` (`frontend/src/domain/demonstrativoDinamico.ts`), que também
é o que a tela usa para explicar por que não consolidou.

## 2026-11-08 — relatório final repete os critérios da previsão, não só os números

O responsável apontou que o relatório final divergia dos menus de manutenção da previsão
orçamentária. O cálculo já era o mesmo (`calcularPrevisao` sobre `demonstrativoBasePrevisao`); o que
faltava era o documento dizer com que parâmetros o valor foi obtido. Decidido: o relatório final
mostra, junto dos números, modo, método da variação, índices usados na média, variação aplicada e
arredondamento, e usa a mesma tabela da tela (realizado × média prevista mensal por grupo, com total
dos grupos). Os rótulos ficam em `domain/previsaoCriterios.ts`, fonte única para a tela de Previsão
orçamentária, o cadastro do condomínio e o relatório — nenhum lugar reescreve o texto por conta
própria. A previsão sugerida importada do Systemar continua como referência histórica e nunca
substitui o cálculo do Krieger.

## 2026-10-22 — Histórico interno e menu do usuário recolhível (#81)

O responsável determinou que o Registro de Alterações fique dentro do sistema,
após login, e que o bloco inferior do usuário abra sob demanda para economizar
espaço. O login conserva autoria Therafinancial e versão. Essa decisão substitui
a localização pública inicialmente solicitada na #77; não altera a evidência
da crítica já realizada sobre a tela então publicada. O menu mantém permissões,
troca de senha e saída existentes. Autoria frontend Lovable; integração, testes,
PR e publicação Hostinger pelo fluxo documentado. Entrega Lovable #81 integrada
ao PR #80, com publicação condicionada ao CI do SHA final.

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

## 2026-10-24 — Lovable descontinuado: frontend e todo o código passam a ser do Claude

Decisão do responsável: o Lovable deixou de fazer parte do projeto, em qualquer
frente. **Isto revoga as duas decisões acima** ("2026-10-21 — frontend
exclusivamente no Lovable" e "2026-10-21 — sincronização permitida; exclusividade
se refere à autoria"): não existe mais frontend exclusivo do Lovable, nem
sincronização de arquivos com um projeto Lovable — essas entradas ficam só como
histórico de como o projeto funcionou até 24/10/2026, não como regra vigente.

A partir desta data, Claude edita `frontend/src/**` diretamente, do mesmo jeito
que o resto do repositório (`domain/`, `lib/`, PHP), seguindo os padrões já
estabelecidos (lógica de negócio nos shims `@/domain`/`@/lib`, nunca duplicada
inline). Codex mantém auditoria, revisão, CI, integração e publicação, e passa a
poder revisar/testar o frontend também (deixou de ser território exclusivo do
Lovable) — mas quem implementa correções de frontend é o Claude. Detalhes
técnicos em `docs/ARQUITETURA.md` ("Frontend: Claude, não mais Lovable") e regra
operacional em `AGENTS.md`.

## 2026-10-22 — versão pública e marcos de alteração

O responsável definiu1.0 como implantação do sistema. Rodapé do login identifica
Therafinancial e versão; Registro de Alterações acessível sem sessão. Versões
seguintes, como1.01, representam mudanças estruturais/importantes, não pequenos
ajustes. A fonte única é frontend/src/data/versoes.json, mantida no Lovable;
CHANGELOG.md é gerado a partir dela e verificado pelo CI. Não preencher releases
futuros nem renumerar os commits anteriores. Procedimento em VERSIONAMENTO.md.
