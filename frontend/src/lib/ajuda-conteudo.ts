/**
 * Conteúdo estruturado da Central de Ajuda do Krieger.
 * Cada artigo pertence a uma categoria, tem um id estável e corpo em Markdown.
 */

export type AjudaCategoria =
  | "visao-geral"
  | "condominios"
  | "prestacao-contas"
  | "previsao"
  | "relatorios"
  | "editais-atas"
  | "documentos"
  | "importacao"
  | "administracao";

export type ArtigoAjuda = {
  id: string;
  categoria: AjudaCategoria;
  titulo: string;
  resumo: string;
  palavrasChave: string[];
  corpo: string;
};

export const CATEGORIAS: { id: AjudaCategoria; nome: string; descricao: string; icone: string }[] = [
  { id: "visao-geral", nome: "Visão geral", descricao: "Como o Krieger se organiza e por onde começar.", icone: "LayoutDashboard" },
  { id: "condominios", nome: "Condomínios", descricao: "Cadastro, condomínios recentes e exercícios.", icone: "Building2" },
  { id: "prestacao-contas", nome: "Prestação de contas", descricao: "Demonstrativo, saldo e documentação do exercício.", icone: "Receipt" },
  { id: "previsao", nome: "Previsão orçamentária", descricao: "Planejamento do ano seguinte e comparação com relatórios.", icone: "Calculator" },
  { id: "relatorios", nome: "Relatórios", descricao: "Mensal, anual e comparativo orçado × realizado.", icone: "FileSpreadsheet" },
  { id: "editais-atas", nome: "Editais e atas", descricao: "Convocação de assembleia, modelos e registro de deliberações.", icone: "Megaphone" },
  { id: "documentos", nome: "Documentos", descricao: "Drive, importador e consulta de arquivos.", icone: "FolderOpen" },
  { id: "importacao", nome: "Importação", descricao: "Importador de demonstrativos e prévia de importação.", icone: "FileUp" },
  { id: "administracao", nome: "Administração", descricao: "Escritório, usuários, backup e preferências.", icone: "Settings2" },
];

export const ARTIGOS: ArtigoAjuda[] = [
  {
    id: "visao-geral-inicio",
    categoria: "visao-geral",
    titulo: "Visão geral do Krieger",
    resumo: "Como o Krieger se organiza e por onde começar a usar o sistema.",
    palavrasChave: ["início", "primeiros passos", "dashboard", "visão geral"],
    corpo: `# Visão geral do Krieger

O Krieger é um sistema de gestão condominial que centraliza prestação de contas, relatórios, editais, atas e documentos do seu condomínio em um só lugar.

## Por onde começar

1. Cadastre seu condomínio na seção de **Condomínios**.
2. Acesse o **dashboard** para ver o resumo do exercício em curso.
3. Explore os relatórios e a prestação de contas disponíveis.

Cada condomínio tem seus próprios exercícios, usuários e documentos, mantendo tudo organizado e separado por entidade.`,
  },
  {
    id: "condominios-cadastro",
    categoria: "condominios",
    titulo: "Cadastro de condomínios",
    resumo: "Como cadastrar, listar e gerenciar condomínios e exercícios no Krieger.",
    palavrasChave: ["condomínio", "cadastro", "exercício", "condomínios recentes"],
    corpo: `# Cadastro de condomínios

Na tela de **Condomínios** você cadastra novos condomínios e gerencia os já existentes.

## Passos

1. Vá ao menu **Condomínios**.
2. Clique em **Novo condomínio** e preencha os dados (nome, CNPJ, endereço, etc.).
3. Após salvar, crie o exercício vigente para começar a lançar movimentações.

Os condomínios recentes aparecem no topo da lista para acesso rápido.`,
  },
  {
    id: "prestacao-contas",
    categoria: "prestacao-contas",
    titulo: "Prestação de contas",
    resumo: "Demonstrativo, saldo e documentação do exercício.",
    palavrasChave: ["prestação de contas", "demonstrativo", "saldo", "documentação"],
    corpo: `# Prestação de contas

A prestação de contas reúne o demonstrativo financeiro, o saldo do exercício e a documentação de apoio.

## O que você encontra

- **Demonstrativo**: receitas, despesas e saldo apurado no período.
- **Saldo**: posição financeira atualizada do condomínio.
- **Documentação**: comprovantes e notas fiscais vinculados aos lançamentos.

Tudo pode ser filtrado por exercício e exportado em relatório.`,
  },
  {
    id: "previsao-orcamentaria",
    categoria: "previsao",
    titulo: "Previsão orçamentária",
    resumo: "Planejamento do ano seguinte e comparação com relatórios.",
    palavrasChave: ["previsão", "orçamento", "orçamentária", "planejamento"],
    corpo: `# Previsão orçamentária

Planeje o ano seguinte com base nos dados reais do exercício atual.

## Como funciona

1. Acesse **Previsão orçamentária** no menu.
2. Defina as receitas e despesas esperadas para o novo exercício.
3. Compare o orçado com o realizado usando os relatórios de comparação.

A comparação ajuda a identificar desvios e ajustar o planejamento ao longo do ano.`,
  },
  {
    id: "editais-atas-guia",
    categoria: "editais-atas",
    titulo: "Editais e atas de assembleia",
    resumo: "Convocação de assembleia, modelos e registro de deliberações.",
    palavrasChave: ["edital", "ata", "assembleia", "convocação", "deliberação"],
    corpo: `# Editais e atas

Gerencie convocações de assembleia, modelos de documentos e o registro de deliberações.

## O que fazer

- **Edital de convocação**: modelo pronto para preenchimento com data, horário e pauta.
- **Ata de assembleia**: registre as decisões tomadas pelos condôminos.
- **Arquivamento**: todos os documentos ficam salvos por exercício para consulta futura.

Utilize os modelos disponíveis para garantir conformidade com a legislação condominial.`,
  },
  {
    id: "documentos-drive",
    categoria: "documentos",
    titulo: "Drive e consulta de arquivos",
    resumo: "Armazenamento, importador e consulta de arquivos do condomínio.",
    palavrasChave: ["documentos", "drive", "arquivos", "consulta"],
    corpo: `# Documentos

O módulo de Documentos concentra o drive, o importador e a consulta de arquivos do condomínio.

## Recursos

- **Drive**: envie, organize e baixe arquivos do condomínio por categoria.
- **Importador**: importe demonstrativos e outros documentos em lote.
- **Consulta**: busque arquivos por nome, data ou categoria.

A prévia de importação permite revisar os dados antes de confirmar a importação.`,
  },
];
