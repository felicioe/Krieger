# Inventário de entrada de dados

Levantamento de 22/11/2026, feito a partir do código em `main` (`b229ce4`).
Objetivo: identificar onde cada informação é digitada, onde é usada e o que
está duplicado, para simplificar a entrada de dados. Nenhuma tela foi alterada.

## 1. Resumo

| Situação | Quantidade | Efeito para o usuário |
|---|---|---|
| Dado digitado em mais de um lugar, com risco de divergência | 4 grupos | Retrabalho e informação diferente entre telas |
| Dado repetido em cada documento | 3 grupos | Atrito leve, baixo risco |
| Configuração técnica misturada ao cadastro | cerca de 15 campos | Cadastro longo e intimidador |
| Fluxos que já funcionam bem | 4 | Manter como padrão |

O ponto central é que **o cadastro do condomínio é copiado para a prestação de
contas no momento em que ela é criada**. A partir daí, as duas cópias seguem
separadas e podem ser editadas uma sem a outra.

## 2. Duplicações com risco de divergência (prioridade alta)

### 2.1 Considerações finais × cadastro do condomínio

- **Onde se digita:** no cadastro (seções Administração, Seguro, Manutenções e
  vistorias, Documentos obrigatórios, Índices e Regras do relatório) **e** na
  prestação de contas (Considerações finais).
- **Como funciona hoje:** ao criar a prestação, `considDoCondominio`
  (`domain/exercicio.ts`) copia do cadastro a administração e os mandatos, a
  seguradora, a vigência e as coberturas do seguro, os extintores, a
  dedetização, a limpeza das caixas, a vistoria técnica, as rubricas de água,
  energia e elevadores, os documentos obrigatórios e os índices.
- **Problema:** o que é corrigido na prestação **não volta** para o cadastro. O
  botão "Recarregar do cadastro" só vai em um sentido e substitui tudo de uma
  vez.
- **Risco concreto:** o Painel de vencimentos (`domain/painel.ts`) lê o
  **cadastro**. Se o usuário renovar o seguro só na prestação, o Painel continua
  alertando o vencimento antigo, e a prestação seguinte nasce com o dado velho.

### 2.2 Rateio atual (valor da cota)

Aparece em quatro pontos:

| Tela | Campo |
|---|---|
| Cadastro do condomínio | Rateio mensal atual |
| Prestação de contas | Rateio atual (por unidade) e Rateio aprovado |
| Histórico de rateios | Rateio atual e Rateio aprovado |
| Previsão orçamentária | Rateio atual / Rateio mensal atual |

O valor do cadastro é copiado para o exercício na criação
(`exercicioPadrao`). O caso do Urban Classic (rateio alterado gerando 12,42%)
mostra que esse dado em vários lugares já causa efeito no cálculo.

### 2.3 Histórico de rateios em duas telas

É editado no cadastro (`HistoricoRateiosCondominio`) e na Previsão
Orçamentária (`HistoricoRateiosPrevisao`). A fonte gravada é a mesma, mas o
usuário não sabe qual é o lugar "certo" de manter.

### 2.4 Índices de correção

Ficam no cadastro (Índices de correção aplicados), são copiados para a
prestação (`consid.indices`) e reaparecem na previsão (Índice de reajuste e
Índice sugerido). Há ainda a regra de inicialização a partir da importação
(`inicializarIndicesImportados`).

## 3. Dados repetidos por documento (prioridade média)

| Dado | Onde aparece | Origem do valor sugerido |
|---|---|---|
| Cidade e data de emissão | Edital, Prestação de contas e Relatório final | Cidade do Escritório e data de hoje |
| Quórum | Cadastro → Edital → Ata | Cadastro; na ata, "Unidades presentes" é digitado |
| Assinante e cargo | Edital e Escritório (assinatura) | Síndico do cadastro |

A Prestação de contas e o Relatório final editam o **mesmo** campo de cidade e
data, em duas telas. Na ata, as unidades presentes podem ser contadas pela
lista de presença, mas hoje dependem de um clique em "Usar contagem da lista".

## 4. Configuração técnica dentro do cadastro (prioridade média)

Campos que só o administrador entende e raramente muda, mas que ficam no
mesmo formulário dos dados gerais:

- palavras-chave de dedução, água, energia elétrica e elevadores;
- de-para de rótulos (De / Para) e expressões de busca;
- regras do relatório (Incluir no relatório, Nome no relatório);
- arredondamento do rateio, método e parâmetro da variação;
- modo da fração prevista.

Somadas às 12 seções, deixam o cadastro com cerca de 1.300 linhas e uma única
tela longa.

## 5. Fluxos que já funcionam bem (manter como padrão)

1. **Ata a partir do edital** (`novaAtaDeAssembleia`): herda data, horário,
   tipo, modalidade, local, pauta, total de unidades e presidente da mesa.
2. **Edital a partir do cadastro e do modelo**: quórum, local, assinante,
   cidade, data de emissão e linhas da lista de presença.
3. **Importadores de PDF**: relatório mensal, prestação de contas, apólice de
   seguro, listagem de condomínios e comparativo financeiro.
4. **Contas a receber** sugeridas a partir do último relatório mensal.

## 6. Proposta em etapas

### Etapa 1: organização das telas (sem mudança de regra nem de banco)

- Dividir o cadastro em abas: **Cadastro** (dados gerais, administração,
  unidades e frações, seguro, manutenções), **Ano a ano** (rateios e índices) e
  **Configuração** (palavras-chave, de-para, regras do relatório,
  arredondamento), esta visível só para quem tem permissão.
- Deixar um único lugar de edição do histórico de rateios. No outro, mostrar
  em leitura com o link "editar".
- Na ata, preencher automaticamente as unidades presentes pela lista, com a
  opção de corrigir à mão.
- Cidade e data de emissão do exercício: editar em uma só tela.

### Etapa 2: fonte única das considerações (muda a regra)

- Enquanto o exercício estiver **aberto**, as considerações leem o cadastro
  ao vivo, e o que for editado na prestação grava no cadastro.
- No **fechamento**, congela-se uma cópia, como já acontece com o previsto
  aprovado. Exercícios já fechados mantêm o que têm.
- Resolve o alerta errado do Painel e a herança de dado velho.
- Não exige migration (o dado é JSON), mas muda o comportamento e precisa de
  decisão registrada em `docs/DECISOES.md`.

### Etapa 3: rateio atual com fonte única

- O histórico de rateios passa a ser a fonte do rateio atual e aprovado. O
  cadastro e a prestação mostram o valor e apontam para o histórico.

### Etapa 4: fluxo guiado do exercício

- Passo a passo: importar o demonstrativo → conferir → previsão → edital →
  ata → fechar, mostrando o que falta em cada etapa.

## 7. Decisões do responsável

1. **Considerações finais:** adotar a fonte única no cadastro, com
   congelamento no fechamento do exercício (Etapa 2)?
2. **Histórico de rateios:** editar no cadastro ou na Previsão Orçamentária?
3. **Configuração técnica:** restringir a aba a administradores ou só separar
   visualmente?
4. **Ordem:** começar pela Etapa 1 (rápida e sem risco) ou pela Etapa 2 (maior
   ganho)?
