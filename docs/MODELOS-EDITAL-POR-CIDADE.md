# Modelos de Edital por Cidade

Modelos escritos a partir dos **44 editais reais do escritório** (acervo em
`OneDrive/Desktop/Arquivos/krieger/editais`), separados pela cidade do condomínio —
o mesmo critério dos [modelos de ata](MODELOS-ATA-POR-CIDADE.md).

São **quatro modelos**, entregues com a instalação
(`domain/modelosEditalSeed.ts` → `schema.sql` e
`migrations/20261111_modelos_edital_por_cidade.sql`).

## Como a escolha funciona

No diálogo de novo edital, o sistema lê a **cidade do endereço do condomínio**
(`enderecoEdital`, nunca a cidade de assinatura do escritório), filtra os modelos do
condomínio e os gerais pelo **tipo de assembleia** e põe o modelo daquela cidade na
frente, já marcado. Trocar o condomínio ou o tipo troca a lista; a escolha atual só
permanece se continuar válida.

Os modelos cadastrados à mão continuam valendo: os da semente são só o ponto de
partida. `cidade` vazia serve a qualquer cidade e `tipo` vazio serve à ordinária e à
extraordinária.

## O que o acervo mostrou

| Cidade | Editais | Layout praticado |
| --- | --- | --- |
| Balneário Camboriú | 24 | Um só texto para os dois tipos |
| Camboriú | 13 | Ordinária e extraordinária com aberturas diferentes |
| Itajaí | 3 | Abertura própria, com bloco `NOTAS` e Zoom |
| Brusque | 2 | Mesma família de texto de Camboriú |

Duas coisas explicam por que Balneário Camboriú tem um modelo só e Camboriú tem dois:
em Balneário a abertura (`em dia com suas obrigações`, ordem do dia, `NOTAS` com LGPD,
procuração, cônjuge, ausência e Artigo 1.335) é idêntica nos dois tipos e só o título
muda; em Camboriú a ordinária remete ao Artigo 16 da convenção e traz as contas do
exercício, enquanto a extraordinária não.

## Os quatro modelos

| id | Nome | Cidade | Tipo |
| --- | --- | --- | --- |
| `mod-edital-balneario-camboriu` | Balneário Camboriú | Balneário Camboriú | ambos |
| `mod-edital-camboriu-ordinaria` | Camboriú — Ordinária | Camboriú | ordinária |
| `mod-edital-camboriu-extraordinaria` | Camboriú — Extraordinária | Camboriú | extraordinária |
| `mod-edital-itajai` | Itajaí | Itajaí | ambos |

### Balneário Camboriú (`mod-edital-balneario-camboriu`)

Base: 24 editais, entre eles o Gran Torino Residence (05/2024 e 24/10/2024) e o
Solar das Palmeiras. Títulos em caixa alta, uma abertura com a qualificação do
condomínio, convocação em primeira e segunda chamada, ordem do dia, e o bloco final
`NOTAS` com LGPD, procuração, cônjuge, ausência e o Artigo 1.335 do Código Civil.

### Camboriú — Ordinária (`mod-edital-camboriu-ordinaria`)

Base: Parque do Lago (`Edital Ordinária 2026`). Cabeçalho direto com assembleia,
data, condomínio e CNPJ; convocação com remissão ao **Artigo 16** da convenção; ordem
do dia com as contas do exercício, previsão orçamentária, eleição de síndico,
subsíndico e conselho fiscal; encerramento.

### Camboriú — Extraordinária (`mod-edital-camboriu-extraordinaria`)

Base: Parque do Lago (`Edital assembléia geral extraordinária 05/2026`). Mesma
abertura da ordinária, sem a remissão ao Artigo 16 e sem as contas do exercício;
traz o bloco `NOTAS` (LGPD, procuração, cônjuge, ausência, Artigo 1.335) como em
Balneário Camboriú. É o layout que o escritório usa para o tipo.

### Itajaí (`mod-edital-itajai`)

Base: três editais do Itajaí, sendo o do Solar das Palmeiras (2014) o representante.
Abertura com a qualificação do condomínio, convocação com 2/3 em primeira chamada,
ordem do dia e o bloco `NOTAS` com a indicação da plataforma Zoom.

## Variáveis

Todos os textos usam apenas variáveis que o edital já resolve
(`domain/modeloTexto.ts`): `{{condominio.nome}}`, `{{condominio.cnpj}}`,
`{{condominio.enderecoEdital}}`, `{{assembleia.*}}` (tipo, data, horas,
modalidade), `{{administracao.*}}` e a pauta do modelo (`pauta`).

O teste `domain/modelosEditalSeed.test.ts` renderiza os quatro com um condomínio de
exemplo e falha se sobrar `{{...}}` ou `undefined` no texto.
