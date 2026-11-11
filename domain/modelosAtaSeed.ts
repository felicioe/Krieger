import type { ModeloAta } from "./types";

/**
 * Modelos de ata prontos, entregues com a instalação (issue #256, decisão de 10/11/2026).
 *
 * `texto` é cópia literal de docs/MODELOS-ATA-LAGO-NEGRO.md, a referência revisada das atas
 * reais do Condomínio Rural Lago Negro. A migration
 * migrations/20261110_modelos_ata_lago_negro.sql e o bloco espelhado em schema.sql carregam
 * exatamente estes registros; o teste domain/modelosAtaSeed.test.ts mantém os três lados iguais.
 *
 * `cidade` é comparada com a cidade extraída do endereço do condomínio cadastrado, não com a
 * cidade de assinatura do escritório. `tipo` vazio vale para ordinária e extraordinária.
 */
const AGORA = "2026-11-10T12:00:00.000Z";

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
      logoEscritorio: true,
      bordaPagina: false,
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
      logoEscritorio: true,
      bordaPagina: false,
      ativo: true,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  ];
}
