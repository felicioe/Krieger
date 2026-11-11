# Modelos de Ata por Cidade

Modelos escritos a partir das **atas reais do escritório**, separados pela cidade do condomínio.
São oito modelos: dois de Rancho Queimado (Condomínio Rural Lago Negro) e um par
ordinária/extraordinária para cada um dos três municípios com mais atas no acervo —
**Balneário Camboriú** (512 atas), **Camboriú** (116) e **Itajaí** (50).

Os dois modelos do Lago Negro vieram antes (issue #256, versão 1.09) e vivem também em
[`MODELOS-ATA-LAGO-NEGRO.md`](MODELOS-ATA-LAGO-NEGRO.md), que fica como histórico do primeiro
conjunto. **A partir de agora este documento é a origem única dos oito modelos**: ele e
`domain/modelosAtaSeed.ts` precisam ser editados juntos, porque o teste
`domain/modelosAtaSeed.test.ts` compara os dois byte a byte.

## Regras de origem

- **Texto tirado da prática do município.** Rancho Queimado usa layout com títulos e listas, porque o
  cartório local aceita esse formato. Balneário Camboriú, Camboriú e Itajaí usam **prosa corrida**,
  sem cabeçalhos intermediários — é o que as atas reais dessas cidades fazem.
- **Ata não leva logotipo nem rodapé do escritório, e leva borda de página.** Decisão do escritório
  de 11/11/2026, aplicada a todos os oito modelos: `logoEscritorio: false` e `bordaPagina: true`.
- **Sem dados de pessoas.** O modelo não traz nome, CPF, RG ou endereço de ninguém: o representante
  do escritório aparece como `{{escritorio.nome}}`, e quem presidiu e secretariou a mesa vem da ata
  cadastrada, por `{{ata.mesa.presidente}}` e `{{ata.mesa.secretario}}`.
- **Formatação dominante nas atas**: justificado, Arial, corpo 12 pt. Todo parágrafo do modelo sai
  justificado.
- **Cidade de Joinville não entra.** Ela aparece nas atas apenas como endereço de condômino, nunca
  como cidade do condomínio, então não tem modelo.

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

Só existem as variáveis abaixo. Qualquer outra é substituída por vazio, sem erro. A lista completa,
com o conteúdo de cada uma, está em [`MODELOS-ATA-LAGO-NEGRO.md`](MODELOS-ATA-LAGO-NEGRO.md#variáveis-disponíveis).

## A escolha automática

A escolha usa a **cidade extraída do endereço do condomínio** (não a cidade de assinatura do
escritório) e o **tipo** da assembleia. Como os modelos têm `cartorio` em branco, qualquer cartório
da cidade serve.

---

## Modelo 1 — Lago Negro — Ordinária (Rancho Queimado)

Nome: `Lago Negro — Ordinária (Rancho Queimado)`
Cidade: `Rancho Queimado` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Ordinária` · Logo do escritório: desmarcado · Borda de página: marcado

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

## Modelo 2 — Lago Negro — Extraordinária (Rancho Queimado)

Nome: `Lago Negro — Extraordinária (Rancho Queimado)`
Cidade: `Rancho Queimado` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Extraordinária` · Logo do escritório: desmarcado · Borda de página: marcado

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

## Modelo 3 — Balneário Camboriú — Ordinária

Nome: `Balneário Camboriú — Ordinária`
Cidade: `Balneário Camboriú` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Ordinária` · Logo do escritório: desmarcado · Borda de página: marcado

```
# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO

## {{condominio.nomeRelatorio}}

Realizada aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, na modalidade {{ata.modalidade}}, nas dependências do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ sob número {{condominio.cnpj}}, realizou-se a Assembleia Geral Ordinária, estando presentes neste evento os condôminos proprietários ou representantes legais das unidades autônomas denominadas: {{ata.unidades}}. Presente também o(a) representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.

A reunião atendeu ao edital de convocação regularmente expedido a todos os condôminos através de carta registrada enviada pelo correio para os não residentes e carta protocolada para os residentes. Feita a abertura dos trabalhos, foi indicado através dos presentes para assumir a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade. Empossados, e a pedido, o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:

{{ata.itensTexto}}

Nos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento. Ficou consignado que todo condômino que queira ver sua sugestão, reclamação ou informação registrada em ata deve solicitá-lo, sob pena de o assunto ser considerado conversa paralela.

{{ata.encerramento}}

Nada mais havendo para ser tratado, o(a) presidente da mesa Sr(a). {{ata.mesa.presidente}} solicitou ao(à) secretário(a) a leitura para os presentes do resumo dos itens tratados nesta reunião, sendo aprovados, dando assim encerramento à presente assembleia. Os condôminos presentes nesta assembleia também autorizam o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos por meio eletrônico.

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

## Modelo 4 — Balneário Camboriú — Extraordinária

Nome: `Balneário Camboriú — Extraordinária`
Cidade: `Balneário Camboriú` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Extraordinária` · Logo do escritório: desmarcado · Borda de página: marcado

```
# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO

## {{condominio.nomeRelatorio}}

Aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, na modalidade {{ata.modalidade}}, com transmissão ao vivo para todos os moradores por meio de link encaminhado, reuniram-se para realização da Assembleia Geral Extraordinária do {{condominio.nomeRelatorio}}, situado em {{condominio.enderecoEdital}}, inscrito no CNPJ sob número {{condominio.cnpj}}. Participaram da assembleia os condôminos proprietários e/ou representantes legais das unidades autônomas denominadas: {{ata.unidades}}. Presente também o(a) representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.

A Assembleia atendeu ao edital de convocação regularmente expedido a todos os condôminos, sendo enviado pelo correio através de carta registrada para os não residentes e carta protocolada para os residentes. Feita a abertura dos trabalhos, foi indicada para presidir os trabalhos o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade. Empossados, o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:

{{ata.itensTexto}}

Nos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.

{{ata.encerramento}}

Nada mais havendo para ser tratado, o(a) presidente da mesa solicitou ao(à) secretário(a) a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, dando-se por encerrada a assembleia. Os condôminos presentes autorizam, após o(a) presidente da mesa aprovar o texto, o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos através de meio eletrônico.

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.

_______________________________________________
{{ata.mesa.presidente}}
Presidente da mesa

_______________________________________________
{{ata.mesa.secretario}}
Secretária
```

---

## Modelo 5 — Camboriú — Ordinária

Nome: `Camboriú — Ordinária`
Cidade: `Camboriú` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Ordinária` · Logo do escritório: desmarcado · Borda de página: marcado

```
# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO

## {{condominio.nomeRelatorio}}

A Assembleia Geral Ordinária do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, inscrito no CNPJ nº {{condominio.cnpj}}, foi aberta aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, na modalidade {{ata.modalidade}}, para explanação e debate dos itens da pauta. Participaram da assembleia os condôminos proprietários ou representantes legais das unidades condominiais: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.

Foi indicado para presidir a mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade dos presentes. Empossados, o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:

{{ata.itensTexto}}

Nos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.

{{ata.encerramento}}

Nada mais havendo para ser tratado, o(a) presidente da mesa solicitou ao(à) secretário(a) a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, encerrando-se a assembleia. Os condôminos presentes autorizam o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos por meio eletrônico.

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.

_______________________________________________
{{ata.mesa.secretario}}
(Secretário)

_______________________________________________
{{ata.mesa.presidente}}
(Presidente)
```

---

## Modelo 6 — Camboriú — Extraordinária

Nome: `Camboriú — Extraordinária`
Cidade: `Camboriú` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Extraordinária` · Logo do escritório: desmarcado · Borda de página: marcado

```
# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO

## {{condominio.nomeRelatorio}}

Aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação, nas dependências do condomínio, reuniram-se para realização da Assembleia Geral Extraordinária do {{condominio.nomeRelatorio}}, inscrito no CNPJ sob nº {{condominio.cnpj}}, localizado em {{condominio.enderecoEdital}}. Presentes os condôminos e/ou seus representantes legais, proprietários das unidades autônomas número: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.

A reunião atendeu ao edital de convocação regularmente expedido a todos os condôminos através de carta registrada enviada pelo correio para os não residentes e carta protocolada para os residentes. Foi indicado através dos presentes para assumir a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade. Empossados, e a pedido, em nome do síndico o(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:

{{ata.itensTexto}}

Nos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.

{{ata.encerramento}}

Nada mais havendo para ser tratado, o(a) presidente da mesa solicitou ao(à) secretário(a) a leitura do resumo dos itens tratados nesta reunião, o que foi aprovado, encerrando-se a assembleia. Os condôminos presentes autorizam o(a) secretário(a) a redigir, assinar, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos por meio eletrônico.

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.

_______________________________________________
{{ata.mesa.secretario}}
Secretário(a)

_______________________________________________
{{ata.mesa.presidente}}
Síndico/presidente
```

---

## Modelo 7 — Itajaí — Ordinária

Nome: `Itajaí — Ordinária`
Cidade: `Itajaí` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Ordinária` · Logo do escritório: desmarcado · Borda de página: marcado

```
# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO

## {{condominio.nomeRelatorio}}

Aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação com qualquer número de presentes, na modalidade {{ata.modalidade}}, realizou-se a Assembleia Geral Ordinária do {{condominio.nomeRelatorio}}, situado em {{condominio.enderecoEdital}}, inscrito no CNPJ nº {{condominio.cnpj}}, estando presentes neste evento os condôminos proprietários ou representantes legais das unidades autônomas: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.

A assembleia atendeu ao edital de convocação regularmente expedido a todos os condôminos, por meio de carta protocolada para os residentes e carta registrada enviada pelo correio para os não residentes. Feita a abertura dos trabalhos, foi indicado para presidir a mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade dos presentes, sendo devidamente empossados. O(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:

{{ata.itensTexto}}

Nos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.

{{ata.encerramento}}

Nada mais havendo para ser tratado, o(a) presidente da mesa encerrou os trabalhos. Os condôminos presentes nesta assembleia também autorizam o(a) secretário(a) a redigir, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos através de meio eletrônico.

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.

_______________________________________________
{{ata.mesa.secretario}}
Secretária

_______________________________________________
{{ata.mesa.presidente}}
Síndico/Presidente
```

---

## Modelo 8 — Itajaí — Extraordinária

Nome: `Itajaí — Extraordinária`
Cidade: `Itajaí` · Cartório: em branco (vale para qualquer cartório da cidade)
Tipo: `Extraordinária` · Logo do escritório: desmarcado · Borda de página: marcado

```
# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO

## {{condominio.nomeRelatorio}}

Aberto os trabalhos, realizou-se a Assembleia Geral Extraordinária do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, na modalidade {{ata.modalidade}}, inscrito no CNPJ sob nº {{condominio.cnpj}}, realizada aos {{ata.dataExtenso}}, às {{ata.hora}}, em segunda convocação. Presentes os condôminos e/ou seus procuradores, proprietários das unidades condominiais número: {{ata.unidades}}. Presente também o representante do escritório {{escritorio.nome}}, que prestou assessoria aos trabalhos.

Sua realização ocorreu em virtude do Edital de Convocação regularmente expedido a todos os condôminos, através de carta com protocolo simples e direto aos condôminos residentes e carta registrada para os condôminos não residentes no condomínio. Em sequência foi indicado para a presidência da mesa o Sr(a). {{ata.mesa.presidente}}, que convidou a mim, {{ata.mesa.secretario}}, para secretariá-lo(a), o que foi aprovado por unanimidade dos presentes, sendo devidamente empossados. O(a) secretário(a) fez a leitura do edital de convocação, cujos itens a serem apreciados registram-se a seguir:

{{ata.itensTexto}}

Nos termos da Lei Geral de Proteção de Dados (LGPD), todos os presentes autorizam livremente o condomínio e a contabilidade a providenciarem o registro de seus dados pessoais nesta ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.

{{ata.encerramento}}

Nada mais havendo para ser tratado, o(a) presidente da mesa encerrou os trabalhos. Os condôminos presentes nesta assembleia também autorizam o(a) secretário(a) a redigir, transcrever ou registrar em livro próprio a presente ata, devendo cópia desta ser remetida a todos através de meio eletrônico.

{{ata.observacoes}}

{{cidade}}, {{ata.data}}.

_______________________________________________
{{ata.mesa.secretario}}
Secretária

_______________________________________________
{{ata.mesa.presidente}}
Síndico/Presidente
```

---

## Origem do texto

- **Lago Negro (Rancho Queimado)** — AGO de 16/12/2023, AGE de 08/03/2024, AGE de 27/06/2024,
  AGE de 07/12/2024 e AGO de 13/12/2025 (edital). PDFs digitalizados, lidos por OCR.
- **Balneário Camboriú** — atas de condomínios do município no acervo do escritório, entre elas a
  AGO do Spazio Vitória Residence (24/02/2026) e a AGE do Residencial Praia do Leme (11/04/2026).
- **Camboriú** — AGO do Condomínio Caledônia (21/02/2026) e AGE do Residencial Eliete P. de Melo
  (11/03/2026).
- **Itajaí** — AGO do Residencial Albatroz I (21/04/2026) e AGE do Condomínio Urban Classic
  (24/05/2018).

Nomes, valores e trechos específicos de cada assembleia não entraram no modelo: eles vêm da ata
cadastrada no sistema, pelas variáveis.
