import type { Modelo } from "./types";

/**
 * Modelos de edital prontos por cidade, entregues com a instalação (11/11/2026).
 *
 * Saíram dos **44 editais reais** do acervo em `OneDrive/Arquivos/krieger/editais`, lidos e
 * agrupados por cidade e por layout. O que ficou aqui é o layout **predominante** de cada
 * município — não é texto inventado:
 *
 * - **Balneário Camboriú** (24 editais): uma única abertura serve à ordinária e à
 *   extraordinária — "em dia com suas obrigações", ordem do dia, bloco `NOTAS` com LGPD,
 *   procuração, cônjuge, ausência e Artigo 1.335. Só o título muda com o tipo, por isso um
 *   modelo só, com `tipo` vazio.
 * - **Camboriú** (13 editais): a prática é diferente por tipo, então são dois modelos —
 *   a ordinária segue o modelo do Parque do Lago com remissão ao Artigo 16 da convenção, e a
 *   extraordinária segue a mesma abertura com "em dia com suas obrigações" e o bloco `NOTAS`.
 * - **Itajaí** (3 editais): o acervo tem só extraordinária, com o mesmo corpo que serve à
 *   ordinária (o tipo sai no título e na pauta), por isso um modelo com `tipo` vazio.
 *
 * Cada modelo é editável no sistema. `cidade` casa com a cidade extraída do endereço do
 * condomínio (`enderecoEdital`), não com a cidade de assinatura do escritório.
 *
 * O mesmo conteúdo está em `docs/MODELOS-EDITAL-POR-CIDADE.md`, na migration
 * `migrations/20261111_modelos_edital_por_cidade.sql` e no bloco espelhado em `schema.sql`;
 * `domain/modelosEditalSeed.test.ts` mantém todos iguais.
 */
/** Ids estáveis: reeditar a semente atualiza o modelo em vez de duplicar. */
export const IDS_MODELOS_EDITAL = [
  "mod-edital-balneario-camboriu",
  "mod-edital-camboriu-ordinaria",
  "mod-edital-camboriu-extraordinaria",
  "mod-edital-itajai",
] as const;

/** Trecho comum a Balneário Camboriú e Itajaí: abertura com "em dia com suas obrigações". */
/**
 * A abertura é **um parágrafo só** no edital real — qualificação, dia, hora, modalidade e
 * convocação na mesma frase. Cada bloco `texto` vira um parágrafo no PDF
 * (`frontend/src/documentos/edital.ts`), então não dá para separar em três: a frase quebraria.
 * Por isso a modalidade entra por variante, e não como bloco condicional.
 *
 * O endereço do condomínio já vem na abertura; o bloco não repete `assembleia.local`, que no
 * presencial traria o imóvel de novo. Quando o síndico troca o salão, ele escreve isso no texto.
 */
const CONVOCACAO =
  "em primeira convocação com a presença de 2/3 (dois terços) de proprietários ou procuradores devidamente constituídos e, às {{assembleia.hora2}} em segunda convocação, com qualquer número presente, a fim de deliberar e aprovar a seguinte ordem do dia:";

const ABERTURA_PRESENCIAL =
  "Na qualidade de Síndico do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, convoco os Srs. Condôminos proprietários, em dia com suas obrigações, para participarem da Assembleia Geral {{assembleia.tipo}} a realizar-se no dia {{assembleia.data}}, às {{assembleia.hora1}}, de forma presencial, " +
  CONVOCACAO;

const ABERTURA_ONLINE =
  "Na qualidade de Síndico do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, convoco os Srs. Condôminos proprietários, em dia com suas obrigações, para participarem da Assembleia Geral {{assembleia.tipo}} a realizar-se no dia {{assembleia.data}}, às {{assembleia.hora1}}, de forma virtual pela plataforma Zoom (cujo link de acesso segue abaixo), " +
  CONVOCACAO;

const ABERTURA_HIBRIDA =
  "Na qualidade de Síndico do {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, convoco os Srs. Condôminos proprietários, em dia com suas obrigações, para participarem da Assembleia Geral {{assembleia.tipo}} a realizar-se no dia {{assembleia.data}}, às {{assembleia.hora1}}, em formato híbrido (presencial e virtual) pela plataforma Zoom (cujo link de acesso segue abaixo), " +
  CONVOCACAO;

/** As três aberturas, uma por modalidade — só a marcada no edital aparece. */
const ABERTURAS = [
  { id: "abertura-presencial", tipo: "texto" as const, texto: ABERTURA_PRESENCIAL, cond: 'assembleia.modalidade == "presencial"' },
  { id: "abertura-online", tipo: "texto" as const, texto: ABERTURA_ONLINE, cond: 'assembleia.modalidade == "online"' },
  { id: "abertura-hibrida", tipo: "texto" as const, texto: ABERTURA_HIBRIDA, cond: 'assembleia.modalidade == "hibrida"' },
];

/**
 * Camboriú usa a abertura da convenção, com remissão ao Artigo 16, e a instalação na mesma frase.
 * Como na de Balneário Camboriú, um parágrafo só — a modalidade entra por variante.
 */
const ABERTURA_CAMBORIU =
  "Na qualidade de síndico(a) do empreendimento denominado {{condominio.nomeRelatorio}}, localizado em {{condominio.enderecoEdital}}, atendendo o disposto no Artigo 16, alíneas “c” e “d”, da Convenção de Condomínio e do Regimento Interno, convoco todos os proprietários, compromissários compradores e/ou titulares de direitos e moradores das unidades autônomas a se reunirem em Assembleia Geral {{assembleia.tipo}}, ";

const INSTALACAO_CAMBORIU =
  "a ser instalada em primeira convocação às {{assembleia.hora1}} do dia {{assembleia.data}}, com a presença mínima de condôminos que representem 2/3 (dois terços) das frações ideais que constituem o condomínio, e em segunda e última convocação às {{assembleia.hora2}}, com a presença de qualquer número de participantes, a fim de deliberar sobre a seguinte ordem do dia:";

const ABERTURAS_CAMBORIU = [
  {
    id: "cbo-abertura-presencial",
    tipo: "texto" as const,
    texto: ABERTURA_CAMBORIU + "de forma presencial, " + INSTALACAO_CAMBORIU,
    cond: 'assembleia.modalidade == "presencial"',
  },
  {
    id: "cbo-abertura-online",
    tipo: "texto" as const,
    texto: ABERTURA_CAMBORIU + "de forma virtual pela plataforma Zoom (cujo link de acesso segue abaixo), " + INSTALACAO_CAMBORIU,
    cond: 'assembleia.modalidade == "online"',
  },
  {
    id: "cbo-abertura-hibrida",
    tipo: "texto" as const,
    texto:
      ABERTURA_CAMBORIU +
      "em formato híbrido (presencial e virtual) pela plataforma Zoom (cujo link de acesso segue abaixo), " +
      INSTALACAO_CAMBORIU,
    cond: 'assembleia.modalidade == "hibrida"',
  },
];

/** Itajaí: abertura com "situado em" e "por procuradores", e o mesmo parágrafo único. */
const ABERTURA_ITAJAI =
  "Na qualidade de Síndico do {{condominio.nomeRelatorio}}, situado em {{condominio.enderecoEdital}}, convoco os Srs. Condôminos proprietários, em dia com suas obrigações, para participarem da Assembleia Geral {{assembleia.tipo}}, a realizar-se no dia {{assembleia.data}} às {{assembleia.hora1}}, ";

const CONVOCACAO_ITAJAI =
  "em primeira convocação com a presença de 2/3 (dois terços) de proprietários ou por procuradores devidamente constituídos e às {{assembleia.hora2}} em segunda convocação, com qualquer número presente, a fim de deliberarem e aprovarem a seguinte ordem do dia:";

const ABERTURAS_ITAJAI = [
  {
    id: "itj-abertura-presencial",
    tipo: "texto" as const,
    texto: ABERTURA_ITAJAI + "de forma presencial, " + CONVOCACAO_ITAJAI,
    cond: 'assembleia.modalidade == "presencial"',
  },
  {
    id: "itj-abertura-online",
    tipo: "texto" as const,
    texto: ABERTURA_ITAJAI + "de forma virtual pela plataforma Zoom (cujo link de acesso segue abaixo), " + CONVOCACAO_ITAJAI,
    cond: 'assembleia.modalidade == "online"',
  },
  {
    id: "itj-abertura-hibrida",
    tipo: "texto" as const,
    texto:
      ABERTURA_ITAJAI +
      "em formato híbrido (presencial e virtual) pela plataforma Zoom (cujo link de acesso segue abaixo), " +
      CONVOCACAO_ITAJAI,
    cond: 'assembleia.modalidade == "hibrida"',
  },
];

/** Acesso ao Zoom: só no on-line e no híbrido. */
const BLOCO_ZOOM = [
  {
    id: "zoom-link",
    tipo: "item" as const,
    texto: "Link da reunião: {{assembleia.zoomLink}}",
    cond: 'assembleia.modalidade != "presencial"',
  },
  {
    id: "zoom-dados",
    tipo: "item" as const,
    texto: "ID da reunião: {{assembleia.zoomId}} — Senha: {{assembleia.zoomSenha}}",
    cond: 'assembleia.modalidade != "presencial"',
  },
];

/** Bloco NOTAS — está em 28 dos 44 editais, e é o que a prática usa nas três cidades. */
const NOTAS = [
  { id: "notas-titulo", tipo: "subtitulo" as const, texto: "NOTAS", cond: "" },
  {
    id: "notas-lgpd",
    tipo: "esquerda" as const,
    texto:
      "Todo participante da assembleia geral, seja condômino ou não, deverá fornecer seus dados pessoais e, conforme a Lei Geral de Proteção de Dados (LGPD), desde já, autoriza livremente o condomínio e a contabilidade a providenciarem o registro desses dados na respectiva ata, de caráter público, que será encaminhada aos órgãos oficiais, anexada ao livro de atas, compartilhada com os demais condôminos, divulgada no aplicativo do condomínio e utilizada para todos os fins necessários à boa administração condominial, não podendo alegar ignorância ou vício de consentimento.",
    cond: "",
  },
  {
    id: "notas-comparecimento",
    tipo: "esquerda" as const,
    texto: "Ante a importância dos assuntos a serem tratados pedimos o comparecimento de todos.",
    cond: "",
  },
  {
    id: "notas-procurador",
    tipo: "esquerda" as const,
    texto:
      "É lícito aos senhores condôminos se fazerem representar na Assembleia ora convocada por procurador munido de procuração.",
    cond: "",
  },
  {
    id: "notas-conjuge",
    tipo: "esquerda" as const,
    texto:
      "Ainda que conviventes, mas com ausência de união legal, o cônjuge participante da Assembleia deverá se fazer representar por procuração daquele em cujo nome constar o bem no Registro de Imóveis. Igual regra serve para os descendentes diretos - filhos.",
    cond: "",
  },
  {
    id: "notas-ausencia",
    tipo: "esquerda" as const,
    texto:
      "A ausência dos senhores condôminos não os desobriga da aceitação tácita e da concordância com os assuntos tratados, conforme forem deliberados.",
    cond: "",
  },
  {
    id: "notas-art1335",
    tipo: "esquerda" as const,
    texto:
      "Conforme Código Civil Brasileiro (Artigo 1.335, III do CC), informamos que é direito do condômino votar nas deliberações da Assembleia e dela participar, desde que esteja quite com suas obrigações condominiais.",
    cond: "",
  },
  { id: "notas-atencionamente", tipo: "esquerda" as const, texto: "Atenciosamente.", cond: "" },
];

const ASSINATURA = [
  {
    id: "assinatura-local",
    tipo: "esquerda" as const,
    texto: "{{assembleia.cidade}}, {{assembleia.dataEmissao}}.",
    cond: "",
  },
  {
    id: "assinatura-nome",
    tipo: "esquerda" as const,
    texto: "{{assembleia.assinante}}\n{{assembleia.cargo}}",
    cond: "",
  },
];

const PAUTA_ORDINARIA_BC = [
  "Aprovação das contas do exercício anterior (o balanço será enviado por e-mail antes da assembleia);",
  "Apreciação e aprovação da previsão orçamentária para o próximo exercício;",
  "Eleição de síndico, subsíndico e conselho fiscal/consultivo;",
  "Assuntos de interesses gerais.",
];

const PAUTA_ORDINARIA_CAMBORIU = [
  "Prestação de contas do(a) síndico(a) com mandato vigente;",
  "Eleição de síndico e subsíndico;",
  "Eleição do novo Conselho Fiscal;",
  "Eleição do novo Conselho Consultivo;",
  "Aprovação da previsão orçamentária do próximo exercício;",
  "Assuntos de interesse gerais.",
];

const PAUTA_EXTRAORDINARIA_CAMBORIU = [
  "Prestação de esclarecimentos acerca das ressalvas apontadas nas contas do exercício anterior, com posterior deliberação pela assembleia;",
  "Deliberação e aprovação de orçamentos para melhorias e benfeitorias no condomínio, com definição de verba e possível chamada de capital;",
  "Assuntos de interesse gerais.",
];

export function modelosEditalSemente(): Modelo[] {
  return [
    // ---------------------------------------------------------------- Balneário Camboriú
    {
      id: "mod-edital-balneario-camboriu",
      condoId: "",
      nome: "Balneário Camboriú",
      cidade: "Balneário Camboriú",
      tipo: "",
      versao: 1,
      pautaOrdinaria: [...PAUTA_ORDINARIA_BC],
      blocos: [
        { id: "bc-titulo", tipo: "titulo", texto: "EDITAL DE CONVOCAÇÃO", cond: "" },
        {
          id: "bc-sub-ord",
          tipo: "subtitulo",
          texto: "ASSEMBLEIA GERAL ORDINÁRIA",
          cond: 'assembleia.tipo == "ordinaria"',
        },
        {
          id: "bc-sub-ext",
          tipo: "subtitulo",
          texto: "ASSEMBLEIA GERAL EXTRAORDINÁRIA",
          cond: 'assembleia.tipo == "extraordinaria"',
        },
        ...ABERTURAS,
        { id: "bc-pauta", tipo: "pauta", texto: "", cond: "" },
        ...BLOCO_ZOOM,
        ...NOTAS,
        ...ASSINATURA,
      ],
    },

    // ------------------------------------------------------------ Camboriú (ordinária)
    {
      id: "mod-edital-camboriu-ordinaria",
      condoId: "",
      nome: "Camboriú — Ordinária",
      cidade: "Camboriú",
      tipo: "ordinaria",
      versao: 1,
      pautaOrdinaria: [...PAUTA_ORDINARIA_CAMBORIU],
      blocos: [
        { id: "cbo-titulo", tipo: "titulo", texto: "EDITAL DE CONVOCAÇÃO", cond: "" },
        { id: "cbo-sub", tipo: "subtitulo", texto: "ASSEMBLEIA GERAL ORDINÁRIA", cond: "" },
        ...ABERTURAS_CAMBORIU,
        { id: "cbo-pauta", tipo: "pauta", texto: "", cond: "" },
        ...BLOCO_ZOOM,
        {
          id: "cbo-chapas",
          tipo: "esquerda",
          texto:
            "As chapas poderão ser indicadas durante a Assembleia ou encaminhadas previamente à administradora, por meio do e-mail informado aos condôminos.",
          cond: "",
        },
        {
          id: "cbo-disposicoes",
          tipo: "subtitulo",
          texto: "DISPOSIÇÕES GERAIS",
          cond: "",
        },
        {
          id: "cbo-votar",
          tipo: "esquerda",
          texto:
            "Somente poderão votar e serem votados os condôminos que estiverem adimplentes com suas obrigações condominiais, conforme previsto na Convenção.",
          cond: "",
        },
        {
          id: "cbo-procuracao",
          tipo: "esquerda",
          texto:
            "O condômino poderá ser representado por procurador devidamente constituído, mediante apresentação de procuração com poderes específicos para participação e voto na assembleia.",
          cond: "",
        },
        {
          id: "cbo-virtual",
          tipo: "esquerda",
          texto:
            "Os participantes na modalidade virtual deverão acessar a plataforma com antecedência para validação de presença e credenciamento.",
          cond: 'assembleia.modalidade != "presencial"',
        },
        {
          id: "cbo-ausencia",
          tipo: "esquerda",
          texto:
            "A ausência dos senhores condôminos não os desobriga da aceitação tácita e da concordância com os assuntos tratados, conforme forem deliberados.",
          cond: "",
        },
        {
          id: "cbo-art1335",
          tipo: "esquerda",
          texto:
            "Conforme Código Civil Brasileiro (Artigo 1.335, III do CC), informamos que é direito do condômino votar nas deliberações da Assembleia e dela participar, desde que esteja quite com suas obrigações condominiais.",
          cond: "",
        },
        { id: "cbo-atencionamente", tipo: "esquerda", texto: "Atenciosamente.", cond: "" },
        ...ASSINATURA,
      ],
    },

    // ------------------------------------------------------- Camboriú (extraordinária)
    {
      id: "mod-edital-camboriu-extraordinaria",
      condoId: "",
      nome: "Camboriú — Extraordinária",
      cidade: "Camboriú",
      tipo: "extraordinaria",
      versao: 1,
      pautaOrdinaria: [...PAUTA_EXTRAORDINARIA_CAMBORIU],
      blocos: [
        { id: "cbe-titulo", tipo: "titulo", texto: "EDITAL DE CONVOCAÇÃO", cond: "" },
        { id: "cbe-sub", tipo: "subtitulo", texto: "ASSEMBLEIA GERAL EXTRAORDINÁRIA", cond: "" },
        ...ABERTURAS,
        { id: "cbe-pauta", tipo: "pauta", texto: "", cond: "" },
        ...BLOCO_ZOOM,
        ...NOTAS,
        ...ASSINATURA,
      ],
    },

    // ------------------------------------------------------------------------- Itajaí
    {
      id: "mod-edital-itajai",
      condoId: "",
      nome: "Itajaí",
      cidade: "Itajaí",
      tipo: "",
      versao: 1,
      pautaOrdinaria: [...PAUTA_ORDINARIA_BC],
      blocos: [
        { id: "itj-titulo", tipo: "titulo", texto: "EDITAL DE CONVOCAÇÃO", cond: "" },
        {
          id: "itj-sub-ord",
          tipo: "subtitulo",
          texto: "ASSEMBLEIA GERAL ORDINÁRIA",
          cond: 'assembleia.tipo == "ordinaria"',
        },
        {
          id: "itj-sub-ext",
          tipo: "subtitulo",
          texto: "ASSEMBLEIA GERAL EXTRAORDINÁRIA",
          cond: 'assembleia.tipo == "extraordinaria"',
        },
        ...ABERTURAS_ITAJAI,
        { id: "itj-pauta", tipo: "pauta", texto: "", cond: "" },
        ...BLOCO_ZOOM,
        ...NOTAS,
        ...ASSINATURA,
      ],
    },
  ];
}
