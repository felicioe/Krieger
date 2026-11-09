# Fração ideal × quantidade de unidades no rateio — avaliação (#132)

Documento de decisão. **Nada foi alterado no código** por esta avaliação: o
levantamento abaixo mostra onde a quantidade de unidades decide um valor e o que
muda se a fração ideal passar a ser a base. A implementação só começa depois da
aprovação do responsável.

## Escopo

- **Dentro:** todos os cálculos que hoje usam a contagem de unidades, inclusive
  os que apenas exibem essa contagem para o usuário conferir.
- **Fora, por decisão da issue:** quórum, contagem de unidades inadimplentes,
  lista de presença e relatórios existentes. Os quatro aparecem aqui só para
  deixar registrado o motivo de ficarem de fora.

## O que o cadastro guarda hoje

`Condominio.unidades` é um número simples, digitado ou vindo do Importador, e é
a **única** fonte usada nos cálculos. `Condominio.fracaoUnidades` guarda, por
unidade, `fracaoUnidade`, `fracaoBox`, `fracaoTotal` e `fracaoPrevista` (seis
casas decimais, lidas do relatório de fração do Systemar), mas **nenhum cálculo
do domínio lê esses campos**. Hoje eles só aparecem na tela de cadastro, na
importação e na soma exibida ao lado do total de unidades.

O Importador de fração (`ImportarFracao.tsx`) grava a relação e, junto,
`unidades = relação.length` — ou seja, a contagem passa a ser o número de linhas
importadas, o que assume uma linha por unidade e nenhuma linha de garagem ou
depósito separada.

## Onde a contagem de unidades decide um valor

| Arquivo | Cálculo | Efeito hoje |
| --- | --- | --- |
| `domain/previsao.ts` | cota por unidade = anual ajustado ÷ meses ÷ unidades | Decide o rateio sugerido de cada unidade. |
| `domain/previsao.ts` | reserva por unidade = cota por unidade × % do fundo | Propaga o mesmo divisor. |
| `domain/previsao.ts` | valor por unidade = cota + reserva, com arredondamento | Saída final ao condomínio. |
| `domain/previsao.ts` | índice = valor por unidade ÷ rateio atual − 1 | Comparação com o rateio vigente. |
| `domain/previsaoSugerida.ts` | quadro "por unidade" da previsão do Systemar | Só comparação; não entra no rateio. |
| `domain/relatorioFinal.ts` | previsão e previsão por unidade do relatório final | Herda o rateio calculado acima. |
| `frontend/.../PainelPrevisao.tsx` | linha "(÷) Unidades" e caixa "Unidades" | Exibição do divisor usado. |

## Onde a contagem de unidades aparece sem calcular dinheiro

| Arquivo | Uso | Situação |
| --- | --- | --- |
| `domain/edital.ts` | `linhasLista` recebe `condo.unidades` | Número de linhas do edital. Fora do escopo. |
| `domain/listaPresenca.ts` | linhas = `assembleia.linhasLista ?? condo.unidades` | Fora do escopo. |
| `domain/ata.ts` | `quorum.totalUnidades = condo.unidades`; percentual = presentes ÷ total | Fora do escopo. |
| `domain/relatorioFinal.ts` | inadimplência usa `Mensal.receber.unidades` | Significado diferente: unidades **inadimplentes**, não o total do condomínio. Não confundir nem reaproveitar. |

## O que muda com a fração ideal

A fração não é "um número por unidade": é um peso. Duas unidades com a mesma
metragem podem ter pesos diferentes por posição, box ou garagem. Por isso o
cálculo deixa de ser uma divisão e passa a ser uma **distribuição proporcional**:

```
peso(u)        = fração da unidade u (critério a decidir abaixo)
totalPesos     = Σ peso(u)
cota(u)        = anual ajustado ÷ meses × peso(u) ÷ totalPesos
```

Isso preserva o que existe hoje quando todas as frações são iguais: com pesos
idênticos, `peso ÷ totalPesos = 1 ÷ unidades` e o resultado é o mesmo da divisão
uniforme.

### Critério da fração: decisão pendente

O relatório do Systemar traz quatro colunas. Antes de codificar:

1. `fracaoPrevista` — a que o escritório usa para prever o rateio?
2. `fracaoTotal` — soma das demais?
3. `fracaoUnidade` e `fracaoBox` — parcelas separadas?

**Proposta:** usar `fracaoPrevista`, normalizada pela soma de todas as
`fracaoPrevista`, porque é o número que o relatório já apresenta como previsão
de rateio. Confirmar com uma folha real antes de implementar — se a soma não
fechar em 1 (ou em 100%), o erro de cadastro precisa aparecer na tela em vez de
distorcer o rateio.

### Ativação e fallback

- **Ativa** somente quando `fracaoUnidades` existe, tem ao menos uma unidade e a
  soma dos pesos é maior que zero e finita.
- **Inativa** (fallback para a contagem) quando não há frações, quando a soma é
  zero, NaN ou negativa, ou quando alguma fração é inválida.
- O fallback nunca é silencioso: a tela de previsão informa qual base foi usada
  ("por fração ideal" ou "por quantidade de unidades") e o relatório final
  registra a mesma informação no rodapé da seção.
- Nunca misturar as duas bases no mesmo cálculo.

### Arredondamento e diferença residual

A divisão por unidades já arredonda por unidade e pode deixar resíduo. Com
frações, o resíduo aparece mesmo sem arredondamento, porque `peso ÷ totalPesos`
raramente é exato em centavos.

**Regra proposta:**

1. Calcular cada cota com precisão total e arredondar só na exibição.
2. Para o valor efetivamente cobrado, aplicar o mesmo critério de
   `Arredondamento` já existente (`truncar`, `arredondar`, `centavos`).
3. Distribuir a diferença entre a soma das cotas arredondadas e o total a
   arredondar **da maior fração para a menor**, um centavo por unidade, até
   zerar. Empate: ordem estável pelo código da unidade.
4. Quando não houver como fechar (ex.: total menor que a quantidade de
   unidades), manter a diferença visível na tela em vez de esconder.

O critério 3 precisa de teste próprio: soma das cotas tem de ser exatamente
igual ao total arredondado, em qualquer combinação de arredondamento.

## Compatibilidade

- Nenhuma migração de banco: `fracaoUnidades` já está no JSON de `kr_condominios`.
- Nenhum condomínio muda de valor enquanto a fração não estiver preenchida e
  válida — o fallback reproduz o cálculo atual.
- A escolha da base fica em uma função única do domínio, para previsão,
  relatório final e previsão sugerida lerem a mesma regra.

## Critérios de aceite propostos para a implementação

1. Uma função do domínio devolve, para um condomínio, a base do rateio: pesos por
   unidade ou, no fallback, contagem.
2. Previsão, previsão sugerida e relatório final usam essa função; nenhuma
   divisão por `unidades` sobrevive fora dela.
3. Soma das cotas arredondadas = total arredondado, com teste em pelo menos três
   cenários de arredondamento.
4. Tela e documento informam a base usada.
5. Com frações iguais, o resultado é numericamente idêntico ao cálculo atual
   (teste de regressão).
6. Quórum, lista de presença, inadimplência e contagem de unidades não mudam.

## O que não foi feito

- Nenhuma alteração de código, de schema ou de dados.
- Nenhuma conclusão sobre qual coluna de fração é a correta: é a primeira
  pergunta a responder com uma folha real do Systemar.
