# Modelos de Ata — Condomínio Lago Negro

> **Nota (11/11/2026):** este documento fica como histórico do primeiro conjunto. A origem única dos
> oito modelos — inclusive os dois do Lago Negro, que passaram a sair **sem logo do escritório e com
> borda de página** — é [`MODELOS-ATA-POR-CIDADE.md`](MODELOS-ATA-POR-CIDADE.md). Editar o texto de um
> modelo exige editar lá e em `domain/modelosAtaSeed.ts`.

Modelos escritos a partir das atas reais do Lago Negro (Rancho Queimado/SC). O cartório de Rancho
Queimado aceita layout visual, com títulos e listas, além do texto corrido — por isso os modelos
abaixo usam cabeçalhos e blocos.

**Estes dois modelos já vêm cadastrados** (versão 1.09): na instalação nova pelo `schema.sql` e,
nas existentes, pela migration `migrations/20261110_modelos_ata_lago_negro.sql`. A fonte única em
código é `domain/modelosAtaSeed.ts`; este documento é a referência de texto que o teste
`domain/modelosAtaSeed.test.ts` compara. Cadastrar à mão de novo não é necessário — e editar o
texto aqui sem editar a semente (ou vice-versa) quebra esse teste.

A escolha automática usa a **cidade extraída do endereço do condomínio** (não a cidade de
assinatura do escritório) e o **tipo** da assembleia, por isso os dois modelos coexistem em Rancho
Queimado.

## Como o texto do modelo é montado

Cada linha em branco separa parágrafos. Três marcações são reconhecidas:

| Marcação | Vira |
|---|---|
| `# Texto` | Título nível 1 (centralizado) |
| `## Texto` | Título nível 2 |
| `### Texto` | Título nível 3 |
| `- Texto` ou `• Texto` | Item de lista (marcadores) |
| Linha em branco | Quebra de parágrafo |

## Variáveis disponíveis

Só existem as variáveis abaixo. Qualquer outra é substituída por vazio, sem erro.

**Ata**

| Variável | Conteúdo |
|---|---|
| `{{ata.tipo}}` | `Ordinária` ou `Extraordinária` |
| `{{ata.data}}` | Data em `dd/mm/aaaa` |
| `{{ata.dataExtenso}}` | Data por extenso, ex.: `16 de dezembro de 2023` |
| `{{ata.hora}}` | Horário informado |
| `{{ata.local}}` | Local da reunião |
| `{{ata.modalidade}}` | `Presencial`, `On-line` ou `Híbrida` |
| `{{ata.mesa.presidente}}` | Nome do presidente da mesa |
| `{{ata.mesa.secretario}}` | Nome do secretário(a) |
| `{{ata.quorum.unidadesPresentes}}` | Unidades presentes (número) |
| `{{ata.quorum.totalUnidades}}` | Total de unidades do condomínio (número) |
| `{{ata.quorumTexto}}` | Frase pronta do quórum, ex.: `24 unidades presentes de 120 unidades (20,00%)` |
| `{{ata.percentualQuorum}}` | Só o percentual, ex.: `20,00` |
| `{{ata.unidades}}` | Unidades presentes separadas por vírgula |
| `{{ata.itens}}` | Títulos dos itens da pauta separados por vírgula |
| `{{ata.itensTexto}}` | Itens numerados, com discussão e deliberação, um parágrafo cada |
| `{{ata.encerramento}}` | Texto de encerramento da ata |
| `{{ata.observacoes}}` | Observações |

**Condomínio**

`{{condominio.nome}}`, `{{condominio.nomeRelatorio}}`, `{{condominio.cnpj}}`,
`{{condominio.enderecoEdital}}`, `{{condominio.unidades}}`

**Escritório e cidade**

`{{escritorio.nome}}`, `{{escritorio.cidade}}`, `{{escritorio.rodape}}`, `{{escritorio.assinatura}}`,
`{{cidade}}`

Não use `{{ata.quorum}}`, `{{ata.mesa}}` ou `{{condominio}}` sozinhos: são objetos e saem como
`[object Object]`. Use sempre o caminho completo até um texto ou número.

## Limitações a considerar

- O texto do modelo gera apenas parágrafos, títulos e listas. As **linhas de assinatura** saem como
  texto com sublinhado; não são o bloco de assinatura nativo usado no modelo padrão do sistema.
- `{{ata.itensTexto}}` traz discussão e deliberação de cada item. Sem esses campos preenchidos na
  ata, sai somente o título numerado.
- O modelo escolhido na ata define logo e borda: com **Incluir logo do escritório** desmarcado, o
  documento sai sem timbre; **Borda de página** desenha a moldura no PDF e no Word.

---

## Modelo 1 — Ata de Assembleia Geral Ordinária (Lago Negro)

Nome: `Lago Negro — Ordinária (Rancho Queimado)`
Cidade: `Rancho Queimado` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Ordinária` · Logo do escritório: marcado · Borda de página: desmarcado

```
# ATA DA ASSEMBLEIA GERAL ORDINÁRIA

## {{condominio.nomeRelatorio}}

Aos {{ata.dataExtenso}}, às {{ata.hora}}, no {{ata.local}}, na modalidade {{ata.modalidade}}, reuniram-se os senhores condôminos do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ {{condominio.cnpj}}, para a realização de Assembleia Geral Ordinária.

A reunião atendeu ao edital de convocação regularmente expedido a todos os condôminos por meio eletrônico. Feita a abertura dos trabalhos, os senhores condôminos indicaram para a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, e para o cargo de secretário(a) o Sr(a). {{ata.mesa.secretario}}, o que foi aprovado por unanimidade.

## Unidades presentes

{{ata.unidades}}

Quórum: {{ata.quorumTexto}}.

## Nos termos da Lei Geral de Proteção de Dados (LGPD)

Todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento. Ficou consignado que todo condômino que queira ver sua sugestão, reclamação ou informação registrada em ata deve solicitá-lo, sob pena de o assunto ser considerado conversa paralela.

## Ordem do dia

{{ata.itensTexto}}

## Encerramento

{{ata.encerramento}}

Nada mais havendo para ser tratado, o presidente da mesa solicitou ao secretário a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, dando-se por encerrada a assembleia. Os condôminos presentes outorgam poderes ao secretário para redigir, assinar, transcrever e registrar em livro próprio a presente ata, devendo cópia ser remetida a todos por meio eletrônico.

## Observações

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.


_______________________________________________
{{ata.mesa.presidente}}
Presidente da mesa


_______________________________________________
{{ata.mesa.secretario}}
Secretário(a)
```

---

## Modelo 2 — Ata de Assembleia Geral Extraordinária (Lago Negro)

Nome: `Lago Negro — Extraordinária (Rancho Queimado)`
Cidade: `Rancho Queimado` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Extraordinária` · Logo do escritório: marcado · Borda de página: desmarcado

```
# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA

## {{condominio.nomeRelatorio}}

Aos {{ata.dataExtenso}}, às {{ata.hora}}, no {{ata.local}}, na modalidade {{ata.modalidade}}, reuniram-se os senhores condôminos do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ {{condominio.cnpj}}, para a realização de Assembleia Geral Extraordinária, convocada por edital regularmente expedido a todos os condôminos por meio eletrônico.

Feita a abertura dos trabalhos, os senhores condôminos indicaram para a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, e para o cargo de secretário(a) o Sr(a). {{ata.mesa.secretario}}, o que foi aprovado por unanimidade. Empossados, o secretário fez a leitura do edital de convocação.

## Unidades presentes

{{ata.unidades}}

Quórum: {{ata.quorumTexto}}.

## Nos termos da Lei Geral de Proteção de Dados (LGPD)

Todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.

## Ordem do dia

{{ata.itensTexto}}

## Encerramento

{{ata.encerramento}}

Nada mais havendo para ser tratado, o presidente da mesa solicitou ao secretário a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, dando-se por encerrada a assembleia. Os condôminos presentes outorgam poderes ao secretário para redigir, assinar, transcrever e registrar em livro próprio a presente ata, devendo cópia ser remetida a todos por meio eletrônico.

## Observações

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.


_______________________________________________
{{ata.mesa.presidente}}
Presidente da mesa


_______________________________________________
{{ata.mesa.secretario}}
Secretário(a)
```

---

## Origem do texto

Estrutura extraída das atas reais do Condomínio Rural Lago Negro em Rancho Queimado/SC:

- AGO de 16/12/2023
- AGE de 08/03/2024
- AGE de 27/06/2024
- AGE de 07/12/2024
- AGO de 13/12/2025 (edital)

Os PDFs são digitalizados (imagem, sem camada de texto), por isso a leitura foi feita por OCR. Nomes,
valores e trechos específicos de cada assembleia não entraram no modelo: eles vêm da ata cadastrada
no sistema, pelas variáveis.
