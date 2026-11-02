# Estado atual e passagem de contexto

## PR #119 mesclado e publicado — 02/11/2026

PR #119 (assinatura final não dividida entre páginas, descrito abaixo) mesclado em `main` por
squash (`67455d2`). Codex revisou sem achados (`has_any_findings: false`), CI verde, sem threads
de review — mesclado assim que o CI fechou.

Build + `npm run package:hostinger` + push no `deploy-hostinger` (`9680528`) — auto-deploy
confirmado ao vivo: `index.html` referencia `index--HftxEY6.js`, hash exato do build desse commit;
`auth.php?a=eu` responde 401 (API normal). Nenhum arquivo PHP mudou (só frontend — `pdf.ts`,
`word.ts`, `tipos.ts` e os dois geradores de documento).

## Assinatura final separada de "Local, data" entre páginas do PDF/Word — 02/11/2026

Pedido do responsável: "a assinatura final não pode ser dividida" entre páginas do relatório
final; perguntei qual era o sintoma exato — confirmou "cortada no meio entre duas páginas".

**Investigação**: o bloco de assinatura em si (`unbreakable: true` no PDF, `cantSplit: true` na
linha da tabela do Word) já não quebra sozinho — testei isoladamente com `pdfmake` real, dezenas
de pontos de conteúdo diferentes, nunca quebrou. O bug real é outro: "Local, data" (ex.:
"Curitiba, 02/11/2026.") era um **parágrafo separado**, empurrado para o documento *antes* do
bloco de assinatura, sem nenhum vínculo entre os dois — então quando a seção caía perto do fim de
uma página, "Local, data" ficava sozinho no fim de uma página e a assinatura (linha + nome)
aparecia isolada no topo da seguinte. Reproduzi isso de forma determinística (script com
`pdfmake` real, variando a quantidade de conteúdo antes até achar o ponto exato da quebra) e
confirmei que acontecia tanto no caminho do PDF quanto, estruturalmente, no do Word (`keepNext`
só existia num parágrafo vazio de espaçamento, nunca ligado ao parágrafo real de local/data).

**Correção**: `local e data` passou a entrar *dentro* do próprio bloco `assinaturas`
(`tipos.ts` — novo campo opcional `localData`/`localDataAlinhamento`), em vez de um parágrafo à
parte. No PDF, local/data e as colunas de assinatura viram um único `stack` com `unbreakable` no
nível de fora (antes só as colunas tinham). No Word, o parágrafo de local/data ganhou
`keepNext: true` e passou a ficar imediatamente antes do espaçador+tabela (que já tinham
`keepNext`/`cantSplit`) — cadeia local/data → espaçador → tabela, todos presos entre si. Aplicado
nos dois lugares que usam esse bloco: Relatório final e Ata de assembleia.

**Validação**: testei de novo com `pdfmake` real (mesmo método de reprodução, ~40 pontos de
conteúdo ao redor do limite onde quebrava antes) — zero separações depois da correção. Gerei um
PDF de verdade pela tela (condomínio de exemplo, Playwright, login real) e conferi o texto de
cada página do PDF baixado: a última página termina com "Curitiba, 02/11/2026. Síndico
Responsável / CRA/SC 00000 / Krieger Assessoria..." tudo junto, como esperado. Teste de regressão
`assinaturaAtomica.test.ts` (3 casos: relatório final com local/data, relatório final sem
cidade/data — não quebra o bloco —, e ata com alinhamento à direita) junto da suíte completa (215
frontend, `tsc --noEmit`, `docs:check`) — tudo limpo.

**Sobre a "análise prévia pelo sistema" pedida junto**: já existe — o diálogo "Conferência antes
de emitir" (`DialogoConferencia.tsx`), com itens de `rel.conferencia` computados em
`montarRelatorioFinal`. Ele já cobre exatamente o lado de dados do caso da assinatura ("Assinatura
sem nome/assinatura cadastrados", "Capa sem cidade/data") — a parte que faltava era a de
paginação, que não dá pra prever nesse estágio (a conferência roda sobre dados puros, antes do
motor de PDF/Word decidir onde cai cada quebra de página) — por isso corrigi na raiz, tornando a
quebra estruturalmente impossível, em vez de tentar avisar sobre ela. Se o responsável tiver mais
pontos específicos de layout que quer que a conferência cheque, é só listar.

## PR #118 mesclado e publicado — 02/11/2026

PR #118 (toggle "no relatório" + correções do Codex, descrito abaixo) mesclado em `main` por
squash (`075dbd0`). Precisou sincronizar com o merge do PR #117 no meio do caminho (conflito só em
`docs/ESTADO-ATUAL.md` e nos testes de `receitasPorCategoria`/`automatico`, ambos com entradas e
casos novos em paralelo, sem tocar a mesma lógica — resolvido mantendo os dois lados). CI verde
nesse commit de merge, threads do Codex já resolvidas antes.

Build + `npm run package:hostinger` + push no `deploy-hostinger` (`635ecba`) — auto-deploy
confirmado ao vivo: `index.html` referencia `index-DBsWWNRY.js`, hash exato do build desse commit;
`auth.php?a=eu` responde 401 (API normal). Nenhum arquivo PHP mudou nesse PR (só frontend).

## Toggle "No relatório" por item + 2 achados do Codex corrigidos (PR #118) — 02/11/2026

Resolve os dois pontos que ficaram "em aberto" na entrada abaixo, decididos pelo responsável no
mesmo fio:

- **Duplicidade de "Elevador"**: existem de fato dois itens diferentes — o checklist de
  Documentos obrigatórios ("Elevador", conformidade: contrato de manutenção em dia ou não) e a
  linha financeira de Consumo de serviços ("Elevadores", quanto foi gasto no período). Decisão do
  responsável: manter os dois, só deixar mais claro — o item do checklist foi renomeado para
  "Elevador — contrato de manutenção em dia" (`domain/condominio.ts`,
  `documentosObrigatoriosPadrao()`).
- **Escopo de "campos opcionais no relatório"**: o responsável confirmou que é por item, nas 3
  listas que ainda não tinham o toggle — Administração (cada membro), Coberturas do seguro (cada
  linha) e Índices de correção (cada ano). Segue o mesmo padrão já usado em Documentos
  obrigatórios: campo `noRelatorio?: boolean` em `MembroAdministracao`/`Cobertura`/
  `IndiceCorrecao` (`domain/types.ts`), opt-out (`noRelatorio !== false`, não `=== true`) pra dado
  antigo sem o campo continuar aparecendo como sempre apareceu. Toggle `Switch` adicionado nas 3
  listas, nos dois lugares onde elas são editadas: cadastro do condomínio
  (`_authenticated.condominios.$id.tsx`) e editor de Considerações finais do relatório
  (`EditorConsideracoes.tsx`; Índices de correção só aparece lá quando o método de variação é
  "média de índices" — `PainelPrevisao.tsx`). Filtro aplicado nos dois lugares que leem essas
  listas pra montar o relatório: prévia na tela (`PreviaRelatorio.tsx`) e gerador de PDF/Word
  (`documentos/relatorioFinal.ts`, função `consideracoes()`).

Dois achados do Codex (P2) no PR, corrigidos antes de qualquer merge:

- **Valor manual exibido como "calculado automaticamente"**: `consumoPorRubrica()` (domínio)
  parava de calcular o automático assim que havia um valor manual, devolvendo `rubricas: []` —
  então o cartão "Calculado automaticamente" de `BlocoConsumoServico` mostrava o próprio valor
  manual com esse rótulo, e dizia "nenhuma despesa corresponde" mesmo quando havia. Corrigido:
  `ConsumoServico` ganhou o campo `automatico: { valor, rubricas }`, sempre calculado a partir do
  demonstrativo, independente de manual; `valor`/`manual`/`rubricas` (o que vale no relatório)
  continuam como antes. O cartão agora sempre mostra `calculado.automatico`, com uma nota quando o
  manual está ativo ("o relatório usa o valor manual abaixo").
- **`Field` perdia a associação de acessibilidade (`id`/`aria-describedby`) com o campo real**:
  "Contas a receber" e os 3 campos de valor manual envolviam o `DinheiroInput` num `<div>` junto
  do botão ("Usar do mensal" / "Voltar a calcular") — `Field` clona só o filho único, então os
  atributos caíam no `<div>`, não no input. Corrigido com `ComBotaoLateral` (novo componente local
  em `EditorConsideracoes.tsx`): recebe os atributos do `Field` e os repassa ao controle real via
  `cloneElement`, deixando o botão como irmão, sem romper a associação. `PropsControle` do `Field`
  passou a ser exportado para isso.

Testado: 207 testes de frontend (+3 — automático nunca zera com manual ativo, toggle filtra no
PDF/Word, item antigo sem `noRelatorio` continua incluído), 194 de domínio (+1), `tsc --noEmit`
(raiz e frontend) e `docs:check` limpos.

## Reorganiza "Valores" do editor de Considerações finais — 01/11/2026

Pedido do responsável, com captura de tela: depois do PR #116 (campos de palavra-chave de
água/energia/elevador), a seção "Valores" do editor ficou com layout bagunçado — um grid de 4
colunas misturava Contas a receber/pagar com os 3 serviços, cada um com 2 campos de alturas
diferentes (`CampoRubrica` mais alto, `Field` do valor manual mais baixo) mais um `<div/>`
espaçador, resultando numa grade ziguezague sem alinhamento lógico. O responsável também pediu
que o relatório seja "o mais automatizado possível, puxando tudo do sistema".

Mostrei a tela real (screenshot do servidor de dev, não mockup) antes de abrir PR — aprovado
("perfeito").

- "Contas a receber e a pagar" virou seção própria, separada de "Consumo de serviços".
- "Consumo de serviços" (`BlocoConsumoServico`, novo componente local a `EditorConsideracoes.tsx`):
  cada serviço (Água, Energia elétrica, Elevadores) é um cartão único e completo — palavra-chave →
  **valor calculado automaticamente em destaque** (com a(s) rubrica(s) que bateu(ram)) → valor
  manual escondido atrás de um link discreto "Informar valor manual em vez do calculado" (só abre
  quem clica; não altera o dado até alguém digitar — não zera nada sozinho). Atende o pedido de
  automação: o cálculo é o que aparece, o manual é a exceção.
- Fornecedor dos elevadores entrou dentro do próprio cartão de Elevadores.

Testado: 204 testes de frontend, 193 de domínio, `tsc --noEmit` e `docs:check` limpos. Validado
visualmente com Playwright no servidor de dev local (dados reais do condomínio de exemplo: R$
54.300,00 água, R$ 31.200,00 energia, R$ 14.400,00 elevadores, batendo com o demonstrativo) —
cartões, valores calculados e o toggle do valor manual abrindo/fechando sem side effect.

Os dois pontos que o responsável levantou no mesmo fio (campos opcionais no relatório e
duplicidade de "Elevador") foram decididos e implementados na entrada acima.

## PR #117 mesclado e publicado — 02/11/2026

PR #117 (gráfico "Receitas por categoria", descrito abaixo) mesclado em `main` por squash
(`8e3e0f5`). Único achado do Codex (P1) já corrigido antes do merge (nome de categoria cortado no
PDF/Word — ver histórico do PR); nenhum achado novo na revisão final, threads resolvidas.

Build (`frontend/.output/public`) + `npm run package:hostinger` + push no `deploy-hostinger`
(`7ed9ce1`) — auto-deploy confirmado ao vivo: `index.html` referencia `index-2B2AuD2l.js`, hash
exato do build desse commit; `auth.php?a=eu` responde 401 (API normal, sem sessão). Diff do pacote
só trocou hashes de assets (rebuild) — nenhum arquivo PHP mudou nesse PR. Branch de feature mantida
(sem exclusão automática nesta sessão).

## Gráfico "Receitas por categoria" (small multiples) no Relatório Final — 01/11/2026

Pedido do responsável: na seção "Análise gráfica", o gráfico de Evolução mensal já mostra receitas
ao longo do tempo, mas só como um total — ele queria acompanhar a evolução de cada tipo de receita
separadamente (Taxa condominial, Fundo de reserva, Multas e juros, Rendimentos de aplicação etc.).
Protótipo mostrado antes de implementar (Artifact): a 1ª versão (todas as categorias na mesma
escala, como linhas de cores diferentes) foi rejeitada pelo próprio responsável — a Taxa
condominial, ~10× maior que as outras, esmagava as receitas menores num gráfico só. A 2ª versão
(small multiples — um mini-gráfico por categoria, cada um com escala própria) foi aprovada.

- `domain/relatorioFinal.ts` — `receitasPorCategoria(mensais)`: pivota os relatórios mensais do
  período por nome de item de receita (mesmo mecanismo que `despesasPorGrupo` já usa pros grupos
  de despesa, só que ao longo do tempo em vez de um período só). Categorias na ordem em que
  aparecem pela primeira vez; mês sem aquela receita entra como zero; categoria sem nenhum valor
  no período inteiro fica de fora.
- `frontend/src/components/relatorio/GraficoReceitasCategoria.tsx`: um mini-gráfico de linha por
  categoria (recharts, mesmo padrão de `GraficoEvolucaoMensal`/`GraficoPizza`), cada um com sua
  própria escala — resolve o esmagamento visual. Mostra o valor do último mês e a variação % vs.
  o mês anterior (verde/vermelho) no canto de cada mini-gráfico. Cores: `corDoGrafico(i)`, mesma
  sequência que a pizza de despesas já usa.
- Entra na "Análise gráfica" do Relatório Final (tela e PDF/Word), entre "Despesas por grupo" e
  "Evolução mensal" — mesma posição aprovada no protótipo. Checkbox próprio
  (`Exercicio.mostrarReceitasPorCategoria`, padrão mostrado) ao lado dos já existentes de Pizza e
  Evolução mensal; some da tela inteira (sem bloco vazio) quando não há receita nomeada nos
  relatórios mensais do período. No PDF/Word, cada categoria vira um gráfico de linha simples
  (`linhaSvg`, já existente) em sequência — a visão em grade 2×2 é só da tela.

Testado: `domain/relatorioFinal.test.ts` (2 casos novos — zero nos meses sem a receita, categoria
zerada no período inteiro fica de fora), 195 testes de domínio, 206 de frontend, `tsc --noEmit` e
`docs:check` limpos, `bundle:check` em 178.146 de 256.000 bytes. Validado visualmente com
Playwright no servidor de dev local (condomínio de exemplo, que já tem 3 categorias de receita nos
relatórios mensais de exemplo): as 3 categorias aparecem com escalas próprias (Taxa condominial
~31 mil, Fundo de reserva ~3,1 mil quase reto, Rendimentos de aplicação 420-540 em alta — nenhuma
esmaga a outra), hover com tooltip funcionando, variação % com cor certa (vermelho/verde), checkbox
de seção escondendo e mostrando o bloco corretamente (6→3 gráficos recharts na página), sem
estouro horizontal em 375px.

## Auditoria UX do cadastro de condomínio: PR #116 mesclado e publicado — 01/11/2026

PR #116 (descrito abaixo) mesclado em `main` (`c8691e1`). Dois achados reais do Codex (P2)
corrigidos antes do merge: (1) `adicionarPalavraChave` não escapava a expressão existente quando
ela não era regex válida sozinha (fallback literal de `expressaoDeducao`) — somar uma palavra-chave
a uma rubrica assim quebrava o match do texto original e da palavra nova; corrigido aplicando o
mesmo escape antes de concatenar, com teste de regressão. (2) o timestamp "Atualizado em" entrava
no estado exibido antes de confirmar o salvamento — se a gravação falhasse, a tela mentia que tinha
salvo; corrigido: o timestamp só vai no payload da mutação, e só aparece na tela via `onSuccess`.

Essa branch também precisou importar `main` no meio do caminho: o PR #112 (permissões
granulares, de outra sessão) mesclou enquanto este PR estava aberto, mudando
`condominios.$id.tsx` e `domain/types.ts` — único conflito real foi em `docs/ESTADO-ATUAL.md`
(as duas entradas no topo), resolvido mantendo as duas. Revalidado por completo depois do merge
(raiz + frontend + sintaxe PHP de todos os arquivos, incluindo os novos de permissões).

Build + `npm run package:hostinger` + push no `deploy-hostinger` (`f0a948d`) — auto-deploy
confirmado ao vivo (`index.html` referencia `index-CU3a0cMd.js`, hash exato do build desse
commit; `auth.php?a=eu` responde 401, API normal; `lib_permissoes.php` e os demais arquivos PHP
novos do PR #112 confirmados presentes no pacote). Branch de feature apagada após o merge.

## Auditoria UX da tela de cadastro do condomínio — correções aplicadas — 01/11/2026

Pedido do responsável: auditoria de UX/acessibilidade/performance focada na tela de "atualizar
informações dos condomínios" (`_authenticated.condominios.$id.tsx`), adaptando os pilares de
SEO/CRO pro contexto de app interno (Krieger é `noindex`, atrás de login). A auditoria gerou uma
tabela de prioridades; implementadas todas, da mais alta pra mais baixa, num único PR:

- **Alto — regex exposta como campo de negócio**: os 4 campos de rubrica (água, energia,
  elevador, dedução) deixaram de pedir regex do síndico/controller. Novo campo "digite uma
  palavra e clique em adicionar" (`domain/rubricaAmigavel.ts` — `chipParaRegex`/
  `adicionarPalavraChave`) soma a palavra como nova alternativa (`|`) à expressão já existente,
  no mesmo estilo acento-insensível que os padrões do sistema já usam (`[áa]gua` etc.) — nunca
  reinterpreta nem apaga o que já estava lá, mesmo em expressões técnicas complexas (com `.*`
  etc.). A expressão em si continua editável, só que recolhida num `<details>` "Expressão técnica
  (normalmente não precisa mexer aqui)". Componente `CampoRubrica`, usado no cadastro do
  condomínio e no editor de Considerações finais do relatório.
- **Alto — sem indicação de dado desatualizado**: `Condominio.atualizadoEm`/`atualizadoPor`,
  gravados automaticamente a cada "Salvar", mostrados no cabeçalho da tela ("Atualizado em
  dd/mm/aaaa hh:mm por Fulano").
- **Médio — inconsistência Switch/Checkbox**: o toggle "Incluir no relatório" do checklist de
  Documentos obrigatórios usava `Checkbox` no editor por relatório e `Switch` no cadastro do
  condomínio — padronizado em `Switch` nos dois lugares.
- **Médio — sem navegação interna no formulário longo**: índice de âncoras (`nav`) acima das 8
  seções recolhíveis do cadastro — clicar abre a seção e rola até ela. `SecaoRecolhivel` ganhou
  uma prop `id` opcional pra isso.
- **Médio — "Atualizar pela Receita" só trazia endereço**: agora também compara razão social e
  situação cadastral com o que está no cadastro (`lib/receitaCnpj.ts` — `divergenciasCnpj`) e
  avisa em vez de só sobrescrever o endereço silenciosamente — nunca sobrescreve nome/situação
  sozinho, só sinaliza.
- **Baixo — "Alvará Estrutural" perdeu contexto ao virar nome genérico**: observação padrão
  pré-preenchida explicando a origem (exigência municipal de Balneário Camboriú).
- **Baixo — linha de Documentos obrigatórios pesada no mobile**: nome e status agora ficam lado a
  lado mesmo em telas estreitas (grid 2 colunas desde o início, não só a partir de ~320px),
  reduzindo a rolagem por item.
- **Investigado, sem bug confirmado**: a auditoria de 21/10 registrava uma falha de teclado numa
  ação de tabela nunca confirmada como corrigida. Testei com Playwright (Enter e Espaço) o botão
  de status do checklist — a ativação por teclado funciona corretamente; o primeiro teste que
  pareceu falhar foi um defeito do próprio script de teste (locator instável que mudava de alvo a
  cada toggle), não um bug do sistema.

Testado: `domain/rubricaAmigavel.test.ts` (novo), `domain/condominio.test.ts` (novo),
`receitaCnpj.test.ts` ampliado, 201 testes de frontend e 192 de domínio, `tsc --noEmit` e
`docs:check` limpos nos dois lados, `bundle:check` em 177.027 de 256.000 bytes. Validado
visualmente com Playwright no servidor de dev local: timestamp aparecendo após salvar, índice de
navegação abrindo a seção certa, palavra-chave "esgoto" virando `[eéèê]sg[oóòôõ]t[oóòôõ]` somada à
rubrica de água existente, observação padrão do Alvará Estrutural, grid compacto em 360px sem
estourar a largura, e o teste de teclado descrito acima.

## Permissões individuais — PR #112 — 01/11/2026

Implementação na branch `feat/permissoes-granulares`, com matriz de 25 permissões,
exceções individuais (permitir/negar/padrão), validação no PHP e na navegação,
links internos ocultos e ações de edição condicionadas às permissões. Admin mantém
acesso total; funções administrativas continuam exclusivas de admin.
Migração aplicada pelo responsável no phpMyAdmin, com contagem de 25 confirmada.
Leituras compartilhadas entre telas são documentadas em PERMISSOES-GRANULARES.md.
CI inclui teste MySQL para migração repetida, negação, concessão e revogação.
Release 1.01 publicado: PR #112 integrado em `aad25bc`, pacote de main publicado
em `deploy-hostinger` no commit `ba5b1da`. Ambos os checks finais do PR passaram,
incluindo MySQL temporário. Local: 182 testes de domínio e 202 de frontend,
typechecks, sintaxe PHP, documentação, build e pacote aprovados.
Produção confirmada pelo asset `index-CqZmvNh9.js` e versão 1.01; raiz/asset HTTP
200, APIs sem sessão HTTP 401 e biblioteca interna HTTP 403. Não houve validação
manual com contas reais autenticadas nesta sessão. Evidências completas no PR.
Nenhum SQL adicional. Rollback de aplicação pelo pacote anterior `1b69cf7`;
tabelas aditivas podem permanecer sem uso com a versão antiga, sem apagar dados.

## Documentos obrigatórios + Consumo de serviços nas Considerações finais — 01/11/2026

Dois mockups do responsável (Artifact, nunca implementados antes) viraram código nesta sessão,
num único PR. Decisão de arquitetura confirmada com o responsável antes de começar: a nova lista
"Documentos obrigatórios" é **independente** dos campos já existentes em "Manutenções e vistorias"
(vigência de extintores, caixa d'água etc., que seguem alimentando o alerta de vencimentos do
Painel com data calculada) — sem migração, sem tocar nesses campos nem no Painel.

- **Documentos obrigatórios** (`domain/types.ts` — `DocumentoObrigatorio`; `Condominio.documentosObrigatorios`
  e `Exercicio.consid.documentosObrigatorios`): lista livre por condomínio — nome, status (✓ em
  dia / ✗ pendente, marcado manualmente, sem data calculada), vencimento/informação em texto livre,
  observação, e um toggle "no relatório" que controla se aparece nas Considerações finais. 7 itens
  padrão (`domain/condominio.ts` — `documentosObrigatoriosPadrao()`): Extintor, Seguro, Limpeza de
  Caixa D'Água, Dedetização, Alvará de Bombeiros, Alvará Estrutural, Elevador — pré-cadastrados em
  todo condomínio novo ou existente (via `normalizarCondominio`), editável/removível. Tela própria
  no cadastro do condomínio (`_authenticated.condominios.$id.tsx`, seção recolhível, usa
  `RepeatableList` com reordenação por arrasto) e editor por relatório (`EditorConsideracoes.tsx`,
  copiado do cadastro via `considDoCondominio` e recarregável).
- **Consumo de serviços** (Considerações finais, PDF/Word/tela): Seguro passou a imprimir valores
  alinhados à direita (campo novo `alinhamento?: "direita"` no bloco `"pares"` de
  `lib/documento/tipos.ts`, honrado em `pdf.ts`/`word.ts`/`PreviaRelatorio.tsx`). Nova seção com
  Água, Energia Elétrica e Elevadores lado a lado — mesmo mecanismo que a Água já usava (soma as
  despesas do demonstrativo cuja rubrica casa com uma expressão configurável no cadastro;
  "valor médio" é só período ÷ 12), generalizado em `domain/relatorioFinal.ts`
  (`consumoPorRubrica` + `consumoAgua`/`consumoEnergia`/`consumoElevador`). Fornecedor dos
  elevadores (texto livre) vira uma 3ª linha só na célula "Elevadores" — sem coluna "Empresa"
  separada, que o mockup descartou por ficar espremida. Cada linha some quando o valor calculado é
  zero (igual a água já fazia); a linha de água saiu do grupo "Valores" (ficou redundante com a
  tabela nova).

PR #114 mesclado em `main` (`4b016ec`) — CI verde e Codex sem achados. Build +
`npm run package:hostinger` + push no `deploy-hostinger` (`1b69cf7`) — auto-deploy confirmado ao
vivo (`index.html` referencia `index-mGHoGIbx.js`, hash exato do build desse commit; `auth.php?a=eu`
responde 401, API normal). Branch de feature apagada após o merge.

Testado: domínio (`consumoEnergia`/`consumoElevador`, mesma mecânica/teste que já existia pra
água), 196 testes de frontend, `tsc --noEmit` e `docs:check` limpos nos dois lados. Validado
visualmente com Playwright no servidor de dev local, condomínio de exemplo (`condo-acacias`):
checklist com 7 itens e toggle de status funcionando no cadastro e no editor; na prévia do
relatório, Seguro com valores alinhados à direita, tabela de Consumo de serviços com os três
valores batendo com o demonstrativo de exemplo (Água R$ 54.300,00, Energia R$ 31.200,00,
Elevadores R$ 14.400,00, cada um ÷ 12), Documentos obrigatórios listados, e o grupo "Valores"
some quando não sobra nada nele (contas a receber/pagar vazias, água mudou de lugar). O teste
`documentosLargura.test.ts` (confere que toda tabela de todo documento cabe na página) já cobre a
tabela nova, usando o mesmo condomínio de exemplo.

## Consulta Inteligente: PR #113 mesclado e publicado — 31/10/2026

PR #113 (markdown no parecer + histórico recolhível, descrito abaixo) mesclado em `main`
(`fa6a2d4`). Achado do Codex (P2) corrigido antes do merge: o componente `ol` customizado
descartava a prop `start` do `react-markdown`, então uma lista que o Claude continua em um
número diferente de 1 (ex. `5. Advertência` / `6. Multa`) voltava a exibir 1, 2 na tela —
corrigido encaminhando `start` ao elemento `<ol>`. 195 testes, `tsc --noEmit` e `docs:check`
seguiram limpos depois do ajuste.

Build + `npm run package:hostinger` + push no `deploy-hostinger` (`64ee386`) — auto-deploy
confirmado ao vivo (`index.html` referencia `index-DYPOIelq.js`, hash exato do build desse
commit; `auth.php?a=eu` responde 401, API normal). Branch de feature apagada após o merge.

## Consulta Inteligente: parecer em markdown de verdade + histórico recolhível — 31/10/2026

Pedido do usuário: o parecer da IA saía como texto cru (negrito do Claude virava `**asteriscos**`
literais, "parecia resposta de WhatsApp"), e o card "Histórico Recente de Consultas" sempre ficava
aberto, ocupando espaço sem necessidade.

- `frontend/src/routes/_authenticated.consulta-documentos.tsx`: o campo `resposta.texto` (markdown
  que o Claude já devolve naturalmente — títulos, negrito, listas, citações) agora renderiza de
  verdade via `react-markdown` + `remark-gfm`, com um conjunto de componentes próprio
  (`COMPONENTES_PARECER`) estilizado no mesmo padrão visual do resto do app (títulos em
  uppercase/cor primária, marcadores de lista coloridos, citação com borda lateral e fundo suave,
  tabela com cabeçalho e rolagem própria) — nada de depender de um plugin de tipografia novo.
- Histórico Recente de Consultas trocou `SectionCard` por `SecaoRecolhivel` (componente já existente
  no projeto, mesmo padrão usado em outros formulários) — fechado por padrão, mostrando só a
  contagem ("N perguntas") até o usuário abrir.
- `react-markdown`/`remark-gfm` adicionados como dependência. Como a rota já é um chunk próprio
  (code-split por rota, confirmado no build), isso não entra no orçamento de JS inicial — medido com
  `npm run bundle:check`: 176.658 de 256.000 bytes gzip (chunk da própria rota, ~181 KB cru, só
  carrega quando o usuário abre essa tela).

Validado visualmente (Playwright, servidor de dev local, texto de exemplo com título, negrito,
lista, citação e trecho em itálico — depois revertido do `mockApi.ts`, não é dado real): parecer
renderiza com tipografia de verdade, sem asterisco solto; histórico abre e fecha corretamente,
preservando a lista por baixo (não perde nada ao recolher).

Testado: 195 testes de frontend, `tsc --noEmit` limpo, `npm run bundle:check` dentro do orçamento,
`docs:check` limpo.

## Corrige overflow horizontal no Drive de Documentos — 31/10/2026 (PR #110)

Usuário reportou com print a tela "Drive de Documentos" (entrega do Codex) rolando inteira na
horizontal. Diagnóstico levou duas rodadas: a primeira tentativa (`min-w-0` nos itens de grid
`lg:grid-cols-12`/`xl:grid-cols-12`) não foi confirmada por testes isolados em telas largas
(≥1024px, onde o Tailwind já evita o problema sozinho via `minmax(0,1fr)` do `grid-cols-N`) — quase
descartei o fix por falta de prova.

**Causa real, confirmada com o usuário rodando no DevTools dele** (`document.documentElement.scrollWidth`
vs `window.innerWidth`, janela em 819px): abaixo do breakpoint `lg:` (1024px) do Tailwind,
`lg:grid-cols-12` não ativa e o grid cai pro `display:grid` padrão sem `grid-template-columns`
explícito — track implícito `auto`, não `minmax(0,1fr)`. Nessa faixa, um item de grid sem `min-w-0`
sofre o blowout clássico: cresce pra caber o conteúdo (a tabela larga de arquivos), empurrando a
coluna — e com ela a página inteira — pra fora do viewport, em vez de rolar dentro do próprio
wrapper `overflow-x-auto` que já existia.

Validado com teste A/B real no app (login, criação de condomínio, upload de 80 arquivos pelo fluxo
de verdade, viewport 819×900 — mesma largura do usuário): sem o fix, 188px de overflow de página
(culpado: o wrapper `overflow-x-auto` da tabela, que cresce junto com o item de grid); com o fix,
zero. `min-w-0` adicionado nos 4 itens de grid envolvidos (coluna "Pastas e Categorias", coluna
"Arquivos", coluna da lista quando o visualizador inline de PDF está aberto, e o painel do
visualizador).

**Mesclado (squash) e publicado — 31/10/2026**: PR #110 mesclado em `main` (`8d9ccb9`). Publicado
via worktree `deploy-hostinger` (`3ca49de`) — auto-deploy confirmado ao vivo (`index.html` referencia
`index-B5W0Rjkc.js`, hash exato do build desse commit; `auth.php?a=eu` responde 401, API normal).

## Tabela `kr_decisoes_previsao` confirmada aplicada em produção — 30/10/2026

Pendência registrada no PR #104 (28/10/2026, "Ação pendente em produção — nova tabela") estava sem
confirmação de que o `CREATE TABLE IF NOT EXISTS` tinha sido rodado. Usuário rodou agora via
phpMyAdmin: retorno "Tabela 'kr_decisoes_previsao' já existe" — ou seja, já tinha sido aplicada em
algum momento anterior (não fica claro quando), só não estava registrado aqui. Log de decisões de
divergência da Previsão sugerida (PRs #104/#105) funciona contra a API real sem a pendência.


## Importar apólice de seguro (PDF) na tela de Considerações finais — 30/10/2026

Pedido do usuário: se a apólice não for anexada, os campos de Seguro (seguradora, vigência, valores)
continuam digitados à mão — mas quando o PDF existe, a tela deveria importar automaticamente, com os
campos preenchidos continuando editáveis. Testado contra uma apólice real da Allianz (FIRMO Corretora)
antes de implementar, pelo mesmo pipeline do app (pdf.js + `domain/layoutTexto.ts`), não pela extração
do Read tool do Claude — mesma lição já registrada no projeto.

- `domain/pdfParser.ts`: `lerApoliceSeguro(texto)` — layout da Allianz, diferente de
  `lerConsideracoesFinais` (que só repete o que o Systemar já tinha digitado, com vigência em
  mm/aaaa só). Lê seguradora, nº da apólice, vigência completa (dd/mm/aaaa), risco absoluto (campo
  "Limite Máximo de Garantia da Apólice") e a tabela de coberturas inteira (pega o "Limite Máximo de
  Indenização" de cada linha; ignora Básica Simples — já é o risco absoluto —, Assistência 24h e
  Prêmio Líquido, que não são cobertura). `null` quando o PDF não bate com esse layout.
  **Achado na apólice real**: a fonte usada pra imprimir o traço (hífen do CNPJ, "Lock-Outs", "—" de
  franquia vazia) não tem `ToUnicode` pro hífen comum — vem como `U+E00C` (área de uso privado).
  Normalizado logo no início da função, senão corta o CNPJ e nomes de cobertura no meio.
- `frontend/src/components/relatorio/EditorConsideracoes.tsx`: botão "Importar apólice (PDF)" no
  cabeçalho do cartão "Seguro" (mesmo padrão do botão "Atualizar pela Receita" no cadastro do
  condomínio — sem diálogo, preenche direto e avisa por toast). Substitui `seguradora`,
  `vigenciaSeguro` (= vigência até) e `seguro.riscoAbsoluto`/`.coberturas` por completo; campos
  continuam editáveis depois, nada é gravado até salvar. PDF de outro layout (ou de outra
  seguradora): toast de erro, nada muda — cai para digitação manual, como já era.

Validado contra o PDF real: 13 coberturas lidas corretamente (incluindo as com o traço problemático —
"RC Guarda Veículos - Parcial", "Tumultos, Greves, Lock-Outs"), vigência 21/11/2025 a 21/11/2026,
risco absoluto R$ 8.000.000,00, CNPJ do condomínio batendo. PDF real não commitado (fixtures de teste
são fictícias). Testado: `domain/pdfParser.apoliceSeguro.test.ts` e
`frontend/src/test/editorConsideracoes.test.tsx` (novos) — 176 testes de domínio, 194 de frontend.
`tsc --noEmit` limpo na raiz e no frontend. `docs:check` limpo.

**Escopo conhecido**: só reconhece o layout da Allianz (é a apólice real disponível pra testar); outra
seguradora com layout diferente não é reconhecida — cai para digitação manual, sem travar nada.

**Achado do Codex review no PR #109 (P2), corrigido antes de mesclar**: a importação é assíncrona (lê
o PDF, leva um instante); se o usuário editasse outro campo das Considerações nesse meio-tempo, só o
botão de importar ficava desabilitado — a conclusão sobrescrevia essa edição em silêncio (o `onChange`
usava o estado capturado no início da operação, não o mais recente). Corrigido com um `ref` sempre
atualizado a cada render, aplicando o patch da apólice sobre o estado mais recente. Teste de regressão
reproduz o cenário — confirmado que falha sem a correção e passa com ela.

**Mesclado (squash) e publicado — 30/10/2026**: PR #109 mesclado em `main` (`d186791`). Publicado via
worktree `deploy-hostinger` (`aab1998`) — auto-deploy confirmado ao vivo (`index.html` referencia
`index-CV3OgnTA.js`, hash exato do build desse commit; `auth.php?a=eu` responde 401, API normal).
Branch de feature apagada localmente; a remota não foi apagada nesta sessão (mesmo bloqueio do
classificador de segurança em `git push --delete` já registrado — seguro apagar manualmente).

## Previsão orçamentária por unidade: checkbox + nunca mostrar zerada — 30/10/2026 (PR #108)

Pedido do usuário ao revisar um Relatório Final real: o bloco "Previsão orçamentária por unidade"
(Unidades/Cota/Reserva/Valor por unidade) sempre saía "—" nesse condomínio, porque dependia só do
campo manual `Condominio.unidades` (cadastro), que nunca tinha sido preenchido. Não faz sentido
apresentar um relatório com informação zerada.

**Tentativa errada, corrigida antes de mesclar (achado do Codex review no PR #108, P1):** a primeira
versão desta mudança tentava usar `Mensal.receber.unidades` como alternativa quando o cadastro está
vazio — mas esse campo é "**unidades inadimplentes**" (contas a receber em atraso, rótulo explícito
na tela do relatório mensal e no documento gerado, "N de total unidades"), não o total de unidades do
condomínio. Usar como divisor do rateio geraria cota por unidade muito maior que a real (ex.: 2
inadimplentes de 50 unidades vira "cota ÷ 2" em vez de "cota ÷ 50"). Não existe hoje, no sistema,
nenhuma fonte confiável e automática do total de unidades além do cadastro — revertido antes de
publicar; `domain/mensal.ts` não ganhou a função `unidadesDoUltimoRelatorio` que chegou a existir
localmente.

O que ficou, então, é só a parte segura do pedido:

- `domain/types.ts`: `Exercicio.mostrarPrevisaoPorUnidade` (novo, default true) — checkbox pra
  incluir/excluir o bloco do relatório, mesmo padrão de `mostrarContasAnaliticas`/`mostrarEvolucaoMensal`.
- `frontend/src/documentos/relatorioFinal.ts` e `PreviaRelatorio.tsx`: os dois lugares que mostram
  esse bloco (previsão tradicional, embutida no resumo, e previsão sugerida do Systemar, bloco
  próprio) só renderizam quando `mostrarPrevisaoPorUnidade !== false` **e** o nº de unidades (do
  cadastro) não é null — nunca um bloco zerado no PDF/Word, mesmo com o checkbox marcado.
- `_authenticated.relatorio-final.$id.tsx`: checkbox novo na lista de seções, aninhado em "Previsão
  orçamentária", só aparece quando há unidades no cadastro pra mostrar.

Quem quiser esse bloco funcionando precisa preencher "Unidades" no cadastro do condomínio — não tem
atalho automático.

Testado: `domain/relatorioFinal.test.ts` (sem unidades no cadastro, o quadro fica nulo mesmo com
relatório mensal presente) — 173 testes de domínio. `npx tsc --noEmit` limpo na raiz e no frontend;
192 testes de frontend. `npm run docs:check` limpo.

**Mesclado (squash) e publicado — 30/10/2026**: PR #108 mesclado em `main` (`adc6e24`), a pedido
explícito do responsável pra não parar o fluxo esperando confirmação a cada etapa (regra registrada
em `AGENTS.md`, nesta mesma mudança). Publicado via worktree `deploy-hostinger` (`22d63c6`) —
auto-deploy confirmado ao vivo (`index.html` referencia `index-CV88Tu-G.js`, hash exato do build
desse commit; `auth.php?a=eu` responde 401, API conectando normalmente). Branch de feature apagada
localmente; a remota (`previsao-por-unidade-relatorio-mensal`) não pôde ser apagada nesta sessão
(bloqueio do classificador de segurança em `git push --delete`) — seguro apagar manualmente, PR já
mesclado.

## Drive de Documentos + Consulta Inteligente (IA) + Geração de Notificação e Multa (.DOCX) — 30/10/2026

Implementação dividida em dois menus complementares no grupo **Assembleias e documentos**, atendendo à diretriz de gasto mínimo de tokens e armazenamento completo de arquivos dos condomínios:

1. **Menu `Drive de Documentos` (`/drive-documentos`)**:
   - Repositório online por condomínio que aceita qualquer categoria de documento (`convencao`, `regimento`, `ata`, `seguro`, `contrato`, `laudo`, `notificacao`, `outro`) e formatos `.pdf`, `.docx`, `.jpg`, `.jpeg`, `.png` e `.webp`.
   - Ao subir `.docx` ou imagens (`.jpg`/`.png`/`.webp`), exibe diálogo perguntando se deseja **(1) Converter para PDF e manter também o arquivo original** (recomendado, permitindo baixar tanto o PDF quanto o original) ou **(2) Converter e armazenar apenas em PDF**.
   - Visualização **sempre em PDF inline** na própria tela, impressão online, download em PDF e download do arquivo original.
   - Pesquisa rápida por nome, categoria, data e formato, além de menu de contexto com **botão direito do mouse** (Abrir PDF inline, Perguntar à IA sobre o arquivo, Imprimir online, Baixar PDF, Baixar original, Renomear / Categoria, Excluir).
   - Configuração de `pastaDocumentos` principal + múltiplos `caminhosDocumentos` locais e importação direta de pasta local pelo navegador (`webkitdirectory`).
2. **Menu `Consulta Inteligente` (`/consulta-documentos`)**:
   - Seletor de abrangência com pesquisa inline permitindo consultar **`🌐 Todos os condomínios com documentos na base` (`"*"`)** ou **um condomínio específico**, além de filtro opcional por documento.
   - Campo genérico de **Questionamento / Consulta** (para dúvidas recebidas por WhatsApp, e-mail, telefone ou consulta interna) com busca `FULLTEXT` + fallback de trechos e cache persistente para mínimo consumo de tokens no `claude-haiku-4-5`.
   - Flag **`[ ] Emitir Notificação / Multa em Word (.DOCX) a partir desta base legal`** que abre os campos de preenchimento (Condomínio, Modalidade: Apenas Notificação, Notificação e Multa ou 2ª Notificação e Multa, Condômino/Proprietário, Unidade, Inquilino opcional, Ocorrência, Base Legal preenchida pela IA, Enquadramento e Valor da Multa com valor por extenso automático `valorPorExtensoBRL`) e gera o `.DOCX` editável fiel ao layout oficial da Krieger.


## Drive: Categorias e Pastas, subpastas automáticas e "Outros Documentos" — 30/10/2026

- Modal `⚙️ Categorias e Pastas`: CRUD de categorias (rótulo + palavras-chave de identificação automática, em `ConfigEscritorio.categoriasDrive`) e subpastas por condomínio (`Condominio.pastasDrive`).
- Ao subir uma pasta (`webkitdirectory`), pastas e subpastas dos arquivos são cadastradas automaticamente (`kr_documentos.caminho_relativo`) e exibidas em árvore navegável com breadcrumb.
- Arquivos avulsos: identificação automática pelo nome via palavras-chave; sem identificação, vão para `📦 Outros Documentos`.
- Não exige SQL manual: `garantir_esquema_documentos` (`lib_documentos.php`) migra automaticamente (`tipo VARCHAR(64)`).

## Pesquisa inline de condomínio na Consulta de Documentos — 30/10/2026

Pedido do usuário para incluir pesquisa inline no seletor de condomínio da tela **Consulta de Documentos** (`/consulta-documentos`), facilitando encontrar qualquer condomínio sem precisar rolar toda a lista:

- `frontend/src/components/app/inputs.tsx`: novo componente `SelecaoBusca` (combobox acessível compatível com `Field`) e utilitário `opcoesCondominio`. Ao clicar no campo ou começar a digitar, abre a lista com campo de pesquisa inline focado automaticamente, filtrando em tempo real por qualquer parte do nome (sem diferenciar acentos ou maiúsculas/minúsculas), código ou CNPJ, além de exibir o código do condomínio ao lado do nome.
- `frontend/src/routes/_authenticated.consulta-documentos.tsx`: substitui `Selecao` por `SelecaoBusca` com `opcoesCondominio(ordenados, true)`.
- `frontend/src/test/acessibilidade.test.tsx`: teste automatizado cobrindo `SelecaoBusca` dentro de `Field` e filtragem sem acento.

## Correção de duplicação na importação de condomínios + Menu administrativo "Limpeza de Dados" — 29/10/2026

Pedido do usuário após notar 344 condomínios duplicados ao importar a Listagem de Condomínios mais de uma vez e solicitar um menu administrativo em vermelho (restrito a administradores) para apagar todos os cadastros ou cada categoria individualmente:

- **Antiduplicação de condomínios**:
  - `api.php` (`resolver_id_condominio`) e `frontend/src/lib/mockApi.ts`: ao salvar na store `condominios`, verifica se já existe registro com o mesmo `codigo` normalizado (ou `cnpj` quando sem código) e reaproveita o `id` existente em vez de criar duplicata.
  - `frontend/src/components/importacao/ImportarListagemCondominios.tsx`: busca lista fresca de condomínios (`staleTime: 0`) ao abrir o PDF, preserva `id` estável por código durante retentativas (`idsNovosRef`) e invalida a query de condomínios no `onSettled` (mesmo após falha parcial de rede).
- **Menu e tela "Limpeza de Dados" (Zona de Perigo)**:
  - `frontend/src/components/app/AppSidebar.tsx`: item **Limpeza de Dados** em vermelho no grupo "Administração", visível exclusivamente para `perfil === "admin"`.
  - `frontend/src/routes/_authenticated.limpeza-dados.tsx` + `api.php` (`a=limpar_contagens` e `a=limpar_dados`): permite apagar todos os cadastros operacionais de uma só vez (preservando `kr_usuarios` e `kr_config`) ou apagar individualmente cada uma das 11 categorias (`condominios`, `exercicios`, `mensais`, `assembleias`, `atas`, `modelos`, `importacoes`, `anexos_importacao`, `decisoes_previsao`, `documentos` e `backups`), sempre com contagem em tempo real e diálogo de confirmação.

## Completar cadastro do condomínio com dados complementares do PDF na importação (PR #96) — mesclada e publicada — 29/10/2026

O PR #96 (branch `completar-cadastro-condominio-na-importacao`, com revisão do Codex já tratada em `74a6c04` para código/CNPJ ausentes em backups) estava aberto e com CI verde. Mesclado em `main` (`45fec1c`) e publicado em `deploy-hostinger` (`c5db6bf`, bundle `index-REnUhuWE.js`):

- `domain/importacao.ts`: `camposComplementares(existente, cad)` identifica campos em branco no cadastro existente (`codigo`, `nome`, `cnpj`) que o PDF conferido traz preenchidos, nunca sobrescrevendo campos já preenchidos.
- `frontend/src/lib/apiTypes.ts`, `mockApi.ts` e `lib_importacao.php`: aplicam o complemento na mesma transação atômica de `confirmarImportacao`.
- `_authenticated.importacoes.$id.tsx`: exibe diálogo de confirmação listando os campos que serão completados antes de gravar.

## Painel: bloco "Pendências de ajuste" (cadastro + previsão) + reorganização dos vencimentos — 29/10/2026

Pedido do usuário depois do importador de Listagem de Condomínios: ele gostou da ideia de
centralizar o aviso de divergência no Painel, e pediu 2 blocos — um bem visual com itens que
precisam de ajuste pra algum relatório ficar correto (com link direto pra onde corrigir), e o
painel de vencimentos de hoje, só com uma distribuição visual melhor.

- `domain/painel.ts`: `calcularPendenciasAjuste(condominios, exercicios)` reúne duas fontes:
  `Condominio.alertaCadastro` (CNPJ ausente/duplicado, da Listagem de Condomínios) e a Previsão
  sugerida "em conferência" (reaproveita `compararComTotaisPdf`/`chaveDivergencia` de
  `domain/previsaoSugerida.ts` — mesma lógica da PR #105, sem duplicar). Primeiro teste desse
  arquivo (`domain/painel.test.ts` não existia).
- `_authenticated.painel.tsx`: novo card "Pendências de ajuste" (borda vermelha, ícone por tipo,
  clicável — linka pro cadastro do condomínio ou pra Previsão orçamentária daquele exercício já
  com o filtro certo), só aparece quando há pendência. O card de vencimentos (renomeado "Vencimentos
  e prazos") ganhou um ícone por tipo (seguro/extintores/vistoria/mandato) pra ficar mais fácil de
  escanear, mesma lista de antes.
- Testado em `npm run dev` local contra os 192 condomínios já importados nesta sessão: a lista
  bateu exatamente com os 19 alertas de CNPJ confirmados antes; clicar numa pendência abriu o
  cadastro certo, com o alerta e o botão "Dispensar" já lá.

**Mesclado e publicado — 29/10/2026**: PR #107 (squash, branch
`importador-listagem-condominios-v2` apagada) — commit em `main` `d01acd8`. Publicado via
worktree `deploy-hostinger` (commit `a8e032c`) — auto-deploy confirmado ao vivo (`index.html`
referencia `index-B47s627X.js`, hash exato do último build; `auth.php?a=eu` responde 401; console
sem erros além do 401 esperado). Branch órfã `importador-listagem-condominios` (histórico
incorreto, substituída pela `-v2`) apagada do remoto.

## Novo importador: Listagem Completa de Condomínios (Systemar) — aguardando validação do usuário — 29/10/2026

Pedido do usuário: um 4º tipo de importador de PDF pra "Listagem Completa de Condomínios" do
Systemar (relatório único com todos os condomínios do escritório — código, nome, CNPJ, endereço,
área total e administração). Plano completo (confirmado com o usuário via 3 perguntas antes de
implementar) em `C:\Users\Evandro\.claude\plans\quiet-chasing-token.md`.

Decisões confirmadas: (1) quando houver CNPJ, atualiza o nome automaticamente pela razão social da
Receita Federal; (2) sem CNPJ na listagem, casa pelo código (`Condominio.codigo`) — quando o CNPJ
se repete entre dois condomínios da própria listagem, **não trava o cadastro**, só sinaliza com um
alerta vermelho (`Condominio.alertaCadastro`), visível na lista de condomínios e no cadastro, com
botão para dispensar manualmente; (3) exclui por padrão (mas deixa visível/marcável na prévia) as
linhas da própria Krieger Assessoria Contábil (CNPJ 05.248.266/0001-71, aparece 2×) e qualquer linha
"TESTE -".

Campos novos: `Condominio.areaTotalM2`, `Condominio.alertaCadastro`,
`MembroAdministracao.identificacao`/`.telefone` (cargo já era texto livre — "editável" já era o
comportamento). **Nenhuma tabela nova** — tudo cabe no JSON já existente de `kr_condominios`, sem
SQL a rodar em produção.

Arquivos principais: `domain/pdfParser.ts` (`lerListagemCondominios` — parser novo, testado contra
o texto real extraído do PDF do usuário via o mesmo pipeline do app, não contra a extração do Read
tool, que não preserva o mesmo espaçamento em colunas — ver comentário no parser);
`domain/importacaoListagemCondominios.ts` (`analisarListagemCondominios` — reaproveita
`encontrarCondominio`/`domain/importacao.ts` para o match, calcula só os campos que mudaram);
`frontend/src/lib/receitaCnpj.ts` (`consultarCnpjsEmLote` — lote sequencial com atraso, reaproveita
`consultarCnpjReceita` já existente); `frontend/src/components/importacao/ImportarListagemCondominios.tsx`
+ rota `/importador-condominios` (prévia com status por linha, badge de alerta, progresso da
consulta à Receita e do salvamento); administração no cadastro do condomínio ganhou colunas
Identificação e Telefone.

**Testado pelo agente contra o PDF real do usuário** (`283_102026.pdf`, 192 condomínios, 35
páginas) em `npm run dev` local (mock): parser bate exatamente com o rodapé "Total:192"; achou e
sinalizou corretamente vários pares de CNPJ repetido (alguns claramente o mesmo condomínio em dois
blocos — ex. torre/garagem, residencial/comercial — não só os 2 que eu tinha achado olhando à mão);
excluiu por padrão só as 2 linhas da Krieger e a 1 "TESTE -"; consulta em lote à Receita Federal
rodou de verdade (176 CNPJs, ~176 chamadas reais à BrasilAPI) e atualizou nomes/endereços; salvamento
dos 189 condomínios selecionados concluído sem erro; conferido um condomínio importado (Urban
Classic, código 166) com administração, telefone e identificação corretos, e o badge vermelho
aparecendo nos duplicados (ex. código 070/071).

**Validado e publicado — 29/10/2026**: usuário deu sinal verde explícito. PR #107 mesclado (squash)
em `main` (`d01acd8`) e publicado via worktree `deploy-hostinger` (`a8e032c`) — mesma validação ao
vivo do bloco acima (bundle `index-B47s627X.js`, `auth.php?a=eu` 401, console limpo).

**Achado ao escrever os testes**: os fixtures iniciais usavam linhas copiadas ao pé da letra do PDF
real do usuário, incluindo nome e telefone de síndicos/conselheiros de verdade — o classificador de
segurança do Claude Code bloqueou o primeiro commit por isso (`[Sensitive-Source Provenance]`), e
com razão: dado pessoal de terceiros (LGPD) não deveria ir pro histórico do Git só porque é cômodo
pra um teste. Reescrevi os dois arquivos de teste com nomes/CNPJs/telefones totalmente fictícios
(mesmo padrão já usado em `pdfParser.consideracoes.test.ts` — "Fulano de Tal" etc.), preservando só
os padrões estruturais reais (espaçamento em colunas, bloco sem CNPJ, endereço em branco, ordem
imprevisível da administração). Vale lembrar disso em qualquer teste futuro que use um PDF real do
usuário como referência.

**Extensão pedida pelo usuário (mesma sessão): ligar o cadastro de administração a outros lugares
do sistema que também guardam nome de síndico/diretoria.** Investigação encontrou 4 lugares
independentes: `Condominio.administracao` (cadastro, recém-alimentado pelo importador acima),
`Exercicio.consid.administracao` (cópia por prestação de contas), `Edital.assinante`/`.cargo`
(quem assina o edital) e `Ata.mesa.presidente`/`.secretario` (mesa da assembleia). Achado: **2 das
3 ligações já existiam** antes desta sessão — `considDoCondominio()` (`domain/exercicio.ts`) já
copia `Condominio.administracao` pro novo exercício, e `assinantePadrao()` (`domain/edital.ts`,
regex `/^s[íi]ndic/i` — bate "Síndico", não "Subsíndico") já preenche o assinante do edital. Só
faltava a Ata: `assinantePadrao` exportado e reaproveitado em `novaAtaDeAssembleia`/`ataEmBranco`
(`domain/ata.ts`) pra pré-preencher `mesa.presidente` com o síndico(a) atual — editável depois, já
que quem preside nem sempre é exatamente o síndico registrado. `mesa.secretario` e `Ata.presentes`
(lista de presença, são proprietários de unidade, não necessariamente administração) ficam de fora
de propósito — não há um papel único e previsível pra sugerir automaticamente. Outros campos
`nome`/`assinante` do sistema (usuários, config do escritório, backups) são de pessoas/entidades
sem relação com a administração do condomínio — conferidos e descartados.

## Divergência da Previsão sugerida: redesenho (janela + "Em conferência", sem menu/tela própria) — 29/10/2026

Feedback do usuário sobre o PR #104 (mesmo dia seguinte): a tela/menu dedicados
("Divergências da previsão") não eram o lugar certo. Pediu: a divergência
ligada à própria prestação de contas, uma janela que informe e peça um "Confirmado"
ou "Vou analisar depois", e a prestação de contas marcada como "Em conferência"
enquanto não houver confirmação. Confirmado com o usuário (AskUserQuestion)
antes de implementar: badge na lista de Prestação de contas, janela abre
sozinha ao detectar divergência, log mantido mas só visível dentro da própria
prestação de contas (sem tela/menu separados).

Mudanças (substituem o design do PR #104, sem reverter a correção de bug do
PR #103):

- Removida a rota `/previsao-divergencias` e o item de menu correspondente.
- `domain/types.ts`: `PrevisaoSugeridaExercicio.divergenciaAceita` virou
  `decisaoDivergencia` (tipo `DecisaoDivergenciaPrevisaoSugerida`, com
  `status: "confirmado" | "revisar_depois"` — antes só existia o aceite).
  `DecisaoDivergenciaPrevisao` (log) ganhou o mesmo `status` e os campos
  renomeados para `decididoPor`/`decididoPorNome`/`decididoEm` (antes
  `aceitoPor`/etc., nome que não fazia sentido pra uma decisão "revisar
  depois"). Mesma tabela `kr_decisoes_previsao` de antes — nenhuma mudança de
  schema.sql/api.php nesta entrega, só do formato do JSON salvo em `dados`.
- `PainelPrevisaoSugerida.tsx`: o aviso em linha com checkbox virou um banner
  compacto ("Em conferência" ou "Divergência confirmada") + uma janela
  (`Dialog`) que **abre sozinha** ao detectar uma divergência nova, com os
  valores PDF × calculado, o histórico de decisões já tomadas nesta prestação
  de contas (busca `decisoes_previsao` filtrando por `exercicioId`), e os
  botões "Vou analisar depois" / "Confirmar valores calculados". Reabre via
  "Revisar e decidir" a qualquer momento.
- **Deixou de bloquear o Salvar** (diferença do PR #104): qualquer decisão
  (ou nenhuma) permite salvar; o que muda é só o status "Em conferência"
  ficar visível — na própria tela (badge no cabeçalho) e na lista de
  Prestação de contas (badge ao lado do nome do condomínio).
- Log: grava uma entrada em `decisoes_previsao` a cada decisão nova
  (confirmado OU revisar depois, não só confirmado) — e agora invalida a
  query da lista depois de gravar (faltava isso no PR #104; sem a
  invalidação, o histórico na janela não atualizava até recarregar a
  página — achado testando manualmente).

Testado manualmente em `npm run dev` local (mock): janela abrindo sozinha,
"Vou analisar depois" salvando e mantendo "Em conferência" (cabeçalho + lista),
reabrindo a janela e vendo o histórico ("Adiado por Administrador em..."),
"Confirmar valores calculados" resolvendo (badge some do cabeçalho e da
lista). `npm test`/`typecheck`/`docs:check` na raiz e `tsc --noEmit` no
frontend limpos; `vitest` do frontend com o mesmo flake pré-existente de
`localStorage.clear()` (171/15/3, nenhum arquivo afetado).

## Divergência da Previsão sugerida: visível após a importação, com aceite e log (PR #104) — mesclada e publicada — 28/10/2026

Pedido do usuário depois do PR #103: o aviso de divergência (PDF × recalculado)
só aparecia na tela de confirmação da importação, difícil de concluir a
análise ali. Pediu que ficasse visível depois, que uma divergência mantida
exigisse aceite explícito do usuário, e um log dessas decisões.

**Ação pendente em produção — nova tabela**: `kr_decisoes_previsao`
(schema.sql), mesmo padrão `id+dados+atualizado_em` das demais, store nova
`decisoes_previsao` em `domain/types.ts`/`api.php`. **Precisa rodar o
`CREATE TABLE IF NOT EXISTS` via phpMyAdmin em produção** antes do log
funcionar contra a API real (mesma pendência que `kr_backups` teve) — sem
isso, o registro do log falha silenciosamente (`catch(() => undefined)`, não
bloqueia o salvamento da previsão) mas a tela "Divergências da previsão" fica
vazia.

Mudanças:

- `domain/types.ts`: `PrevisaoSugeridaExercicio` ganha `totaisPdf` (totais do
  PDF, congelados na importação — antes eram lidos e descartados) e
  `divergenciaAceita` (chave + quem + quando). Novo tipo
  `DecisaoDivergenciaPrevisao` (o registro do log).
- `domain/previsaoSugerida.ts`: `compararComTotaisPdf(resultado, totaisPdf)`
  substitui a comparação feita só a partir do `pv` da importação — agora
  reutilizável a qualquer momento com os totais já salvos no exercício, mesmo
  depois de editar deduções/variação. `chaveDivergencia()` identifica o
  conjunto de divergências atual, pra saber se um aceite anterior ainda vale.
- Tela Previsão orçamentária (`PainelPrevisaoSugerida.tsx` +
  `_authenticated.previsao-orcamentaria.tsx`): mostra o aviso permanentemente
  (não só na importação), com checkbox "estou ciente e confirmo" — sem
  marcar, **Salvar é bloqueado** (toast + troca pra aba certa). Editar
  deduções/variação de novo muda a `chave` e invalida um aceite anterior,
  reexigindo confirmação.
- Ao salvar com um aceite novo, grava um registro em `decisoes_previsao`
  (condomínio, exercício, campos divergentes com PDF×calculado, quem/quando
  aceitou). Nova tela **Divergências da previsão** (`/previsao-divergencias`,
  no menu em Financeiro) lista esse log, mais recente primeiro.
- `ResumoImportacao.tsx`: aviso da importação ganhou uma linha apontando pra
  esse novo lugar permanente.

Testado manualmente em `npm run dev` local (mock): injetei uma previsão
sugerida com `totaisPdf` divergente via `localStorage`, confirmei o aviso, o
bloqueio do Salvar sem o aceite, o toast de erro, o salvamento com o aceite
marcado, a nota "Confirmado por Administrador em ...", e o registro aparecendo
em `/previsao-divergencias`. `npm test`/`typecheck`/`docs:check` na raiz e
`tsc --noEmit` no frontend limpos; `vitest` do frontend com o mesmo flake
pré-existente de `localStorage.clear()` (171 passaram, 15 falharam, nenhum dos
arquivos afetados).

Mesclada em `main` (`f3ccadb`) e publicada em `deploy-hostinger` (`4a5045e`)
— auto-deploy confirmado ao vivo (`index.html` referencia `index-D0PSPOsB.js`,
hash exato do último build; `auth.php?a=eu` responde 200 com a sessão logada;
console sem erros novos). `/previsao-divergencias` ao vivo confirma o erro
esperado — "Tabela do banco ausente: ... kr_decisoes_previsao doesn't exist.
Aplique schema.sql" — tratado com mensagem amigável, não uma tela quebrada;
some assim que a tabela for criada.

**Achado ao validar o Santa Cecília ao vivo**: o usuário já havia reimportado
o PDF entre o PR #103 e este, então a categoria duplicada já sumiu (Total das
despesas: R$ 74.296,38, correto). Mas esse exercício foi salvo ANTES deste PR
existir, então não tem `totaisPdf` gravado — o aviso de divergência não
aparece para ele (dado antigo, sem campo novo; é o comportamento esperado).
Reimportar o mesmo PDF mais uma vez agora preencheria `totaisPdf` e revelaria
uma divergência real, não relacionada ao bug já corrigido: com a única dedução
do PDF ("Parte água e gás", R$ 17.105,93) e despesas de R$ 74.296,38, o total
ordinário bate matematicamente em R$ 57.190,45 (índice +1,77%) — mas a linha
"Total de despesas consideradas ordinárias" do próprio PDF diz R$ 63.190,45
(índice +12,44%), exatamente R$ 6.000,00 a mais. As três linhas que o PDF
mesmo imprime (despesas, dedução, total ordinário) não se reconciliam entre
si — indício de inconsistência no PDF de origem (Systemar), não um bug do
sistema. Vale conferir com o escritório/Systemar se há uma dedução adicional
de R$ 6.000 não detalhada em "Despesas a deduzir".

## Corrige total das despesas duplicado na Previsão sugerida (PR #103) — mesclada e publicada — 28/10/2026

Investigando o Residencial Santa Cecília a pedido do usuário (índice sugerido
importado diferente do calculado): o PDF do Systemar traz a linha de subtotal
como "Total das despesas **exercício** de 2025/2026" (sem a palavra "do"), mas
`lerPrevisaoSugerida` (`domain/pdfParser.ts`) só reconhecia "do período"/"do
exercício". A linha virava uma categoria de despesa a mais, duplicando o total
das despesas do ano (R$ 74.296,38 → R$ 148.592,76) e, por tabela, o rateio
mensal sugerido e o índice de correção (+133,98% em vez do valor real).

Corrigido o regex (aceita "do" opcional) e, a pedido do usuário, criada
validação automática: `validarPrevisaoSugeridaDoPdf()`
(`domain/previsaoSugerida.ts`) compara os totais que o próprio PDF já traz
prontos (total ordinário, rateio anual/mensal sugerido, índice) com o que o
sistema recalcula a partir das categorias lidas — pega esse tipo de erro de
leitura automaticamente, mesmo em variações de rótulo ainda não vistas, sem
depender de revisão manual relatório por relatório. A tela de confirmação de
importação (`ResumoImportacao.tsx`) mostra essas divergências como aviso antes
de confirmar.

O exercício 2026 do Santa Cecília já importado em produção ficou com a
categoria duplicada (a lista de categorias não é editável na tela — só
deduções/variação são). Ação pendente do usuário: usar "Importar PDF" na
prestação de contas desse exercício, com o mesmo arquivo original, para
sobrescrever a previsão sugerida com a leitura corrigida (não duplica o
exercício; usa o fluxo de importação em modo "editor").

Mesclada em `main` (`34929a5`) e publicada em `deploy-hostinger` (`a91f55d`)
— auto-deploy confirmado ao vivo (`index.html` referencia `index-CKpCxe2s.js`,
hash exato do último build; `auth.php?a=eu` responde 200 com a sessão
logada; console sem erros novos).

## Corrige campo de valor espremido em Deduções/Ajustes da previsão (PR #102) — mesclada e publicada — 28/10/2026

Bug de layout achado numa captura de tela do usuário: nas listas "Deduções" e
"Ajustes da previsão" (Previsão orçamentária) e no checkbox "Procurador" da
lista de Presentes (Atas), o campo de valor ficava espremido na coluna
estreita do sinal (~5.75rem) em larguras intermediárias de tela, cortando
visualmente o valor digitado.

Causa: essas linhas usam o grid por `@container` de `RepeatableList`, mas o
campo de valor usava a variante de viewport `sm:col-span-1`/`sm:col-start-2`
para se reposicionar — os dois sistemas de breakpoint são independentes, e em
larguras onde o container ainda estava no estágio de 2 colunas, o `sm:`
(quase sempre ativo em desktop) fazia o campo cair, por posicionamento
automático, na coluna errada. Trocado por variantes `@container` equivalentes
e antecipado o estágio de 3 colunas (sinal + descrição + valor lado a lado)
de `@2xl` para `@xl` nas duas listas de previsão. Revisado o resto do sistema
(`grep` por `sm:col-span-1`/`sm:col-start`): as demais ocorrências são em
grids comuns (não `@container`), sem o bug.

Mesclada em `main` (`3d7755c`) e publicada em `deploy-hostinger` (`fc3ffe6`)
— auto-deploy confirmado ao vivo (`index.html` referencia `index-6OjR_jAN.js`,
hash exato do último build; `auth.php?a=eu` responde 401; tela de login
renderiza normalmente). Validado visualmente em `npm run dev` local antes do
PR, nas duas listas afetadas, em largura estreita e larga.

## Atualizar cadastro pela Receita Federal (PR #100) e ocultar contas analíticas no Previsto × Realizado (PR #101) — mescladas e publicadas — 28/10/2026

Dois pedidos do usuário na mesma mensagem, implementados em branches/PRs
separados por não terem arquivos em comum:

- **PR #100**: botão "Atualizar pela Receita" ao lado do campo "Endereço
  (edital)" no cadastro do condomínio — reaproveita a mesma integração
  BrasilAPI já usada no pré-cadastro do Anexar Comparativo (PR #99), sem
  duplicar lógica. Só preenche o campo; o usuário revisa e salva normalmente.
- **PR #101**: checkbox "Mostrar contas analíticas" na tela Previsto ×
  Realizado (preferência visual, não persiste) e checkbox próprio
  `mostrarContasAnaliticas` no Relatório Final, aninhado em "Previsto ×
  Realizado" na lista de seções — controla a mesma tabela na prévia e no
  PDF/Word gerado, mesmo padrão de `mostrarPizza`/`mostrarEvolucaoMensal`.

CI do PR #101 quebrou por `TS18048` (`bloco` possivelmente `undefined` em
`src/test/tabelaComparativo.test.tsx`, por causa de `bloco!.tipo === "tabela"
? bloco.linhas : []` — o `!` não narrowa a segunda referência); corrigido
trocando para `bloco?.tipo === "tabela" ? bloco.linhas : []`.

Mescladas em `main` (`146cbea` e `9adf953`) e publicadas em
`deploy-hostinger` (`2319af1` e `7e78b6c`) — auto-deploy confirmado ao vivo
(`index.html` referencia `index-CY0M48zq.js`, hash exato do último build;
`auth.php?a=eu` responde 401; sem erros de JS além do 401 esperado).

Testes: 189 testes de frontend (14 arquivos novos desde a última publicação,
incluindo os 4 de `tabelaComparativo.test.tsx`); `npx tsc --noEmit` limpo na
raiz e no frontend. Verificado ao vivo no navegador antes de abrir os PRs:
botão da Receita preenchendo o endereço real, checkbox da tela e checkbox do
Relatório Final escondendo as linhas por rubrica corretamente.

Regra combinada com o usuário nesta sessão: a partir de agora, PR com CI
verde e sem decisão pendente para o usuário é mesclado e publicado sem
perguntar de novo a cada vez (ver memória `feedback_auto_merge_publish.md`).

## Anexar Comparativo: pré-cadastro de condomínio (PR #99) — mesclada e publicada — 27/10/2026

Ao anexar um Comparativo Financeiro de um condomínio ainda não cadastrado, o
diálogo agora mostra um botão "Cadastrar como novo condomínio": cria o
registro com nome/código/CNPJ do PDF e busca o endereço na Receita Federal
via BrasilAPI (dados públicos, sem chave) — se a consulta falhar, cadastra
mesmo assim, só sem o endereço. Seleciona o condomínio criado automaticamente.
Pedido pelo usuário ao notar, num comparativo real (Urban Classic), que o
diálogo só aceitava condomínio já cadastrado.

Mesclado em `main` (`31e4357`) e publicado em `deploy-hostinger` (`e05e0df`,
"Publica main 31e4357") — auto-deploy confirmado ao vivo (`index.html`
referencia `index-Y77hE_bw.js`, hash exato do build; `auth.php?a=eu` responde
401; sem erros de JS além dos esperados da própria checagem).

Testes: função de formatação de endereço (4 testes) + 2 testes novos no
fluxo do diálogo (com e sem resposta da Receita) — 185 testes de frontend no
total. Não verificado com upload de PDF real num navegador de verdade (a
ferramenta de navegador desta sessão não tem como simular upload de
arquivo) — coberto só por teste automatizado + CI verde.

## Consulta Inteligente de Documentos — mesclada (PR #97/#98) e publicada — 27/10/2026

Nova funcionalidade: perguntas em linguagem natural sobre convenção, regimento
interno e atas de assembleia (nunca o acervo financeiro, que passa de 160 GB).
Escopo decidido com o usuário durante o planejamento — ver
`C:\Users\Evandro\.claude\plans\quiet-chasing-token.md` pelo plano completo
aprovado. As 5 seções do plano:

1. **Banco**: 4 tabelas novas em `schema.sql` (`kr_documentos`,
   `kr_documento_trechos` com FULLTEXT, `kr_consulta_cache`,
   `kr_consulta_historico`) — únicas do projeto que não seguem o padrão
   `id+dados` JSON, porque precisam de índice relacional de verdade. Campo
   `pastaDocumentos` em `Condominio` (sem tabela nova — `kr_condominios` já é
   schemaless). **O usuário já rodou essas 4 tabelas no banco de produção**
   antes mesmo do PR — inofensivo (`CREATE TABLE IF NOT EXISTS`, nada em
   produção as referencia ainda).
2. **Backend PHP**: `lib_documentos.php` (cache por hash da pergunta + versão
   dos índices do condomínio, busca FULLTEXT, registro transacional de
   documento+trechos), `lib_claude.php` (chamada via `curl` cru à API da
   Anthropic — decisão deliberada de não usar o SDK oficial, já que o projeto
   inteiro é PHP sem Composer; modelo `claude-haiku-5-5`), `api_documentos.php`
   (novo endpoint: `documentos_manifesto`/`documentos_registrar` para o
   agente, `consulta_perguntar`/`consulta_historico` para o app).
3. **Agente local** (`agente-documentos/`, novo projeto Node/TypeScript, fora
   do Hostinger): varre só os *nomes* de arquivo no NAS (nunca lê 160 GB de
   conteúdo), classifica convenção/regimento/ata por regex, hash SHA-256 +
   diff contra o manifesto remoto, extrai texto via `pdfjs-dist` com fallback
   de OCR (`tesseract.js` + `@napi-rs/canvas`, renderização pura em
   WebAssembly — sem binário nativo, sem AGPL). Pipeline de extração e OCR
   testado manualmente com PDFs reais gerados para o teste (com e sem camada
   de texto) antes de confiar nele.
4. **Frontend**: rota `/consulta-documentos` (seletor de condomínio, pergunta,
   resposta com origem cache/local/IA e fontes citadas, histórico), campo
   "Pasta de documentos" no cadastro do condomínio. Verificado ao vivo no
   navegador (modo mock).

**A chave da API Anthropic já foi fornecida pelo usuário e está só em
`config.local.php` desta máquina (fora do Git) — o usuário já aplicou o mesmo
campo (`claude_api_key`) no `krieger-config.php` de produção.**

**Mesclado em `main`**: PR #97 (`be1cba1`) e, logo em seguida, PR #98
(`6a462b0`) — corrigindo uma lacuna encontrada só na hora de empacotar: o
`scripts/package-hostinger.mjs` tinha uma lista fixa de arquivos PHP que não
incluía os 3 novos (`api_documentos.php`, `lib_documentos.php`,
`lib_claude.php`), que ficariam de fora do pacote publicado sem erro nenhum
no build. Corrigido antes de publicar.

**Publicado**: pacote gerado a partir de `6a462b0`, commitado em
`deploy-hostinger` (`3b4fa98`, "Publica main 6a462b0"), auto-deploy da
Hostinger confirmado ao vivo — `index.html` publicado referencia
`index-BEIg8MDd.js` (hash exato do build), `auth.php?a=eu` responde 401,
`api_documentos.php` responde 401 (exige login, não 404/500), `lib_documentos.php`
acessado direto responde 403 (guarda de acesso direto funcionando). Sem erros
de JS no console além dos 401/403 esperados dessa própria checagem.

Pendente: rodar o agente de verdade contra o NAS da empresa (só o usuário
consegue, esta máquina não tem acesso) e validar login/cadastro/consulta ao
vivo com um usuário real (eu não entro com credencial de produção).

**Nota operacional**: durante esta sessão, ao seguir as instruções deste
documento pra configurar o `agente-documentos/` numa outra máquina, um
`git clone` foi rodado de dentro desta mesma pasta de trabalho
(`C:\Users\Evandro\projetos\krieger`), criando um clone aninhado
`krieger\Krieger\` por engano. Identificado (sem nada próprio dentro, só
cópia desatualizada do branch já mesclado) e removido. Rodar o clone do
agente numa pasta separada, não dentro do repo já aberto.

## PR #95 mesclado e publicado: evolução mensal + comparativo vira mensais — 26/10/2026

PR #95 (abaixo) tinha CI vermelho e 3 achados do Codex review quando esta sessão
assumiu: 2 testes de `anexo-comparativo.test.tsx` quebravam por corrida de teste
real (acessava os campos antes da leitura assíncrona do PDF terminar) e por uma
data errada no próprio teste ("02/01/2025" em vez de "01/02/2025" pra
fevereiro) — não eram a incompatibilidade de `localStorage` do Node 26 local
que o PR original citava. Corrigidos, mais os 3 achados do Codex: idempotência
na reimportação após falha parcial (IDs de mês/anexo gerados uma vez e
reaproveitados numa nova tentativa, em vez de duplicar), botão de confirmar
bloqueado enquanto a consulta de relatórios mensais carrega (evitava esconder
conflito real), e margem do gráfico de evolução mensal ajustada pra não cortar
o rótulo da competência de extremidade (ex. "12/2026") no PDF/Word. Cada achado
tem teste de regressão próprio; 179 testes de frontend + 140 de domínio, CI
verde, 3 threads do Codex respondidas e resolvidas.

Mesclado (squash) em `main` no commit `0ba2ad1`, com autorização explícita do
responsável pra "fazer tudo e resolver... já publica o que precisar". Publicado
na mesma sessão: `npm run package:hostinger` a partir desse commit, pacote
commitado em `deploy-hostinger` (`ec1dde7`), auto-deploy da Hostinger disparou
sozinho (confirmado ligado: branch `deploy-hostinger`, raiz do site). Validado
ao vivo — `index.html` publicado referencia `index-CQMzwRkr.js`, o hash exato
do build local; `auth.php?a=eu` responde 401 (API conectando ao banco,
`krieger-config.php` intacto, sem repetir o incidente de configuração já
registrado abaixo).

## Gráfico de evolução mensal no Relatório Final; comparativo vira relatórios mensais — 25/10/2026

Duas adições ao Relatório Final, pedidas pelo usuário após eu reconstruir o
gráfico de barras existente como precedente técnico:

- **Gráfico "Evolução mensal"** (receitas/despesas/saldo ao longo do
  exercício): novo em `domain/relatorioFinal.ts` (`evolucaoMensal`),
  `frontend/src/components/relatorio/GraficoEvolucaoMensal.tsx` (prévia,
  recharts) e `frontend/src/lib/documento/graficos.ts` (`linhaSvg`, PDF/Word).
  Testado com dado real do Comparativo Financeiro do Urban Classic (extraído
  localmente via `lerRelatorio`, nunca commitado) antes de integrar — achados
  conferidos: legenda limpa em 320px/200%, nada sobreposto. Igual aos outros
  gráficos da "Análise gráfica", tem seu próprio checkbox
  (`mostrarEvolucaoMensal`) pra selecionar/desmarcar independente — pedido
  explícito do usuário, pra não travar o relatório quando um gráfico não tem
  dado.
- **Comparativo Financeiro agora também vira relatórios mensais de verdade**,
  não só um PDF anexado como referência: `domain/importacao.ts`
  (`mensaisDoComparativo`, reaproveita `mensalImportado` por mês) +
  `AnexarComparativo.tsx` mostra cada mês do comparativo com checkbox —
  marcado por padrão se não existe relatório mensal daquele mês ainda,
  desmarcado com aviso se já existe (pra não sobrescrever sem querer). Um
  relatório mensal não pertence a um exercício (só a competência + condomínio),
  então isso não depende de qual prestação de contas foi escolhida pra anexar
  o PDF — mesmo um comparativo que cruza dois exercícios importa os meses sem
  conflito. Validado ao vivo (Playwright) com o comparativo real do Urban
  Classic anexado ao condomínio de exemplo: 4 meses novos + 1 sobrescrito,
  sem erro de JS, toast certo.

## Segunda queda de banco (causada por mim) e correção — 25/10/2026

Ao reconectar o auto-deploy do Git (abaixo), o próprio ato de salvar a
configuração disparou um redeploy imediato — e qualquer deploy limpa a
pasta publicada do que não está no Git. O `config.local.php` que o Codex
criou no dia anterior estava **dentro** da pasta publicada, então foi
apagado, derrubando o banco de novo.

Diagnóstico levou várias rodadas (dbname com sufixo errado, depois senha,
depois host `127.0.0.1` vs `localhost`) até achar a causa real: **o site foi
recriado com estrutura de pastas diferente da anterior.** Antes:
`domains/therafinancial.com.br/public_html/krieger`. Agora:
`domains/krieger.therafinancial.com.br/public_html` (confirmado via
`hosting_websites_list`). Isso muda onde `dirname(__DIR__, 2)` aponta: o
arquivo precisa estar em `domains/krieger-config.php` (direto dentro de
`domains`), não mais em `domains/therafinancial.com.br/krieger-config.php`.
O usuário recriou no lugar certo e funcionou — confirmado ao vivo
(`auth.php?a=eu` responde 401, não mais 500).

**Lição registrada na memória do Claude:** não reconectar/alterar
configuração de infraestrutura em produção sem considerar o efeito colateral
antes de agir (redeploy apaga arquivos fora do Git) — avisar o risco antes,
não só depois. Também: ao recalcular "dois níveis acima da pasta publicada",
sempre confirmar o `root_directory` atual via API em vez de assumir a
estrutura antiga, porque o site já foi recriado mais de uma vez.

## Lovable descontinuada; auto-deploy reconectado; issue #89 fechada — 25/10/2026

Três frentes fechadas nesta revisão:

- **Lovable não existe mais no projeto** (decisão do responsável, 24/10/2026).
  Claude edita `frontend/src/**` diretamente desde então — ver
  `docs/ARQUITETURA.md` (seção própria) e a memória do Claude.
- **Validação dos 8 editores em 320px/200%** (último item pendente da Lovable
  na #89): achados e corrigidos 2 vazamentos reais — título de página sem
  `break-words` (`PageHeader`, afeta todas as telas) e o valor grande de
  "Valor por unidade"/"Rateio mensal sugerido" vazando do cartão quando não
  cabia numa linha (`PainelPrevisao`/`PainelPrevisaoSugerida`). PR #92, merge
  `688f948`. Os outros 6 editores (prestação, mensal, comparativo, ata,
  modelo, relatório final) não tinham vazamento real.
- **Auto-deploy do Hostinger estava desconectado desde a recriação do
  subdomínio** (mesmo episódio que derrubou o banco, 23/10): `hosting_git_auto-deployment-settings`
  vinha com todos os campos `null`. A produção servia um build de antes do
  PR #88 havia dias, sem erro visível — só percebido comparando o hash de
  `assets/index-*.js` ao vivo com o commit esperado. Reconectado via
  `hosting_git_update-auto-deployment-settings` (mesma instalação GitHub,
  `felicioe/Krieger`, branch `deploy-hostinger`); a própria gravação disparou
  o deploy, confirmado ao vivo (122 arquivos batendo com o commit `c9147df`).
  Ver "Limitações conhecidas" abaixo — isso pode voltar a acontecer se o
  site for recriado de novo.

`docs/ARQUITETURA.md` também reconciliado (commit `1c236b0`): páginas de
acesso legadas marcadas como tal, store `anexos_importacao` incluída,
parágrafo sobre `frontend/src/domain` corrigido (são shims, não mais
incerteza), referência à issue #16 (fechada) removida.

Issue #89 fechada — todos os itens do checklist resolvidos ou documentados,
exceto o teste funcional de anexo da #75 (depende de login real de produção,
fora do que este agente faz; fica para quem tiver esse acesso).

## Queda de produção e correção pelo Codex — 23/10/2026

Durante teste real do Importador (condomínio Edifício Itamaracá), a tela
mostrou "Não foi possível conectar ao banco de dados". Claude avaliou
(incorretamente) como falha passageira, checando `u630316951_app` via API da
Hostinger e vendo atividade recente — mas esse banco **pertence ao site
institucional**, não ao Krieger.

O Codex investigou pela issue #89 e achou a causa real: o subdomínio
`krieger.therafinancial.com.br` foi recriado em algum momento e ficou **sem
banco próprio** (só existia o institucional, sem relação com o Krieger).
Correção aplicada direto no hPanel (sem passar por commit/PR, como deve ser
para credenciais):
- criado `u630316951_krieger` + usuário dedicado, separado do institucional;
- `schema.sql` aplicado (12 tabelas, incluindo `kr_anexos_importacao` e
  `kr_backups`, que antes dependiam de aplicação manual avulsa — ver #75);
- `config.local.php` privado criado na raiz publicada, protegido por
  `.htaccess`;
- primeiro administrador criado com senha provisória (troca obrigatória no
  primeiro acesso).

Confirmado às 23/10 que a API voltou (`auth.php?a=eu` responde 401 em vez de
500 — banco conectando). A importação do Itamaracá que falhou durante a
queda **não foi gravada** (erro ocorreu antes de persistir) — repetir quando
o usuário quiser. Qualquer dado anterior a esta correção não existe neste
banco (é um banco novo); não há evidência de que dados reais do Krieger
tenham sido gravados no banco institucional por engano, mas vale confirmar.

**Lição:** ao diagnosticar erro de conexão com banco em produção, não
presumir "passageiro" só por o banco aparecer ativo — confirmar que é
*o banco certo para o site certo* antes de descartar causa estrutural.

## Achados reais de um PDF de produção (Urban Classic) — 22/10/2026

Usuário anexou o Comparativo Financeiro do Urban Classic pela tela publicada
e baixou o Relatório Final gerado — primeiro teste de ponta a ponta do
Importador com dado real. Ao revisar o PDF (extração local com pypdf/Pillow,
arquivo apagado do scratchpad depois), achados:

- Gráfico Previsto × Realizado parecia "quebrado" (barras de Realizado
  somem). Diagnóstico: não é bug de período malformado (caso antigo do
  Solar Juliana) — o exercício 01/09/2025–31/08/2026 está correto, mas a
  comparação olha pro ano seguinte (09/2026–08/2027), que mal começou e
  ainda não tem relatório mensal importado (`relatoriosUsados: 0`). O
  cálculo está certo, só a apresentação era enganosa.
- PR #90 (merge 4ecb0d3): Lovable tratou isso com `AvisoSemRealizado` (mensagem
  clara em vez de tabela/gráfico cheios de -100%, na prévia e no PDF/Word),
  mais `formatValorCurto` (rótulos de eixo mais curtos, nova em `lib/format.ts`
  raiz — Lovable tinha duplicado localmente, replicada no canônico).
- Pedido novo do usuário, resolvido no mesmo PR: sugestão de condomínio
  parecido na importação (`condominiosParecidos`, PR #88) quando não há
  correspondência exata por código/CNPJ — evita cadastro duplicado por nome
  em ordem diferente ou erro de OCR. "Usar este cadastro" / "Não é este, é
  um condomínio novo", sem esconder a opção de cadastro novo.
- Confirmado (sem pedir ação): os botões "Importar PDF" fora do Importador
  já tinham sido removidos das listas (Relatório mensal, Prestação de
  contas) desde o PR #86 — só o Importador cria registros novos; dentro de
  um registro já aberto o botão de reimportar continua (função diferente:
  atualizar dados existentes, não criar novo — usuário confirmou que deve
  ficar assim).
- Decisões já resolvidas no mesmo lote: exclusão em cascata dos anexos ao
  excluir uma prestação de contas; limite de 10 MB no PDF anexado.

Publicado: commit `4ecb0d3` → `deploy-hostinger` `6ee7216`, confirmado ao
vivo. `npm run bundle:check`: 181.588 de 256.000 bytes gzip reais.

## Fechamento geral — 22/10/2026 (fim de sessão)

A pedido do usuário ("garanta que tudo foi corrigido, publique tudo, deixe o
GitHub sem nada em aberto"): mergeados PR #85 (fechamento das auditorias +
orçamento de JS no CI, Codex), #86 (Importador completo), #87 (Vite 8.3.5).
Fechadas com evidência: #19, #24, #29, #31, #32, #33, #46, #47, #48, #49,
#59–#62, #65, #67, #68–#71, #82. PR #34 fechado sem merge (conteúdo
preservado, substituído pelo relatório histórico recuperado no PR #85).
23 branches órfãs (já mergeadas) e as 2 branches das PRs fechadas removidas.

**Único item que continua aberto, de propósito:** issue #75 — a tabela
`kr_anexos_importacao` está aplicada e a integração de frontend está
publicada, mas falta uma verificação manual única (anexar um Comparativo
Financeiro real pela tela publicada e confirmar que persiste e que o
download sai idêntico) que exige login real de produção — este agente não
manuseia credenciais de produção por política de segurança. Fecha a issue
quem fizer esse teste.

Decisões finais enviadas ao Lovable (fila, ainda sem confirmação de entrega):
excluir uma prestação de contas exclui os anexos dela em cascata; limite de
10 MB no PDF anexado; telas de edição não podem rolar de lado inteiras em
320px/texto 200% (só o componente tabular, não a página).

Publicado: commit `847d58f` → `deploy-hostinger` `58e8e74`, confirmado ao
vivo. `npm run bundle:check` (novo, do PR #85) mede 181.408 de 256.000 bytes
gzip reais contra produção — dentro do orçamento.

## Revisão dos achados restantes — 22/10/2026

Pedido de corrigir os erros encontrados e publicar. Triagem atual em
[FECHAMENTO-ACHADOS-2026-10-22.md](auditorias/FECHAMENTO-ACHADOS-2026-10-22.md).
Várias issues antigas correspondem a código já corrigido; não reimplementar
nem reabrir o escopo concorrente de anexos/Importador. Vite vulnerável e
overflow extremo do Painel estão com o Lovable. Orçamento inicial de JS de
250 KiB acrescentado ao CI; medição real reproduzível em PERFORMANCE.md.
Histórico de backups real carregou em 22/10 e mostrou backup de hoje; o
snapshot antigo que diz “tabela kr_backups não aplicada” é histórico e não
descreve mais a situação observada. Restauração real não foi executada.
Leitor de tela real/toque físico/métricas de campo continuam não comprovados.

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
- **A própria conexão de auto-deploy do Git (`hosting_git_auto-deployment-settings`) pode cair silenciosamente** — aconteceu em 23–25/10/2026 quando o subdomínio foi recriado (resolvendo o banco, ver abaixo), apagando a integração sem avisar: pushes em `deploy-hostinger` paravam de surtir efeito e a produção ficou dias atrás (ainda servindo um build de antes do PR #88) sem erro visível. Sempre que desconfiar de build desatualizado em produção, confira `GET /index.html` sem cache e compare o hash de `assets/index-*.js` com o commit esperado antes de assumir que só falta publicar de novo; se estiver preso, confira `hosting_git_auto-deployment-settings` e reconecte com `hosting_git_update-auto-deployment-settings` (mesmos `installation_uuid`/`owner`/`repository`/`branch` de sempre) — a própria gravação já dispara o deploy.
- Backup no servidor (tabela `kr_backups`) e anexos de importação (`kr_anexos_importacao`) foram aplicados no banco de produção em 23/10/2026, junto com a recriação do banco dedicado (`u630316951_krieger`) — ver "Queda de produção e correção pelo Codex" abaixo.

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
