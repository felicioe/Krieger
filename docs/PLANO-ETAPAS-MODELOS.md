# Plano de desenvolvimento por etapa e modelo

Decisão de 10/11/2026. Define quais etapas do trabalho têm modelo próprio e
qual modelo/esforço cabe em cada uma. Vale para o Claude; o Codex continua com
auditoria, revisão, CI e publicação conforme o `AGENTS.md`.

O objetivo não é usar um modelo diferente por gosto: é gastar caro só onde o
erro custa caro. Regra de negócio, contrato de dados e publicação definem o
sistema por anos. Renomear variável, atualizar documento e rodar a suíte não.

## Resumo operacional

| # | Etapa | Modelo | Esforço | Executa | Entrega |
|---|---|---|---|---|---|
| 1 | Triagem da issue e contexto | Haiku 5.5 | low | subagente `triagem-krieger` | problema, critérios, arquivos prováveis, riscos |
| 2 | Investigação do código | Haiku 5.5 | low | subagente `explorador-krieger` | arquivos, chamadas, testes e migrações afetados |
| 3 | Projeto técnico | Fable 5.1 | high | sessão principal | plano com contrato, ordem de arquivos e riscos |
| 4 | Regras de negócio (`domain/`) | Opus 5.5 | high | subagente `implementador-domain` | código puro + testes |
| 5 | Interface (`frontend/src`) | Sonnet 5.5 | high | subagente `implementador-frontend` | componentes acessíveis + testes |
| 6 | Backend PHP e banco | Opus 5.5 | high | subagente `implementador-php` | store, permissões, migration |
| 7 | Validação local | Sonnet 5.5 | medium | subagente `validador-krieger` | saída real dos comandos |
| 8 | Revisão adversarial | Opus 5.5 | xhigh | subagente `revisor-krieger` | achados com `arquivo:linha` |
| 9 | Documentação e changelog | Haiku 5.5 | low | subagente `documentador-krieger` | docs e versão atualizados |
| 10 | Integração e pacote | Sonnet 5.5 | medium | sessão principal + CI | PR, artefato, evidências |
| 11 | Publicação e pós-deploy | Opus 5.5 | high | sessão principal + responsável | SHA publicado e registro na issue |

## O que o Claude Code permite de fato

Cada agente em `.claude/agents/*.md` aceita no frontmatter:

- `model:` com `inherit`, `sonnet`, `opus` ou `haiku`. `inherit` usa o modelo
  da sessão, que é o padrão quando o campo é omitido.
- `effort:` com `low`, `medium`, `high`, `xhigh` ou `max`. Presente nos agentes
  oficiais distribuídos com o Claude Code; se uma versão ignorar o campo, o
  agente roda no esforço padrão do modelo, sem quebrar.
- `tools:` como lista, para deixar o agente somente leitura.

O esforço importa tanto quanto o modelo: `xhigh` no topo resolve melhor o
problema difícil, e `low` num modelo barato resolve o problema trivial. Em
modelos que aceitam esforço, o padrão costuma ser `medium` ou `high`; por isso
o plano escreve o nível em cada agente em vez de confiar no padrão.

Trocar o modelo da sessão principal no meio do trabalho (`/model`) funciona,
mas descarta o raciocínio já acumulado daquele turno. Para trabalho que exige
outro modelo, o caminho é delegar a um subagente: ele começa com contexto
próprio e devolve só o resultado.

## Contrato de passagem entre etapas

Cada etapa entrega ao seguinte, nesta ordem, e nada além disso:

1. **Triagem**: issue, critérios de aceite, o que está fora de escopo, arquivos
   candidatos, risco de mudança de banco.
2. **Investigação**: caminho real dos arquivos, quem chama quem, testes que já
   cobrem o trecho, migration existente mais recente.
3. **Projeto**: quais arquivos mudam, qual o contrato entre eles, qual a ordem,
   o que exige migration, o que não será tocado.
4. a 6. **Implementação**: diff, testes novos ou alterados, e o que ficou
   pendente por depender de outra etapa.
5. **Validação**: comandos executados e a saída, com falhas explícitas.
6. **Revisão**: achados classificados por severidade, cada um com arquivo e
   linha e um cenário concreto que o comprova.
7. **Documentação**: o que mudou em `docs/ESTADO-ATUAL.md`, `docs/DECISOES.md`
   e versão, quando a mudança for estrutural.

## Regras do projeto que nenhuma etapa pode furar

- **Mudança de banco** ganha item de ação próprio: tabela nova ou coluna
  alterada exige `schema.sql` e migration datada, e o pacote não leva schema.
- **Publicação** parte de um SHA de `main` com CI aprovado e backup feito; o
  pacote é o conteúdo de `dist/hostinger/`. Um merge não é deploy.
- **PR** registra problema, solução, testes executados e limitações, e só usa
  `Closes #N` quando todos os critérios forem atendidos.
- **Regra de negócio** fica em `domain/`, nunca duplicada dentro de componente.
- **Idioma** de código, comentário e documentação é português do Brasil.
- **Documentação** precisa passar em `npm run docs:check`; link local quebrado
  reprova o CI.

## Quando subir de modelo

O plano é ponto de partida, não camisa de força. Suba uma etapa de nível quando:

- a implementação em Sonnet devolver duas correções na revisão sobre o mesmo
  trecho, ou tocar cálculo financeiro, rateio, quórum ou permissão;
- a investigação em Haiku não achar o fluxo em duas tentativas, ou o problema
  envolver mais de um módulo;
- a revisão em Opus aprovar algo que depois falhou na validação.

Não desça de nível em etapa que já falhou uma vez. Repetir com o mesmo modelo
no mesmo nível tende a repetir o erro.

## Custo relativo

Preço de tabela por milhão de tokens, entrada e saída, para dimensionar a
escolha:

| Modelo | Entrada | Saída |
|---|---|---|
| Fable 5.1 | US$ 10 | US$ 50 |
| Opus 5.5 | US$ 4 | US$ 20 |
| Sonnet 5.5 | US$ 2 | US$ 10 |
| Haiku 5.5 | US$ 0,10 | US$ 0,50 |

A etapa 1 e a 2, que só leem, custam uma fração das demais. Por isso valem
modelo barato: o risco de erro ali é de cobertura, não de decisão.

## Como usar

O agente correspondente é acionado pelo nome, ou pela descrição quando a tarefa
se encaixa. Para a sessão principal mudar de modelo, use o seletor da interface
e não o meio de uma implementação em andamento.

O plano não cria agente para publicar. Deploy é irreversível e fica na sessão
principal, com o responsável presente e registro na issue.
