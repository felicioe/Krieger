import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { normalizarCondominio } from "@/domain/condominio";
import { mockApi } from "@/lib/mockApi";
import type { Condominio, Mensal } from "@/domain/types";

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useNavigate: () => async () => {},
}));
vi.mock("@/lib/pdfTexto", () => ({ extrairTextoPdf: async () => TEXTO }));

// O PDF traz código 73 e um CNPJ que não batem com nenhum cadastro (ex.: erro de OCR).
const TEXTO = [
  "Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90",
  "Demonstrativo de Receitas e Despesas - Período de 01/08/2026 a 31/08/2026",
  "(+) RECEITAS",
  "    Taxa condominial".padEnd(31) + "20.000,00",
  "".padEnd(31) + "20.000,00",
].join("\n");

const condo = (id: string, nome: string, codigo: string, cnpj: string) =>
  normalizarCondominio({ id, nome, codigo, cnpj } as Condominio);
const ESTRELAS = condo("c-estrelas", "Residencial Estrelas do Mar", "037", "98.765.432/0001-10");
const OUTRO = condo("c-outro", "Edifício Solar Juliana", "012", "11.111.111/0001-11");

function montar(condominios: Condominio[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ImportarPdf modo="novo" destino="mensais" condominios={condominios} />
    </QueryClientProvider>,
  );
}
async function lerPdf(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: "Importar PDF" }));
  await u.upload(screen.getByLabelText("Arquivo PDF do relatório"), new File(["%PDF"], "relatorio.pdf", { type: "application/pdf" }));
}

describe("importação: condomínio de nome parecido já cadastrado", () => {
  beforeEach(async () => {
    localStorage.clear();
    await mockApi.auth.entrar("admin", "admin123");
  });

  it("sugere o cadastro parecido sem esconder a opção de condomínio novo", async () => {
    const u = userEvent.setup();
    montar([OUTRO, ESTRELAS]);
    await lerPdf(u);
    expect(await screen.findByText(/Isso pode ser/)).toHaveTextContent("Residencial Estrelas do Mar");
    expect(screen.getByText(/Nenhum condomínio cadastrado com este código ou CNPJ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conferir cadastro novo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solar Juliana/ })).not.toBeInTheDocument();
  });

  it("“Usar este cadastro” grava no condomínio escolhido; “Não é este” volta para o cadastro novo", async () => {
    const u = userEvent.setup();
    montar([ESTRELAS]);
    await lerPdf(u);
    await u.click(await screen.findByRole("button", { name: "Usar o cadastro Residencial Estrelas do Mar" }));
    expect(screen.getByText(/Condomínio cadastrado:/)).toHaveTextContent("037 · Residencial Estrelas do Mar");

    await u.click(screen.getByRole("button", { name: "Não é este, é um condomínio novo" }));
    expect(screen.getByRole("button", { name: "Conferir cadastro novo" })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Usar o cadastro Residencial Estrelas do Mar" }));
    await u.click(screen.getByRole("button", { name: "Criar relatório mensal" }));
    await waitFor(async () => {
      const mensais = await mockApi.listar<Mensal>("mensais");
      expect(mensais.filter((m) => m.condoId === "c-estrelas")).toHaveLength(1);
    });
  });

  it("sem nome parecido, continua só o fluxo de condomínio novo", async () => {
    const u = userEvent.setup();
    montar([OUTRO]);
    await lerPdf(u);
    expect(await screen.findByRole("button", { name: "Conferir cadastro" })).toBeInTheDocument();
    expect(screen.queryByText(/Isso pode ser/)).not.toBeInTheDocument();
  });
});
