# Correções dos relatórios — auditoria Impeccable de 05/11/2026

Issue: [#229](https://github.com/felicioe/Krieger/issues/229).

## Comportamento resultante

- PDF e Imprimir da previsão para relatórios abrem uma janela própria. O acesso à janela de origem é removido antes de escrever o documento; nomes e textos são escapados. O usuário recebe orientação se o navegador bloquear a janela. Cabeçalho, período, linhas e total seguem a apresentação selecionada; não há menu na impressão.
- A biblioteca XLSX só é importada ao solicitar a planilha. A ação informa preparação, bloqueia repetição e permite tentar novamente após uma falha.
- Sem nenhum relatório mensal no período, a conferência mostra a falta de dados e o acesso ao Importador. Com carga parcial, meses ausentes aparecem como “Sem dados” e sem comparação percentual; o acumulado é identificado como parcial. Meses com relatório e despesa efetivamente zerada continuam exibindo variações reais de −100%.
- A área rolável do mensal usa o componente acessível compartilhado. A coluna de grupo deixa de ser fixa abaixo de `md` e sua largura mínima passa a 8rem, preservando espaço para os números. Os cabeçalhos identificam grupo, mês e tipo de valor.
- Percentuais e contagens seguem os auxiliares de apresentação em português. As opções de análise ganham explicação na própria conferência.
- O rodapé da tabela da previsão passa a se chamar “Total dos grupos”. O realizado soma a base; a média soma os valores previstos de cada grupo e divide pelos meses analisados. Ajustes avulsos e variação de despesas sugeridas continuam no Resumo da previsão, onde compõem o anual ajustado. Isso elimina a apresentação de duas bases diferentes sob o mesmo rótulo.
- A ajuda descreve os controles atuais e a separação entre previsão orçamentária e previsão para relatórios. A entrada do Comparativo Financeiro e sua prévia explicam que o PDF é anexado e os meses selecionados criam/atualizam relatórios mensais, preservando o demonstrativo da prestação escolhida.

## Limites da mudança

Os cálculos do domínio, dados persistidos e regras de rateio não foram modificados. A distinção entre ausência de dados e zero é de apresentação, usando a cobertura de relatórios já retornada pelo domínio. O parâmetro `modo=relatorios` permanece na mesma rota.

## Regressões verificadas

- Texto de cadastro contendo marcação permanece texto no HTML de impressão; período e totais estão presentes.
- Popup bloqueado é identificado; a janela permitida é isolada antes de receber o conteúdo e só imprime depois do carregamento.
- Zero relatórios não produz tabela ou variação artificial.
- Carga parcial distingue mês ausente de mês efetivamente zerado.
- Carga completa mantém −100% legítimo.
- Com dedução e ajuste avulso, o total da média dos grupos corresponde às linhas e não é rotulado como anual ajustado.

Os resultados dos comandos de validação e da revisão visual são registrados no PR correspondente; a publicação usa somente o pacote de um commit aprovado da `main`, conforme [PUBLICACAO.md](../PUBLICACAO.md).

Validação local desta branch em Node 22.23.4:

- `npm ci` na raiz e no frontend concluídos.
- `npm test` na raiz: 29 arquivos, 240 testes aprovados.
- `npm run typecheck` na raiz e `npx tsc --noEmit` no frontend aprovados.
- Testes frontend de impressão, cobertura mensal/reconciliação e importação do comparativo: 3 arquivos, 16 testes aprovados com `--maxWorkers=2`.
- A primeira execução desses testes teve um timeout na espera do carregamento de um teste existente do comparativo; a repetição com dois trabalhadores passou integralmente. O tempo padrão da asserção e a regra de importação foram preservados.
- `npm run docs:check`: 41 arquivos Markdown, links locais válidos; `git diff --check` aprovado.

O build e a suíte completa do frontend ficam para a validação integrada/CI antes do merge. A revisão visual e a verificação publicada são conduzidas pela integração desta correção com as demais issues da auditoria.
