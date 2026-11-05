# Correções de acessibilidade e recuperação — 05/11/2026

Issue: [#228](https://github.com/felicioe/Krieger/issues/228).

## Contratos corrigidos

- A pesquisa de condomínio oferece um combobox focado com relação explícita à lista e à opção ativa. Setas movem a indicação; Enter confirma e Escape volta à origem. Opções não criam paradas adicionais no Tab. Pesquisa, opções e limpeza respeitam o alvo de 44 px abaixo de `md` e em ponteiro de toque.
- Consulta Inteligente e Drive reutilizam `Selecao`, que encaminha o rótulo, a dica e os estados do `Field` ao gatilho. Pergunta, cidade e data de emissão têm nomes individuais.
- Links de previsão separam o caminho de `search.modo`. A atividade automática do roteador e o destaque visual distinguem orçamento/rateio de relatórios, inclusive com um exercício selecionado.
- `DialogContent` guarda a origem antes do foco automático e restaura ao fechar. Se a origem foi removida, usa o conteúdo principal; callbacks de tela com `preventDefault()` continuam prioritários. Isso abrange os diálogos controlados de prestação, usuários, backup, Drive e frações sem duplicar a lógica em cada tela.
- Aplicar apólice ou frações tem trava imediata de repetição, estado de envio, botão/seleção bloqueados e mensagem recuperável. Falha mantém a prévia e o condomínio selecionado. Frações invalidam o cache após sucesso, preservando a navegação e o foco em vez de recarregar a página.

## Preservação de comportamento

Nenhuma regra de cálculo, estrutura de dados armazenada ou configuração de produção foi alterada. O indicador visual existente do menu foi preservado. As gravações de cadastro continuam pelos mesmos métodos da API.

## Validação

Os testes de regressão exercitam anúncio da opção ativa e confirmação por teclado, estado sem resultados, retorno de foco por Escape e após remoção da origem, callback explícito de foco, atividade das duas previsões e falha/repetição/retentativa das duas aplicações de dados importados.

Validações executadas com Node 22.23.4: instalação por `npm ci` na raiz e no frontend; 240 testes de domínio em 29 arquivos; 214 testes de frontend em 31 arquivos (dois trabalhadores); typecheck da raiz e do frontend; `docs:check`; build de produção. Todas passaram. Os testes de frontend incluem 11 novas regressões para a issue.

O teste de unidade usa PDFs fictícios e API simulada, sem dados ou gravações de produção. A revisão visual e a verificação final publicada são registradas na etapa de integração/publicação do pacote da `main`; não são substituídas pelo build ou pelos testes unitários.
