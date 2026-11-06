import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Field } from "@/components/app/Field";
import { SelecaoBusca } from "@/components/app/inputs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConteudoMenu } from "@/components/app/AppSidebar";
import { ProvedorRegistroAlteracoes } from "@/components/versoes/RegistroAlteracoes";
import { definirUsuario } from "@/lib/auth";
import type { Usuario } from "@/domain/types";

describe("#228 pesquisa acessível de condomínio", () => {
  it("mantém o foco no combobox e identifica a opção que Enter aplicará", async () => {
    const user = userEvent.setup();
    function Pesquisa() {
      const [valor, setValor] = useState("a");
      return (
        <Field rotulo="Condomínio">
          <SelecaoBusca
            value={valor}
            onChange={setValor}
            opcoes={[
              { valor: "a", rotulo: "Acácias" },
              { valor: "b", rotulo: "Ipês" },
            ]}
          />
        </Field>
      );
    }
    render(<Pesquisa />);
    const origem = screen.getByRole("combobox", { name: "Condomínio" });
    await user.click(origem);
    const pesquisa = screen.getByRole("combobox");
    const lista = screen.getByRole("listbox");
    expect(pesquisa).toHaveFocus();
    expect(pesquisa).toHaveAttribute("aria-controls", lista.id);
    await user.keyboard("{ArrowDown}");
    const ipe = screen.getByRole("option", { name: "Ipês" });
    expect(pesquisa).toHaveAttribute("aria-activedescendant", ipe.id);
    expect(pesquisa).toHaveFocus();
    for (const opcao of screen.getAllByRole("option"))
      expect(opcao).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{Enter}");
    expect(origem).toHaveFocus();
    expect(origem).toHaveTextContent("Ipês");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("remove o descendente ativo sem resultados e Escape devolve o foco", async () => {
    const user = userEvent.setup();
    render(
      <Field rotulo="Condomínio">
        <SelecaoBusca value="a" onChange={() => {}} opcoes={[{ valor: "a", rotulo: "Acácias" }]} />
      </Field>,
    );
    const origem = screen.getByRole("combobox", { name: "Condomínio" });
    await user.click(origem);
    const pesquisa = screen.getByRole("combobox");
    await user.type(pesquisa, "inexistente");
    expect(screen.queryByRole("option")).toBeNull();
    expect(pesquisa).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Escape}");
    expect(origem).toHaveFocus();
  });
});

function DialogoDeTeste({
  removerOrigem = false,
  destinoProprio = false,
}: {
  removerOrigem?: boolean;
  destinoProprio?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [mostrarOrigem, setMostrarOrigem] = useState(true);
  return (
    <>
      {mostrarOrigem && <button onClick={() => setAberto(true)}>Abrir cadastro</button>}
      <button id="destino-proprio">Outro destino</button>
      <main id="conteudo" tabIndex={-1}>
        Conteúdo principal
      </main>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          aria-describedby={undefined}
          {...(destinoProprio
            ? {
                onCloseAutoFocus: (e: Event) => {
                  e.preventDefault();
                  document.getElementById("destino-proprio")?.focus();
                },
              }
            : {})}
        >
          <DialogTitle>Cadastro</DialogTitle>
          <input aria-label="Nome" />
          <button
            onClick={() => {
              if (removerOrigem) setMostrarOrigem(false);
              setAberto(false);
            }}
          >
            Concluir
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("#228 retorno de foco dos diálogos controlados", () => {
  it("devolve ao botão ao fechar por Escape", async () => {
    const user = userEvent.setup();
    render(<DialogoDeTeste />);
    const origem = screen.getByRole("button", { name: "Abrir cadastro" });
    await user.click(origem);
    expect(screen.getByLabelText("Nome")).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(origem).toHaveFocus());
  });

  it("foca o conteúdo se a origem foi removida", async () => {
    const user = userEvent.setup();
    render(<DialogoDeTeste removerOrigem />);
    await user.click(screen.getByRole("button", { name: "Abrir cadastro" }));
    await user.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
  });

  it("preserva o retorno explícito definido pela tela", async () => {
    const user = userEvent.setup();
    render(<DialogoDeTeste destinoProprio />);
    await user.click(screen.getByRole("button", { name: "Abrir cadastro" }));
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Outro destino" })).toHaveFocus(),
    );
  });
});

describe("#228 menu das previsões", () => {
  it.each(["", "?modo=rateio", "?modo=rateio&exercicio=e1", "?modo=relatorios&exercicio=e1"])(
    "alinha rota, destaque e página atual em %s",
    async (busca) => {
      definirUsuario({
        id: "u1",
        login: "admin",
        nome: "Administrador",
        perfil: "admin",
        trocarSenha: false,
        permissoes: ["*"],
      } as Usuario);
      const raiz = createRootRoute({
        component: () => (
          <ProvedorRegistroAlteracoes>
            <ConteudoMenu />
            <Outlet />
          </ProvedorRegistroAlteracoes>
        ),
      });
      const pagina = createRoute({
        getParentRoute: () => raiz,
        path: "/previsao-orcamentaria",
        validateSearch: (s: Record<string, unknown>) => ({
          modo: s["modo"] === "relatorios" ? "relatorios" : "rateio",
          exercicio: s["exercicio"] as string | undefined,
        }),
        component: () => <h1>Previsão</h1>,
      });
      const router = createRouter({
        routeTree: raiz.addChildren([pagina]),
        history: createMemoryHistory({ initialEntries: [`/previsao-orcamentaria${busca}`] }),
      });
      render(
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
      await screen.findByRole("heading", { name: "Previsão" });
      const rateio = screen.getByRole("link", { name: "Previsão orçamentária" });
      const relatorio = screen.getByRole("link", { name: "Previsão para relatórios" });
      const atual = busca.includes("relatorios") ? relatorio : rateio;
      const outro = atual === rateio ? relatorio : rateio;
      await waitFor(() => expect(atual).toHaveAttribute("aria-current", "page"));
      expect(atual).toHaveClass("bg-sidebar-accent");
      expect(outro).not.toHaveAttribute("aria-current");
      expect(outro).not.toHaveClass("bg-sidebar-accent");
      expect(relatorio.getAttribute("href")).toContain("modo=relatorios");
    },
  );
});
