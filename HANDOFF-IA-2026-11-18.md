# Handoff técnico — Previsto × Realizado / Lago Negro

**Data:** 18/11/2026  
**Projeto:** `C:\Users\Evandro\projetos\krieger`  
**Repositório:** https://github.com/felicioe/Krieger  
**Branch atual:** `main`  
**Branch publicada:** `deploy-hostinger`  
**Produção:** `https://krieger.therafinancial.com.br/`

## Objetivo do usuário

Resolver o comparativo/tela de previsão do CONDOMINIO RURAL LAGO NEGRO, exercício 2026. A captura de 18/11/2026 mostra a rota `/#/previsao-orcamentaria?modo=relatorios`, tabela agrupada com **Realizado = Previsto** em todos os grupos e total **R$ 982.212,87**, variação **0,00%**. O usuário diz que ainda está errado e pediu este handoff para outra IA continuar o projeto.

### Regra de negócio declarada pelo usuário (não rediscutir)

- Base correta para a projeção do relatório: despesas importadas/realizadas da prestação-base: **R$ 851.955,11**.
- O índice aprovado é **15,26%** (usuário mostrou o valor aprovado/digitado; pode ter sido valor fixo de reajuste, é necessário inspecionar dados do exercício para identificar método/campos, não presumir).
- Esperado: base × 1,1526 ≈ **R$ 982 mil** (valor exato depende de deduções/ajustes; usuário já mostrou aproximadamente R$ 982.053 numa conversa anterior).
- Realizado deve continuar sendo a soma bruta dos relatórios mensais importados do exercício comparado; não substituir por despesas da prestação-base nem aplicar índice no realizado.
- Variação da última coluna voltou a ser considerada importante; a coluna deve refletir o comparativo correto, não ficar artificialmente zerada.
- 2026 é o exercício mostrado; não usar por engano as despesas importadas de 2025 como realizado mensal.

## Situação verificada neste turno

1. O usuário mostrou print de hPanel > Implantações: repo GitHub `felicioe/Krieger`, branch `deploy-hostinger`, implantação manual marcada Concluída/Atual.
2. Hostinger API `hosting_get-deployment` informou Git auto-deploy enabled, repo `felicioe/Krieger`, branch `deploy-hostinger`, directory vazio (raiz do site).
3. Foi chamada a API `hosting_deploy` para o site, com Git branch `deploy-hostinger`, tipo static; resposta: `status: deployed`, `autoDeploy: true`, `message: Request accepted`.
4. Hostinger File API confirmou o `api.php` em produção com **490 linhas / 22.592 bytes**, inclusive `require_once __DIR__ . '/lib_exercicios.php'`, permissão e consumer map de `historico_rateios`, reconstrução para `listar` e `obter` através de `ler_registro_exercicio`.
5. O `curl https://.../api.php` responde HTTP 401 JSON (77 bytes) por falta de sessão. Isso é resposta normal do endpoint PHP e **não fornece o código-fonte**. Hash anterior calculado sobre essa resposta foi uma comparação inválida; não repetir essa hipótese.
6. Asset público em produção `assets/previstoRealizado-Be_lc5sN.js` importa `historicoRateio-OAL-FSDw.js`; leitura do JS minificado mostrou `aplicarVariacaoDoHistorico` buscando linha do ano anterior e aplicando fallback. Esse asset é servido; o nome/tamanho coincidem com arquivo local (4.419 bytes). O index público retorna 302, logo não foi possível verificar qual arquivo de entrada/link está servido por aquela URL via curl sem cookies.
7. `npm test -- --run`: **42 test files, 351 tests passed**.
8. Git: `main` HEAD `6cf625303d6cb1b285301dd6a7d79987334815b3`; `deploy-hostinger` e `origin/deploy-hostinger` HEAD `57aeda4928ef7477f1aeecb5a93f4fa8072a3353`. Há grande divergência estrutural entre main e deploy-hostinger (`git diff deploy-hostinger..main --stat`: 660 files changed), que parece intencional porque deploy-hostinger é árvore empacotada. Não fazer merge/rebase entre essas branches sem entender fluxo.
9. Status local no início e agora tem arquivos não rastreados: `.playwright-mcp/` e `domain/historicoRateio.tela.test.ts`. Não remover nem incluir/commitar sem verificar proprietário/conteúdo.
10. Tentou-se usar Playwright MCP; o contexto é separado do Chrome do usuário e não compartilha cookies. Não afirmar que inspecionou sessão logada do usuário.

## Código/funções relevantes

- `frontend/src/routes/_authenticated.previsao-orcamentaria.tsx:201-216`: `demonstrativoBasePrevisao`, `aplicarRateioBase`, `aplicarVariacaoDoHistorico`, `calcularPrevisao` para tela do print.
- `frontend/src/routes/_authenticated.previsao-orcamentaria.tsx:399-...`: a tabela de relatório multiplica realizado por `fator = 1 + resultado.variacaoPct / 100`; cabeçalho em linha 542 também exibe esse percentual. A captura mostra resultado variacaoPct 0,00%, e realizado=previsto, sugerindo fator 1.
- `frontend/src/routes/_authenticated.previsto-realizado.tsx:100-113`: comparativo usa `compararPrevistoRealizado`, `demonstrativoBasePrevisao(exercicio, exercicioAnterior)` e histórico.
- `domain/previstoRealizado.ts:163-188`: aplica histórico ao exercício e chama `calcularPrevisao` para previsão anual. Linhas 243+ somam realizado por mensais separadamente.
- `domain/previsao.ts:106-123`: `resolverVariacao`: método `valor` usa `variacaoParam` como R$, método `percentual` usa `variacaoParam ?? variacao` como percentual.
- `domain/previsao.ts:141-145`: `demonstrativoBasePrevisao` atualmente retorna `exercicio.demonstrativo` próprio.
- `domain/historicoRateio.ts:128-167`: `aplicarVariacaoDoHistorico` não injeta se `variacao` ou `variacaoParam` não-zero; busca `variacao` do histórico ano anterior; fallback calcula rateio atual/aprovado.
- `domain/historicoRateio.tela.test.ts` contém teste contraditório/ilustrativo: histórico 2025 rateioAtual=321, aprovado=370 produz 15,26%, mas outro cenário é apenas mock. Os testes existentes exercitam helper, não o fluxo real da tela com payload real do banco.

## Hipótese técnica prioritária (não é conclusão)

A captura mostra “Realizado aplicado pelo reajuste de 0,00%”, e a tabela em que ambos os números são iguais totalizando R$ 982.212,87. O sistema provavelmente tem o `demonstrativo` correto de 2025/26 como base ~851.955 e total sem variação ~982.212. O índice está sendo descartado porque os dados reais do exercício chegam com um dos campos `variacao`, `variacaoParam` diferente de zero (inclusive possivelmente zero como override semântico), ou porque `variacaoMetodo` é `valor`/`manual` e a função helper injeta percent só em caso específico. Mas não supor: obter os payloads reais de `exercicios` e `historico_rateios` do Lago Negro e seguir toda a rota de cálculo.

A tela do screenshot não é `previsto-realizado`; é `previsao-orcamentaria?modo=relatorios`. Priorizar essa tabela e distinguir sua semântica da tela comparativa. A descrição da tabela é exatamente “Realizado aplicado pelo reajuste de X%”; o component aparentemente multiplica total realizado por fator, em vez de apresentar base/previsto conforme a regra citada. Ler a função do componente inteira (`_authenticated.previsao-orcamentaria.tsx` perto das linhas 399–625), confirmar origem de `resultado.variacaoPct`, data source e estado salvo.

## Próximas ações recomendadas para IA sucessora

1. **Não publicar de novo antes de reproduzir e validar causa.** Não dizer que ficou resolvido: a captura do usuário é evidência de que a operação anterior não corrigiu o sintoma.
2. Inspecionar dados reais de produção, autorizadamente, pela sessão autenticada do navegador que o usuário já abriu ou por consulta da API/logada. Usar a própria aba do usuário somente se houver uma ferramenta com acesso real à sessão; o navegador Playwright MCP daqui é separado. Não imprimir credenciais/tokens.
3. Obter os registros do exercício do Lago Negro 2025 e 2026 (campos `id`, `ano`, `condoId`, `demonstrativo.periodo`, total e grupos de despesas, `variacao`, `variacaoMetodo`, `variacaoParam`, `rateioAtual`, `rateioAprovado`, `prev`, `fechado`, `fechamento`) e registros de `historico_rateios` 2025/2026. Determinar qual exercício é usado pelo seletor da tela e qual demonstrativo realmente contém 851.955,11. Buscar a prestação mensal importada 2026 separadamente.
4. Fazer teste de regressão de integração da função/componente com os **dados reais anonimizados/fixtures completos**, afirmando base, índice aplicado, total esperado, realizado bruto e variação. O teste atual que só passa 15,26% pelo helper não cobre os dados reais nem o componente. Evitar criar testes que apenas reafirmam hipótese.
5. Ajustar a fonte/método dos parâmetros na tela sem alterar regra do realizado mensal. Conferir `valor` vs `percentual`: o usuário aponta valor aprovado/digitado, portanto R$ 30.000 pode ser acréscimo fixo, não 15,26%; conferir registro e regra de conversão, não inventar conversão baseada no rateio unitário.
6. Executar os testes da tela/domain e suíte completa; build de frontend. Reproduzir cálculo exato em teste e só então atualizar changelog/docs/versão se estrutural.
7. Publicar a branch/pacote correto pelo fluxo estabelecido e validar em produção de forma observável (assets carregados, dados e resultado após refresh). hPanel screenshot já tem deployments concluídos, mas não prova que conteúdo resolva esse valor. Registrar SHA.

## Correção do relatório/explicação anterior

A resposta anterior foi excessivamente assertiva: “backend e frontend estão publicados” e “Ctrl+F5 resolve/cache” não eram prova de que o valor/percentual estava corrigido. O deploy realmente foi aceito e o código no servidor verificado, mas a lógica publicada continuou exibindo 0,00%, como mostra a captura do usuário. Reconhecer isso no próximo contato e não pedir para o usuário validar manualmente algo sem evidência local de que corrigiu.
