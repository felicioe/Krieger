import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnexarComparativo, ERRO_NAO_COMPARATIVO } from "@/components/importacao/AnexarComparativo";
import { ERRO_PDF_GRANDE, excluirPrestacaoComAnexos } from "@/components/importacao/anexos";
import { mockApi } from "@/lib/mockApi";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import type { AnexoImportado, Condominio, Exercicio, Mensal } from "@/domain/types";

const leitura = vi.hoisted(() => ({ texto: "" }));
vi.mock("@/lib/pdfTexto", () => ({ extrairTextoPdf: async () => leitura.texto }));

const receita = vi.hoisted(() => ({ dados: null as null | import("@/lib/receitaCnpj").DadosCnpjReceita }));
vi.mock("@/lib/receitaCnpj", async () => {
  const real = await vi.importActual<typeof import("@/lib/receitaCnpj")>("@/lib/receitaCnpj");
  return { ...real, consultarCnpjReceita: async () => receita.dados };
});

function linha(rotulo: string, recuo: number, valores: string[], fins: number[]): string {
  let s = " ".repeat(recuo) + rotulo;
  valores.forEach((v, i) => {
    s = s.padEnd(fins[i]! - v.length) + v;
  });
  return s;
}
const FINS = [44, 58, 72, 86];
// Condomínio 001 / CNPJ do condomínio de exemplo do preview, exercício 2025.
const COMPARATIVO = [
  "Condomínio: (001) - Residencial Jardim das Acácias - CNPJ: 12.345.678/0001-90",
  "Comparativo Financeiro de 01/2025 a 02/2025",
  linha("Competência", 0, ["01/2025", "02/2025", "Total", "Média"], FINS),
  "(*) SALDO ANTERIOR",
  linha("Banco do Brasil", 4, ["1.000,00", "2.000,00"], FINS),
  "(+) RECEITAS",
  linha("Taxa condominial", 4, ["10.000,00", "10.500,00", "20.500,00", "10.250,00"], FINS),
  "(-) DESPESAS",
  linha("Salários", 4, ["9.000,00", "9.500,00", "18.500,00", "9.250,00"], FINS),
  "(=) SALDO ATUAL",
  linha("Banco do Brasil", 4, ["2.000,00", "3.000,00"], FINS),
].join("\n");
const COMPARATIVO_NOVO = [
  "Condomínio: (999) - Condomínio Teste Novo - CNPJ: 11.222.333/0001-81",
  "Comparativo Financeiro de 01/2025 a 02/2025",
  linha("Competência", 0, ["01/2025", "02/2025", "Total", "Média"], FINS),
  "(*) SALDO ANTERIOR",
  linha("Banco do Brasil", 4, ["1.000,00", "2.000,00"], FINS),
  "(+) RECEITAS",
  linha("Taxa condominial", 4, ["10.000,00", "10.500,00", "20.500,00", "10.250,00"], FINS),
  "(-) DESPESAS",
  linha("Salários", 4, ["9.000,00", "9.500,00", "18.500,00", "9.250,00"], FINS),
  "(=) SALDO ATUAL",
  linha("Banco do Brasil", 4, ["2.000,00", "3.000,00"], FINS),
].join("\n");
const PERIODO_UNICO = [
  "Condomínio: (001) - Residencial Jardim das Acácias - CNPJ: 12.345.678/0001-90",
  "Demonstrativo de Receitas e Despesas - Período de 01/08/2025 a 31/08/2025",
  "(+) RECEITAS",
  linha("Taxa condominial", 4, ["20.000,00"], [40]),
  linha("", 0, ["20.000,00"], [40]),
].join("\n");

async function montar() {
  const condominios = await mockApi.listar<Condominio>("condominios");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const raiz = createRootRoute();
  const inicio = createRoute({
    getParentRoute: () => raiz,
    path: "/",
    component: () => <AnexarComparativo condominios={condominios} />,
  });
  const prestacao = createRoute({ getParentRoute: () => raiz, path: "/prestacao-contas/$id", component: () => <h1>Prestação</h1> });
  const lista = createRoute({ getParentRoute: () => raiz, path: "/prestacao-contas", component: () => <h1>Lista</h1> });
  const router = createRouter({
    routeTree: raiz.addChildren([inicio, prestacao, lista]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Anexar comparativo financeiro" });
  return router;
}
const pdf = (nome: string) => new File(["%PDF-1.4 conteúdo"], nome, { type: "application/pdf" });

describe("Importador: anexar Comparativo Financeiro", () => {
  beforeEach(async () => {
    localStorage.clear();
    await mockApi.auth.entrar("admin", "admin123");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falha ao gravar o anexo depois dos meses: tentar de novo sobrescreve os mesmos meses, não duplica", async () => {
    leitura.texto = COMPARATIVO;
    const original = mockApi.salvar.bind(mockApi);
    let falhouUmaVez = false;
    vi.spyOn(mockApi, "salvar").mockImplementation(async (store, o) => {
      if (store === "anexos_importacao" && !falhouUmaVez) {
        falhouUmaVez = true;
        throw new Error("Falha de rede simulada.");
      }
      return original(store, o);
    });
    const u = userEvent.setup();
    await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo 001.pdf"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Anexar e importar os meses" })).toBeEnabled());
    const anexar = screen.getByRole("button", { name: "Anexar e importar os meses" });

    // Primeira tentativa: os dois meses são gravados, mas o anexo falha (erro simulado) — o
    // botão volta a ficar clicável (mutação terminou, com erro) sem a lista de mensais ter sido
    // invalidada ainda.
    await u.click(anexar);
    await waitFor(() => expect(falhouUmaVez).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Anexar e importar os meses" })).toBeEnabled());
    let mensais = await mockApi.listar<Mensal>("mensais");
    expect(mensais.filter((m) => m.condoId === "condo-acacias" && m.origem.includes("Comparativo 001.pdf"))).toHaveLength(2);

    await u.click(screen.getByRole("button", { name: "Anexar e importar os meses" }));
    await waitFor(async () => expect(await mockApi.listar<AnexoImportado>("anexos_importacao")).toHaveLength(1));
    mensais = await mockApi.listar<Mensal>("mensais");
    expect(mensais.filter((m) => m.condoId === "condo-acacias" && m.origem.includes("Comparativo 001.pdf"))).toHaveLength(2);
  });

  it("PDF que não é comparativo mostra o erro pedido e não grava nada", async () => {
    leitura.texto = PERIODO_UNICO;
    const u = userEvent.setup();
    await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("demonstrativo.pdf"));
    expect(await screen.findByText(ERRO_NAO_COMPARATIVO)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anexar à prestação de contas" })).not.toBeInTheDocument();
    expect(await mockApi.listar("anexos_importacao")).toEqual([]);
  });

  it("comparativo: sugere condomínio e exercício do ano do PDF, grava o anexo e importa os meses sem conflito", async () => {
    leitura.texto = COMPARATIVO;
    const u = userEvent.setup();
    const router = await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo 001.pdf"));
    // A leitura do PDF é assíncrona (import dinâmico + extração de texto): espera o passo
    // seguinte renderizar, não só o upload disparar o onChange.
    const [condo, exercicio] = await screen.findAllByRole("combobox");
    expect(condo).toHaveTextContent("Residencial Jardim das Acácias");
    // As prestações carregam da API: espera a sugestão pelo ano do PDF aparecer.
    await waitFor(() => expect(exercicio).toHaveTextContent("Exercício 2025"));
    // Nenhum dos dois meses (01/2025, 02/2025) conflita com relatório mensal existente (o seed do
    // mock só vai até o mês atual de 2026) — os dois vêm marcados por padrão.
    expect(screen.getByRole("checkbox", { name: /01\/2025/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /02\/2025/ })).toBeChecked();
    const anexar = await screen.findByRole("button", { name: "Anexar e importar os meses" });

    await u.click(anexar);
    await waitFor(() => expect(router.state.location.pathname).toBe("/prestacao-contas/exe-acacias-2025"));
    const gravados = await mockApi.listar<AnexoImportado>("anexos_importacao");
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      exercicioId: "exe-acacias-2025",
      tipo: "comparativo_financeiro",
      arquivo: "Comparativo 001.pdf",
      relatorio: { layout: "comparativo" },
    });
    expect(gravados[0]!.arquivoDataUrl).toMatch(/^data:application\/pdf;base64,/);

    const mensais = await mockApi.listar<Mensal>("mensais");
    const doComparativo = mensais.filter((m) => m.condoId === "condo-acacias" && m.origem.includes("Comparativo 001.pdf"));
    expect(doComparativo).toHaveLength(2);
    const jan = doComparativo.find((m) => m.demonstrativo?.periodo.ini === "01/01/2025")!;
    expect(jan.demonstrativo!.totais).toEqual({ saldoAnterior: 1000, receitas: 10000, despesas: 9000, saldoAtual: 2000 });
  });

  it("mês com relatório mensal já existente vem desmarcado; desmarcado não sobrescreve, marcado sobrescreve o mesmo registro", async () => {
    const existente = await mockApi.salvar<Omit<Mensal, "id"> & { id?: string }>("mensais", {
      condoId: "condo-acacias",
      condoNome: "Residencial Jardim das Acácias",
      demonstrativo: { ...demonstrativoVazio(""), periodo: { ini: "01/01/2025", fim: "31/01/2025" } },
      origem: ["original.pdf"],
      receber: { unidades: 3, valor: 999 },
      notas: [],
    });

    leitura.texto = COMPARATIVO;
    const u = userEvent.setup();
    const router = await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo 001.pdf"));
    // Espera a lista refletir o relatório mensal já existente (useQuery), não só o primeiro
    // render (que começa com a lista vazia, antes da consulta resolver).
    await screen.findByText(/já existe um relatório mensal/);
    const checkJan = screen.getByRole("checkbox", { name: /01\/2025/ });
    const checkFev = screen.getByRole("checkbox", { name: /02\/2025/ });
    expect(checkJan).not.toBeChecked();
    expect(checkFev).toBeChecked();

    // Deixa 01/2025 desmarcado (não sobrescreve) e envia só o 02/2025 novo.
    await u.click(await screen.findByRole("button", { name: "Anexar e importar os meses" }));
    await waitFor(async () => expect(await mockApi.listar<AnexoImportado>("anexos_importacao")).toHaveLength(1));
    let mensais = await mockApi.listar<Mensal>("mensais");
    expect(mensais.find((m) => m.id === existente.id)?.receber).toEqual({ unidades: 3, valor: 999 });
    expect(mensais.filter((m) => m.condoId === "condo-acacias" && m.demonstrativo?.periodo.ini === "01/02/2025")).toHaveLength(1);

    // O primeiro anexar navega pra prestação de contas (igual em produção); volta pro Importador
    // antes de reabrir o diálogo pra anexar o segundo comparativo.
    await waitFor(() => expect(router.state.location.pathname).toBe("/prestacao-contas/exe-acacias-2025"));
    await router.navigate({ to: "/" });
    await screen.findByRole("button", { name: "Anexar comparativo financeiro" });

    // Reabre e agora marca 01/2025: sobrescreve o mesmo id, não duplica.
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo 002.pdf"));
    await u.click(await screen.findByRole("checkbox", { name: /01\/2025/ }));
    await u.click(await screen.findByRole("button", { name: "Anexar e importar os meses" }));
    await waitFor(async () => expect(await mockApi.listar<AnexoImportado>("anexos_importacao")).toHaveLength(2));
    mensais = await mockApi.listar<Mensal>("mensais");
    expect(mensais.filter((m) => m.condoId === "condo-acacias" && m.demonstrativo?.periodo.ini === "01/01/2025")).toHaveLength(1);
    const jan = mensais.find((m) => m.id === existente.id)!;
    expect(jan.demonstrativo!.totais.receitas).toBe(10000);
    expect(jan.receber).toEqual({ unidades: null, valor: null });
  });

  it("PDF maior que 10 MB é recusado antes de ler e não grava nada", async () => {
    leitura.texto = COMPARATIVO;
    const u = userEvent.setup();
    await montar();
    const grande = pdf("grande.pdf");
    Object.defineProperty(grande, "size", { value: 10 * 1024 * 1024 + 1 });
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), grande);
    expect(await screen.findByText(ERRO_PDF_GRANDE)).toBeInTheDocument();
    expect(ERRO_PDF_GRANDE).toBe("PDF maior que 10 MB — escolha um arquivo menor.");
    expect(screen.queryByRole("button", { name: /Anexar/ })).not.toBeInTheDocument();
    expect(await mockApi.listar("anexos_importacao")).toEqual([]);
  });

  it("PDF de exatamente 10 MB é aceito", async () => {
    leitura.texto = COMPARATIVO;
    const u = userEvent.setup();
    await montar();
    const limite = pdf("limite.pdf");
    Object.defineProperty(limite, "size", { value: 10 * 1024 * 1024 });
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), limite);
    expect(await screen.findByRole("button", { name: "Anexar e importar os meses" })).toBeInTheDocument();
    expect(screen.queryByText(ERRO_PDF_GRANDE)).not.toBeInTheDocument();
  });
});

describe("Excluir prestação de contas leva os anexos junto", () => {
  beforeEach(async () => {
    localStorage.clear();
    await mockApi.auth.entrar("admin", "admin123");
  });

  it("apaga só os anexos daquela prestação e depois a prestação", async () => {
    const base = { tipo: "comparativo_financeiro" as const, arquivo: "c.pdf", arquivoDataUrl: "data:application/pdf;base64,", importadoEm: "2026-01-01T00:00:00.000Z", relatorio: {} as AnexoImportado["relatorio"] };
    await mockApi.salvar("anexos_importacao", { ...base, id: "a1", exercicioId: "exe-acacias-2025" });
    await mockApi.salvar("anexos_importacao", { ...base, id: "a2", exercicioId: "exe-acacias-2025" });
    await mockApi.salvar("anexos_importacao", { ...base, id: "a3", exercicioId: "outra-prestacao" });

    expect(await excluirPrestacaoComAnexos("exe-acacias-2025")).toBe(2);

    const restantes = await mockApi.listar<AnexoImportado>("anexos_importacao");
    expect(restantes.map((a) => a.id)).toEqual(["a3"]);
    const exercicios = await mockApi.listar<Exercicio>("exercicios");
    expect(exercicios.some((x) => x.id === "exe-acacias-2025")).toBe(false);
  });
});

describe("Pré-cadastro de condomínio a partir do comparativo", () => {
  beforeEach(async () => {
    localStorage.clear();
    await mockApi.auth.entrar("admin", "admin123");
    receita.dados = null;
  });

  it("cadastra o condomínio com nome/CNPJ do PDF e endereço da Receita Federal, e já o seleciona", async () => {
    receita.dados = {
      razaoSocial: "CONDOMINIO TESTE NOVO",
      situacaoCadastral: "ATIVA",
      logradouro: "RUA DAS FLORES",
      numero: "123",
      complemento: "",
      bairro: "CENTRO",
      municipio: "CURITIBA",
      uf: "PR",
      cep: "80000000",
    };
    leitura.texto = COMPARATIVO_NOVO;
    const u = userEvent.setup();
    await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo Novo.pdf"));
    const botao = await screen.findByRole("button", { name: "Cadastrar como novo condomínio" });

    await u.click(botao);

    // O condomínio recém-criado não está na lista estática deste harness de teste (o app de
    // verdade repassa a lista via useSuspenseQuery, que reage à invalidação; aqui é só uma prop
    // fixa) — o sinal observável de que condoId mudou é esse aviso, que depende só do estado
    // interno do componente, não da lista de condomínios.
    await screen.findByText(/ainda não tem prestação de contas/);

    const condominios = await mockApi.listar<Condominio>("condominios");
    const novo = condominios.find((c) => c.nome === "Condomínio Teste Novo");
    expect(novo).toMatchObject({
      codigo: "999",
      cnpj: "11.222.333/0001-81",
      nomeRelatorio: "Condomínio Teste Novo",
      enderecoEdital: "RUA DAS FLORES, 123 - CENTRO - CURITIBA/PR - CEP 80000-000",
    });
  });

  it("sem resposta da Receita Federal, cadastra mesmo assim só sem o endereço", async () => {
    receita.dados = null;
    leitura.texto = COMPARATIVO_NOVO;
    const u = userEvent.setup();
    await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo Novo.pdf"));
    const botao = await screen.findByRole("button", { name: "Cadastrar como novo condomínio" });

    await u.click(botao);

    await waitFor(async () => {
      const condominios = await mockApi.listar<Condominio>("condominios");
      expect(condominios.some((c) => c.nome === "Condomínio Teste Novo")).toBe(true);
    });
    const condominios = await mockApi.listar<Condominio>("condominios");
    const novo = condominios.find((c) => c.nome === "Condomínio Teste Novo");
    expect(novo?.enderecoEdital).toBe("");
  });
});
