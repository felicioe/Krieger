/**
 * Conteúdo da Central de Ajuda do Krieger.
 *
 * O texto é estruturado em blocos (parágrafo, passos, dica, atenção) para a
 * tela renderizar com componentes próprios — nada de Markdown cru na página.
 * Trechos entre **asteriscos duplos** saem em negrito.
 *
 * Os ids dos artigos são estáveis: outras telas linkam com `?secao=<id>`
 * (importador, prestacao-contas, previsao-orcamentaria). Não renomear.
 */

export type AjudaCategoria = "inicio" | "rateio" | "relatorios" | "assembleias" | "administracao";

export type Bloco =
  | { tipo: "p"; texto: string }
  | { tipo: "passos"; itens: string[] }
  | { tipo: "dica"; texto: string }
  | { tipo: "atencao"; texto: string };

export type Pergunta = { pergunta: string; resposta: string };

export type ArtigoAjuda = {
  id: string;
  categoria: AjudaCategoria;
  titulo: string;
  resumo: string;
  palavrasChave: string[];
  /** Rota da tela correspondente, para o botão "Abrir a tela". */
  rota?: string;
  blocos: Bloco[];
  perguntas?: Pergunta[];
};

export type Categoria = { id: AjudaCategoria; nome: string; descricao: string };

/** Mesma ordem do menu lateral. Os ícones ficam na tela. */
export const CATEGORIAS: Categoria[] = [
  { id: "inicio", nome: "Primeiros passos", descricao: "Como o sistema se organiza e o cadastro base." },
  { id: "rateio", nome: "Apuração do rateio", descricao: "Prestação de contas, previsão e importação do Systemar." },
  { id: "relatorios", nome: "Relatórios", descricao: "Acompanhamento mensal, inadimplência e comparativos." },
  { id: "assembleias", nome: "Assembleias e documentos", descricao: "Editais, atas e o drive de documentos." },
  { id: "administracao", nome: "Administração", descricao: "Escritório, usuários, permissões e backup." },
];

export const ARTIGOS: ArtigoAjuda[] = [
  {
    id: "primeiros-passos",
    categoria: "inicio",
    titulo: "Visão geral do sistema",
    resumo: "Como o trabalho se organiza por condomínio e exercício, e a ordem do menu.",
    palavrasChave: ["início", "começar", "menu", "exercício", "painel"],
    rota: "/painel",
    blocos: [
      {
        tipo: "p",
        texto:
          "O Krieger organiza o trabalho por **condomínio** e, dentro dele, por **exercício** (a prestação de contas de um ano). Demonstrativo, previsão e relatório final ficam dentro de um exercício, acessado pela tela **Prestação de contas**.",
      },
      {
        tipo: "passos",
        itens: [
          "Cadastre o condomínio com unidades, frações e dados para editais.",
          "Abra o exercício em **Prestação de contas** e lance ou importe o demonstrativo.",
          "Apure o reajuste na **Previsão orçamentária** e salve.",
          "Acompanhe o ano pelos **Relatórios** e emita editais e atas da assembleia.",
        ],
      },
      {
        tipo: "dica",
        texto:
          "O menu lateral segue essa mesma ordem: Apuração do rateio, Relatórios, Assembleias e documentos, Cadastro e configuração e, por fim, Administração.",
      },
    ],
  },
  {
    id: "condominios",
    categoria: "inicio",
    titulo: "Cadastro de condomínios",
    resumo: "Dados, unidades e configurações reaproveitados em todo o sistema.",
    palavrasChave: ["condomínio", "cadastro", "unidades", "fração", "cnpj"],
    rota: "/condominios",
    blocos: [
      {
        tipo: "p",
        texto:
          "O cadastro guarda os dados que outras telas reaproveitam: quantidade de **unidades** (usada para dividir o rateio na previsão), **fração ideal** de cada unidade, dados para editais e atas e a regra de dedução usada no cálculo da previsão.",
      },
    ],
    perguntas: [
      {
        pergunta: "O sistema não calcula o valor por unidade na previsão. Por quê?",
        resposta:
          "Confira se o campo **Unidades** está preenchido no cadastro do condomínio. Sem ele, o sistema avisa e não tem como dividir o total pelo número de unidades.",
      },
    ],
  },
  {
    id: "prestacao-contas",
    categoria: "rateio",
    titulo: "Prestação de contas",
    resumo: "O exercício do condomínio: demonstrativo, previsão e relatório final partem daqui.",
    palavrasChave: ["prestação", "exercício", "demonstrativo", "saldo", "relatório final"],
    rota: "/prestacao-contas",
    blocos: [
      {
        tipo: "p",
        texto:
          "Cada linha da lista é um **exercício** (condomínio + ano). O **demonstrativo** é o extrato financeiro do ano: receitas, despesas por grupo, saldo anterior e atual. Ele pode ser digitado ou importado do PDF do Systemar.",
      },
      {
        tipo: "p",
        texto:
          "Com o demonstrativo lançado, a prestação alimenta a **previsão orçamentária** e o **relatório final**, que reúne as seções escolhidas num documento único, pronto para PDF ou Word.",
      },
    ],
  },
  {
    id: "previsao-orcamentaria",
    categoria: "rateio",
    titulo: "Previsão orçamentária",
    resumo: "Apura o reajuste do rateio a partir do realizado do período analisado.",
    palavrasChave: ["previsão", "reajuste", "rateio", "percentual", "fundo de reserva", "ajustes"],
    rota: "/previsao-orcamentaria",
    blocos: [
      {
        tipo: "passos",
        itens: [
          "Escolha o condomínio e a prestação de contas. A base são as despesas realizadas no período dessa prestação.",
          "Informe o **Percentual fixo** de reajuste, aplicado sobre a base após as deduções.",
          "Use **Ajustes da previsão** para acrescentar ou retirar valores anuais (obras programadas, contratos encerrados).",
          "Se necessário, lance a **Variação de despesas sugeridas**, valor anual positivo ou negativo sem vínculo com um grupo.",
          "Confira o **Resumo da previsão** e clique em **Salvar**.",
        ],
      },
      {
        tipo: "p",
        texto:
          "A média mensal usa a quantidade de meses do período analisado; o valor por unidade considera as unidades do cadastro, o fundo de reserva e o arredondamento escolhido.",
      },
      {
        tipo: "atencao",
        texto:
          "A previsão sugerida do Systemar, quando importada, é só referência e não substitui este cálculo. Os ajustes daqui também não aparecem na Previsão para relatórios.",
      },
    ],
    perguntas: [
      {
        pergunta: "O que significa “Índice de reajuste” no resumo?",
        resposta:
          "É a diferença percentual entre o valor por unidade calculado e o rateio atual. “Usar como rateio aprovado” preenche o valor aprovado na prestação; é preciso **salvar** para gravá-lo.",
      },
      {
        pergunta: "Por que a soma das médias dos grupos difere da média mensal do resumo?",
        resposta:
          "A média dos grupos considera deduções e percentual. Ajustes avulsos e a variação de despesas sugeridas entram separadamente no resumo, pois não pertencem a um grupo.",
      },
    ],
  },
  {
    id: "previsao-relatorios",
    categoria: "rateio",
    titulo: "Previsão para relatórios",
    resumo: "Realizado e previsto lado a lado, sem os ajustes exclusivos do rateio.",
    palavrasChave: ["previsão", "relatório", "por grupo", "detalhado", "exportar"],
    blocos: [
      {
        tipo: "p",
        texto:
          "O realizado vem das despesas do demonstrativo; o previsto aplica o percentual de reajuste a esse realizado. Não entram deduções, ajustes avulsos nem variação de despesas sugeridas.",
      },
      {
        tipo: "dica",
        texto:
          "Alterne entre **Por grupo** e **Detalhado**. PDF e Imprimir abrem a saída em janela própria, sem o menu; XLSX e CSV baixam os dados da apresentação selecionada.",
      },
    ],
  },
  {
    id: "importador",
    categoria: "rateio",
    titulo: "Importador do Systemar",
    resumo: "Lê o PDF do Systemar e preenche demonstrativo, frações e relatórios mensais.",
    palavrasChave: ["importar", "pdf", "systemar", "comparativo financeiro", "conflito", "apólice"],
    rota: "/importador",
    blocos: [
      {
        tipo: "p",
        texto:
          "Reconhece automaticamente demonstrativo, frações das unidades, previsão sugerida e a folha de apólice de seguro, quando presentes no PDF mensal ou anual.",
      },
      {
        tipo: "passos",
        itens: [
          "Envie o PDF e escolha o condomínio e a prestação de destino.",
          "Revise o comparativo entre o que o PDF trouxe e o que foi reconhecido.",
          "No **Comparativo Financeiro**, confira os meses marcados (os novos vêm marcados) e os avisos.",
          "Confirme. O demonstrativo da prestação escolhida é preservado.",
        ],
      },
      {
        tipo: "atencao",
        texto:
          "Sempre revise os valores antes de salvar: o PDF pode trazer linhas interpretadas de forma diferente da esperada.",
      },
    ],
    perguntas: [
      {
        pergunta: "Já existe lançamento para o mesmo mês. O que acontece?",
        resposta:
          "O sistema avisa o conflito e deixa você decidir, item por item, se mantém o que já estava ou atualiza com o PDF novo.",
      },
    ],
  },
  {
    id: "previsto-realizado",
    categoria: "relatorios",
    titulo: "Previsto × Realizado",
    resumo: "Compara o orçamento aprovado com o que foi gasto, no ano e mês a mês.",
    palavrasChave: ["previsto", "realizado", "orçado", "mensal", "variação", "orçamento"],
    rota: "/previsto-realizado",
    blocos: [
      {
        tipo: "p",
        texto:
          "Relatório só de leitura: mostra, por rubrica e grupo, o previsto (anual e acumulado até o mês escolhido) ao lado do realizado dos relatórios mensais. A versão **mensal** traz a mesma comparação mês a mês, com totais por linha e coluna.",
      },
      {
        tipo: "dica",
        texto:
          "Meses ausentes aparecem como “Sem dados”; com carga parcial, o total realizado é marcado como parcial. Uma despesa zerada num mês com relatório pode mostrar −100%.",
      },
    ],
  },
  {
    id: "relatorio-mensal",
    categoria: "relatorios",
    titulo: "Acompanhamento de carga mensal",
    resumo: "O boletim mensal do condomínio e as exportações em CSV, XLSX e PDF.",
    palavrasChave: ["mensal", "boletim", "csv", "xlsx", "pdf", "exportar", "imprimir"],
    rota: "/relatorio-mensal",
    blocos: [
      {
        tipo: "p",
        texto:
          "Reúne demonstrativo do mês, inadimplência e notas explicativas num documento pronto para PDF ou Word. É o relatório de rotina, separado do relatório final do exercício.",
      },
      {
        tipo: "dica",
        texto:
          "Esta lista, o Previsto × Realizado e as prestações exportam em **CSV** (abre no Excel com vírgula decimal) e **XLSX**, e imprimem em **A4 paisagem** com as mesmas colunas da tela.",
      },
    ],
  },
  {
    id: "inadimplencia",
    categoria: "relatorios",
    titulo: "Evolução da inadimplência",
    resumo: "Contas a receber mês a mês, com comparação ao ano anterior.",
    palavrasChave: ["inadimplência", "a receber", "unidades", "atraso"],
    rota: "/relatorios/inadimplencia",
    blocos: [
      {
        tipo: "p",
        texto:
          "Mostra unidades inadimplentes, valor a receber, percentual sobre as receitas e a comparação com o mesmo mês do ano anterior. Nada é recalculado: os números vêm dos relatórios mensais.",
      },
      {
        tipo: "dica",
        texto:
          "Como o valor a receber é um saldo, o rodapé mostra a **média** dos meses com dados, e não a soma. Meses sem relatório aparecem como “Sem dados”, nunca como zero.",
      },
    ],
  },
  {
    id: "comparativo-despesas",
    categoria: "relatorios",
    titulo: "Comparativo de despesas",
    resumo: "O que mais cresceu entre um exercício e outro, por grupo ou rubrica.",
    palavrasChave: ["comparativo", "despesas", "variação", "rubrica", "grupo"],
    rota: "/relatorios/comparativo-despesas",
    blocos: [
      {
        tipo: "p",
        texto:
          "Uma linha por grupo de despesa, com o total de cada exercício e a variação em reais e em percentual entre o primeiro e o último. Marque **Abrir por rubrica** para detalhar.",
      },
      {
        tipo: "dica",
        texto:
          "Grupos com o mesmo nome escrito de forma diferente (maiúsculas, acentos, espaços) são somados juntos. O total fecha com a prestação de contas.",
      },
    ],
  },
  {
    id: "consolidado-escritorio",
    categoria: "relatorios",
    titulo: "Consolidado do escritório",
    resumo: "Todos os condomínios numa tabela, para decidir onde olhar primeiro.",
    palavrasChave: ["consolidado", "escritório", "atrasado", "incompleto", "em dia", "carteira"],
    rota: "/relatorios/consolidado-escritorio",
    blocos: [
      {
        tipo: "p",
        texto:
          "Uma linha por condomínio, com receitas, despesas, saldo, inadimplência do último mensal, variação do rateio e a situação da carga em relação ao **mês de referência** (o mês anterior ao atual).",
      },
      {
        tipo: "passos",
        itens: [
          "**Atrasado**: não há relatório do mês de referência.",
          "**Incompleto**: há relatório, mas o saldo não fecha.",
          "**Em dia**: relatório carregado e saldo conferido.",
        ],
      },
    ],
  },
  {
    id: "editais-atas",
    categoria: "assembleias",
    titulo: "Editais e atas",
    resumo: "Convocação de assembleia e registro do que foi deliberado.",
    palavrasChave: ["edital", "ata", "assembleia", "convocação", "pauta", "modelo"],
    rota: "/editais",
    blocos: [
      {
        tipo: "p",
        texto:
          "O **edital** convoca a assembleia (data, pauta, modalidade). A **ata**, criada a partir de um edital emitido, puxa automaticamente data, local e pauta; só o conteúdo da reunião é digitado.",
      },
      {
        tipo: "dica",
        texto: "Os modelos de edital e de ata guardam blocos de texto reutilizáveis entre convocações e cidades.",
      },
    ],
  },
  {
    id: "drive-documentos",
    categoria: "assembleias",
    titulo: "Drive de documentos",
    resumo: "Arquivos do condomínio com busca pelo conteúdo, não só pelo nome.",
    palavrasChave: ["drive", "documentos", "arquivos", "busca", "contrato", "regimento"],
    rota: "/drive-documentos",
    blocos: [
      {
        tipo: "p",
        texto:
          "Guarda atas antigas, contratos e regimentos e permite buscar pelo conteúdo — útil para achar uma cláusula ou decisão sem lembrar em qual documento ela está.",
      },
    ],
  },
  {
    id: "administracao",
    categoria: "administracao",
    titulo: "Escritório, usuários e backup",
    resumo: "Perfis de acesso, permissões, dados do escritório e cópia de segurança.",
    palavrasChave: ["usuários", "perfil", "permissões", "superadm", "adm", "backup", "escritório", "senha"],
    rota: "/usuarios",
    blocos: [
      {
        tipo: "p",
        texto:
          "**Escritório** guarda nome, cidade, rodapé, assinatura e logo usados em relatórios e editais. **Usuários** controla quem acessa e o que cada um pode fazer. **Backup** exporta ou restaura todos os dados.",
      },
      {
        tipo: "passos",
        itens: [
          "**SuperADM**: acesso total; único que administra usuários, perfis, backup e escritório.",
          "**ADM**: opera o sistema inteiro, sem as telas de administração.",
          "**Usuário**: começa igual ao ADM e é restringido pelo SuperADM.",
        ],
      },
      {
        tipo: "atencao",
        texto:
          "As **exceções individuais** (botão de escudo na lista) valem por cima do perfil, e negar sempre ganha de permitir.",
      },
    ],
  },
];

/** Ids publicados em 23/11/2026; mantidos para links já compartilhados. */
export const ALIASES: Record<string, string> = {
  "visao-geral-inicio": "primeiros-passos",
  "condominios-cadastro": "condominios",
  "editais-atas-guia": "editais-atas",
  "documentos-drive": "drive-documentos",
};

/** Minúsculas e sem acento, para a busca ignorar “previsão” × “previsao”. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function textoDoArtigo(a: ArtigoAjuda): string {
  const blocos = a.blocos.map((b) => (b.tipo === "passos" ? b.itens.join(" ") : b.texto));
  const faq = (a.perguntas ?? []).map((p) => `${p.pergunta} ${p.resposta}`);
  return normalizar([a.titulo, a.resumo, ...a.palavrasChave, ...blocos, ...faq].join(" "));
}

/** Todos os termos precisam aparecer (título, resumo, palavras-chave, corpo ou FAQ). */
export function buscarArtigos(consulta: string, artigos: ArtigoAjuda[] = ARTIGOS): ArtigoAjuda[] {
  const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return artigos;
  return artigos.filter((a) => {
    const alvo = textoDoArtigo(a);
    return termos.every((t) => alvo.includes(t));
  });
}
