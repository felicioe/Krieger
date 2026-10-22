import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnexarComparativo, ERRO_NAO_COMPARATIVO } from "@/components/importacao/AnexarComparativo";
import { ERRO_PDF_GRANDE, excluirPrestacaoComAnexos } from "@/components/importacao/anexos";
import { mockApi } from "@/lib/mockApi";
import type { AnexoImportado, Condominio, Exercicio } from "@/domain/types";

const leitura = vi.hoisted(() => ({ texto: "" }));
vi.mock("@/lib/pdfTexto", () => ({ extrairTextoPdf: async () => leitura.texto }));

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

  it("PDF que não é comparativo mostra o erro pedido e não grava nada", async () => {
    leitura.texto = PERIODO_UNICO;
    const u = userEvent.setup();
    await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("demonstrativo.pdf"));
    expect(await screen.findByText(ERRO_NAO_COMPARATIVO)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anexar à prestação de contas" })).not.toBeInTheDocument();
    expect(await mockApi.listar("anexos_importacao")).toEqual([]);
  });

  it("comparativo: sugere condomínio e exercício do ano do PDF e grava o anexo com o PDF original", async () => {
    leitura.texto = COMPARATIVO;
    const u = userEvent.setup();
    const router = await montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), pdf("Comparativo 001.pdf"));
    const anexar = await screen.findByRole("button", { name: "Anexar à prestação de contas" });
    const [condo, exercicio] = screen.getAllByRole("combobox");
    expect(condo).toHaveTextContent("Residencial Jardim das Acácias");
    // As prestações carregam da API: espera a sugestão pelo ano do PDF aparecer.
    await waitFor(() => expect(exercicio).toHaveTextContent("Exercício 2025"));

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
    expect(screen.queryByRole("button", { name: "Anexar à prestação de contas" })).not.toBeInTheDocument();
    expect(await mockApi.listar("anexos_importacao")).toEqual([]);
  });

  it("PDF de exatamente 10 MB é aceito", async () => {
    leitura.texto = COMPARATIVO;
    const u = userEvent.setup();
    await montar();
    const limite = pdf("limite.pdf");
    Object.defineProperty(limite, "size", { value: 10 * 1024 * 1024 });
    await u.upload(screen.getByLabelText("Arquivo PDF do Comparativo Financeiro"), limite);
    expect(await screen.findByRole("button", { name: "Anexar à prestação de contas" })).toBeInTheDocument();
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
