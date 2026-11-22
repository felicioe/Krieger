import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import type { Usuario } from "@/domain/types";
import { condominioPadrao } from "@/domain/condominio";

// O jsdom não tem ResizeObserver; componentes de layout do formulário o usam.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { definirUsuario } = await import("@/lib/auth");
const { FormCondominio } = await import("@/routes/_authenticated.condominios.$id");

function montar(
  perfil: Usuario["perfil"],
  permissoes?: string[],
  ultimoAprovado: { ano: number; valor: number } | null = null,
) {
  definirUsuario({
    id: "u1",
    login: "teste",
    nome: "Teste",
    perfil,
    trocarSenha: false,
    ...(permissoes ? { permissoes } : {}),
  } as Usuario);
  const inicial = { ...condominioPadrao(), id: "c1", nome: "Condomínio Teste" };
  const raiz = createRootRoute({
    component: () => <FormCondominio inicial={inicial} ultimoAprovado={ultimoAprovado} />,
  });
  const router = createRouter({
    routeTree: raiz,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("cadastro do condomínio em abas (#303)", () => {
  it("SuperADM vê as três abas e a Configuração mostra regras e de-para", async () => {
    const user = montar("admin");
    expect(await screen.findByRole("tab", { name: "Cadastro" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ano a ano" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Configuração" }));
    const painel = screen.getByRole("tabpanel");
    expect(within(painel).getByText("Regras do relatório")).toBeInTheDocument();
    expect(within(painel).getByText("De-para de rótulos")).toBeInTheDocument();
  });

  it("Usuário não vê a aba Configuração", async () => {
    montar("user", ["condominios.visualizar"]);
    expect(await screen.findByRole("tab", { name: "Cadastro" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Configuração" })).toBeNull();
  });

  it("trocar de aba não perde o que foi digitado", async () => {
    const user = montar("admin");
    const nome = await screen.findByDisplayValue("Condomínio Teste");
    await user.clear(nome);
    await user.type(nome, "Novo nome");
    await user.click(screen.getByRole("tab", { name: "Ano a ano" }));
    await user.click(screen.getByRole("tab", { name: "Cadastro" }));
    expect(screen.getByDisplayValue("Novo nome")).toBeInTheDocument();
  });
});

describe("histórico de rateios no cadastro é só consulta (#304)", () => {
  it("mostra o aviso de consulta com link para a Previsão orçamentária", async () => {
    const user = montar("admin");
    await user.click(await screen.findByRole("tab", { name: "Ano a ano" }));
    const painel = screen.getByRole("tabpanel");
    await user.click(within(painel).getByRole("button", { name: /Histórico de rateios/ }));
    expect(within(painel).getByText(/Somente consulta/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previsão orçamentária" })).toHaveAttribute(
      "href",
      "/previsao-orcamentaria",
    );
  });
});

describe("rateio atual vem do histórico (#308)", () => {
  it("com histórico, o rateio do cadastro é só leitura e mostra o último aprovado", async () => {
    montar("admin", undefined, { ano: 2025, valor: 450 });
    const campo = await screen.findByLabelText(/Rateio mensal atual/);
    expect(campo).toBeDisabled();
    expect(screen.getByText(/Aprovado para 2025, do histórico de rateios/)).toBeInTheDocument();
  });

  it("sem histórico, o rateio do cadastro continua editável", async () => {
    montar("admin");
    expect(await screen.findByLabelText(/Rateio mensal atual/)).not.toBeDisabled();
  });
});
