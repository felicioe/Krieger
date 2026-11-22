import type { ModeloAta } from "./types";

/**
 * Modelos de ata prontos, entregues com a instalação (issue #256; modelos por cidade em 11/11/2026).
 *
 * São oito modelos, em dois grupos de layout:
 *
 * - **Lago Negro (Rancho Queimado)** — layout com seções (`##`), porque o cartório local aceita
 *   títulos e listas. É o conjunto original, com o texto intacto desde a primeira versão.
 * - **Balneário Camboriú, Camboriú e Itajaí** — prosa corrida, sem cabeçalhos intermediários, que é
 *   a prática dos cartórios dessas três cidades nas atas reais do escritório.
 *
 * `texto` é cópia literal do documento de origem: os oito modelos estão em
 * `docs/MODELOS-ATA-POR-CIDADE.md` (o antigo `docs/MODELOS-ATA-LAGO-NEGRO.md` fica como histórico
 * do primeiro conjunto). A migration `migrations/20261110_modelos_ata_lago_negro.sql` e o bloco
 * espelhado em `schema.sql` carregam exatamente estes registros; o teste
 * `domain/modelosAtaSeed.test.ts` mantém os lados iguais.
 *
 * Ata não leva logotipo nem rodapé do escritório e leva borda de página — decisão do escritório de
 * 11/11/2026, aplicada a todos os modelos, inclusive aos dois do Lago Negro.
 *
 * `cidade` é comparada com a cidade extraída do endereço do condomínio cadastrado, não com a cidade
 * de assinatura do escritório. `tipo` vazio vale para ordinária e extraordinária.
 */
const AGORA = "2026-11-11T12:00:00.000Z";

export function modelosAtaSemente(): ModeloAta[] {
  return [
    {
      id: "mod-ata-lago-negro-ordinaria",
      nome: "Lago Negro — Ordinária (Rancho Queimado)",
      cidade: "Rancho Queimado",
      cartorio: "",
      tipo: "ordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL ORDINÁRIA

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
Secretário(a)`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-lago-negro-extraordinaria",
      nome: "Lago Negro — Extraordinária (Rancho Queimado)",
      cidade: "Rancho Queimado",
      cartorio: "",
      tipo: "extraordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA

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
Secretário(a)`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-balneario-camboriu-ordinaria",
      nome: "Balneário Camboriú — Ordinária",
      cidade: "Balneário Camboriú",
      cartorio: "",
      tipo: "ordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO

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
Secretário(a)`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-balneario-camboriu-extraordinaria",
      nome: "Balneário Camboriú — Extraordinária",
      cidade: "Balneário Camboriú",
      cartorio: "",
      tipo: "extraordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO

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
Secretária`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-camboriu-ordinaria",
      nome: "Camboriú — Ordinária",
      cidade: "Camboriú",
      cartorio: "",
      tipo: "ordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO

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
(Presidente)`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-camboriu-extraordinaria",
      nome: "Camboriú — Extraordinária",
      cidade: "Camboriú",
      cartorio: "",
      tipo: "extraordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO

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
Síndico/presidente`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-itajai-ordinaria",
      nome: "Itajaí — Ordinária",
      cidade: "Itajaí",
      cartorio: "",
      tipo: "ordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL ORDINÁRIA DO CONDOMÍNIO

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
Síndico/Presidente`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    {
      id: "mod-ata-itajai-extraordinaria",
      nome: "Itajaí — Extraordinária",
      cidade: "Itajaí",
      cartorio: "",
      tipo: "extraordinaria",
      texto: `# ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA DO CONDOMÍNIO

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
Síndico/Presidente`,
      logoEscritorio: false,
      bordaPagina: true,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  ];
}
