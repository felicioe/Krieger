import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { Usuario } from "@/domain/types";
import dados from "@/data/versoes.json";

// "Sair" simulado: nada chega ao servidor; o teste só confere se (e quando) foi chamado.
const sair = vi.fn(async () => {});
vi.mock("@/lib/auth", async (original) => {
  const real = await original<typeof import("@/lib/auth")>();
  return { ...real, sair: () => sair() };
});

const { definirUsuario } = await import("@/lib/auth");
const { ConteudoMenu, ITENS_MENU } = await import("@/components/app/AppSidebar");
const { MenuMovel } = await import("@/components/app/MenuMovel");
const { ProvedorRegistroAlteracoes } = await import("@/components/versoes/RegistroAlteracoes");

function montar({
  perfil = "admin",
  nome = "Maria Souza",
  movel = false,
  comProvedor = true,
  permissoes,
  caminhoInicial = "/",
}: {
  perfil?: Usuario["perfil"];
  nome?: string;
  movel?: boolean;
  comProvedor?: boolean;
  permissoes?: string[];
  caminhoInicial?: string;
} = {}) {
  definirUsuario({
    id: "u-teste",
    login: "maria",
    nome,
    perfil,
    trocarSenha: false,
    ...(permissoes ? { permissoes } : {}),
  } as Usuario);
  const Menu = movel ? (
    <MenuMovel destinoFoco={() => document.getElementById("conteudo")}>
      {(aoNavegar, depoisDeFechar) => (
        <ConteudoMenu aoNavegar={aoNavegar} depoisDeFechar={depoisDeFechar} />
      )}
    </MenuMovel>
  ) : (
    <aside>
      <ConteudoMenu />
    </aside>
  );
  const corpo = (
    <>
      {Menu}
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
  const raiz = createRootRoute({
    component: () =>
      comProvedor ? <ProvedorRegistroAlteracoes>{corpo}</ProvedorRegistroAlteracoes> : corpo,
  });
  const pagina = (caminho: string, titulo: string) =>
    createRoute({ getParentRoute: () => raiz, path: caminho, component: () => <h1>{titulo}</h1> });
  const inicio = createRoute({
    getParentRoute: () => raiz,
    path: "/",
    component: () => (
      <label>
        Observação
        <input />
      </label>
    ),
  });
  const router = createRouter({
    routeTree: raiz.addChildren([
      inicio,
      pagina("/minha-senha", "Minha senha"),
      pagina("/usuarios", "Usuários"),
      pagina("/login", "Entrar"),
    ]),
    history: createMemoryHistory({ initialEntries: [caminhoInicial] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup(), pronto: () => screen.findByLabelText("Observação") };
}

const botaoConta = (nome = "Maria Souza") =>
  screen.getByRole("button", { name: new RegExp(`Conta: ${nome}`) });

beforeEach(() => {
  sair.mockClear();
  localStorage.clear();
});

describe("expansão dos grupos do menu", () => {
  it("abre somente o grupo da rota no primeiro acesso", async () => {
    montar({ caminhoInicial: "/usuarios" });
    await screen.findByRole("heading", { name: "Usuários" });
    const menu = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(menu).getByRole("button", { name: "Administração" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(menu.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(1);
  });

  it("mantém o foco e grava a escolha explícita para o usuário", async () => {
    const { user, pronto } = montar();
    await pronto();
    const controle = screen.getByRole("button", { name: "Expandir todos os grupos" });
    controle.focus();
    await user.keyboard("{Enter}");
    expect(controle).toHaveFocus();
    expect(controle).toHaveAccessibleName("Recolher todos os grupos");
    expect(localStorage.getItem("krieger.menu.grupos-fechados.u-teste")).toBe("[]");
  });
});

describe("favoritos recolhíveis", () => {
  it("recolhe e reabre o bloco Favoritos, com o estado salvo por usuário", async () => {
    localStorage.setItem("krieger.favoritos.u-teste", JSON.stringify(["/painel"]));
    const { user, pronto } = montar();
    await pronto();
    const menu = screen.getByRole("navigation", { name: "Menu principal" });
    const cabecalho = within(menu).getByRole("button", { name: "Favoritos" });
    expect(cabecalho).toHaveAttribute("aria-expanded", "true");
    await user.click(cabecalho);
    expect(cabecalho).toHaveAttribute("aria-expanded", "false");
    expect(
      JSON.parse(localStorage.getItem("krieger.menu.grupos-fechados.u-teste") ?? "[]"),
    ).toContain("Favoritos");
    await user.click(cabecalho);
    expect(cabecalho).toHaveAttribute("aria-expanded", "true");
  });
});

describe("atalhos favoritos", () => {
  it("limita a cinco atalhos, mantém a ordem salva e sinaliza o limite", async () => {
    const salvos = [
      "/usuarios",
      "/backup",
      "/painel",
      "/importador",
      "/condominios",
      "/prestacao-contas",
    ];
    localStorage.setItem("krieger.favoritos.u-teste", JSON.stringify(salvos));
    const { user, pronto } = montar();
    await pronto();
    const menu = screen.getByRole("navigation", { name: "Menu principal" });
    expect(
      within(menu)
        .getAllByRole("link")
        .slice(0, 5)
        .map((link) => link.textContent),
    ).toEqual(["Usuários", "Backup", "Painel", "Importador", "Condomínios"]);
    await user.click(screen.getByRole("button", { name: "Expandir todos os grupos" }));
    const adicionar = screen.getAllByRole("button", {
      name: /Adicionar .* aos favoritos: limite/,
    })[0];
    expect(adicionar).toHaveAttribute("aria-disabled", "true");
  });
});

describe("bloco da conta no menu lateral", () => {
  it("começa recolhido: opções fora da página (sem foco) e módulos principais intactos", async () => {
    const { user } = montar();
    await screen.findByLabelText("Observação");
    const conta = botaoConta();
    expect(conta).toHaveAttribute("aria-expanded", "false");
    expect(conta).toHaveAccessibleName(/SuperADM/);
    await user.click(screen.getByRole("button", { name: "Expandir todos os grupos" }));
    expect(screen.getByRole("link", { name: "Usuários" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Minha senha" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    await user.click(botaoConta());
    const opcoes = screen.getByRole("list", { name: "Opções da conta" });
    expect(within(opcoes).getByRole("link", { name: "Central de ajuda" })).toBeInTheDocument();
    expect(
      within(opcoes).getByRole("button", { name: "Registro de Alterações" }),
    ).toBeInTheDocument();
    const principal = screen.getByRole("navigation", { name: "Menu principal" });
    expect(
      within(principal)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(ITENS_MENU.map((i) => i.titulo));
  });

  it("expande e recolhe pelo teclado sem sair nem trocar de página", async () => {
    const { router, user } = montar();
    await screen.findByLabelText("Observação");
    const conta = botaoConta();
    conta.focus();
    await user.keyboard("{Enter}");
    expect(conta).toHaveAttribute("aria-expanded", "true");
    const regiao = document.getElementById(conta.getAttribute("aria-controls")!);
    expect(regiao).not.toBeNull();
    expect(within(regiao!).getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(conta).toHaveFocus();

    await user.keyboard(" ");
    expect(conta).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(sair).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/");
  });

  it("administrador vê Usuários e Limpeza de Dados; usuário comum não", async () => {
    const { user, pronto } = montar({ perfil: "user", nome: "João" });
    await pronto();
    expect(screen.queryByRole("link", { name: "Limpeza de Dados" })).toBeNull();
    await user.click(botaoConta("João"));
    expect(botaoConta("João")).toHaveAccessibleName(/Usuário$/);
    expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
    expect(screen.getByRole("link", { name: "Minha senha" })).toBeInTheDocument();
  });

  it("Minha senha e Usuários mantêm os destinos, e Sair encerra uma vez", async () => {
    const { router, user, pronto } = montar();
    await pronto();
    await user.click(screen.getByRole("button", { name: "Administração" }));
    await user.click(screen.getByRole("link", { name: "Usuários" }));
    await screen.findByRole("heading", { name: "Usuários" });
    expect(sair).not.toHaveBeenCalled();

    await user.click(botaoConta());
    await user.click(screen.getByRole("link", { name: "Minha senha" }));
    await screen.findByRole("heading", { name: "Minha senha" });
    expect(router.state.location.pathname).toBe("/minha-senha");

    expect(sair).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(sair).toHaveBeenCalledTimes(1);
  });

  it("Registro de Alterações: abre a versão atual, fecha com Escape, devolve o foco e mantém o digitado", async () => {
    const { user } = montar();
    await user.type(await screen.findByLabelText("Observação"), "rascunho");
    await user.click(botaoConta());
    const abrir = screen.getByRole("button", { name: "Registro de Alterações" });
    await user.click(abrir);
    const janela = await screen.findByRole("dialog", { name: "Registro de Alterações" });
    expect(
      within(janela).getByText(
        new RegExp(`Versão atual: ${dados.versaoAtual.replace(".", "\\.")}\\.`),
      ),
    ).toBeInTheDocument();
    expect(within(janela).getByText("Implantação inicial do Sistema Krieger.")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(abrir).toHaveFocus();
    expect(screen.getByLabelText("Observação")).toHaveValue("rascunho");
    expect(sair).not.toHaveBeenCalled();
  });

  it("sem a área logada (sem provedor), a ação do registro não existe", async () => {
    const { user, pronto } = montar({ comProvedor: false });
    await pronto();
    await user.click(botaoConta());
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registro de Alterações" })).toBeNull();
  });
});

describe("Registro de Alterações pela gaveta do celular", () => {
  it("fecha a gaveta antes de abrir a janela e, ao fechar, o foco volta ao 'Abrir menu'", async () => {
    const { user } = montar({ movel: true });
    await user.type(await screen.findByLabelText("Observação"), "rascunho");
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const gaveta = await screen.findByRole("dialog", { name: "Menu" });
    // Gaveta remonta o menu: o bloco da conta começa recolhido também aqui.
    const conta = within(gaveta).getByRole("button", { name: /Conta: Maria Souza/ });
    expect(conta).toHaveAttribute("aria-expanded", "false");
    await user.click(conta);
    await user.click(within(gaveta).getByRole("button", { name: "Registro de Alterações" }));

    const janela = await screen.findByRole("dialog", { name: "Registro de Alterações" });
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await waitFor(() => expect(janela).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveFocus());
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(screen.getByLabelText("Observação")).toHaveValue("rascunho");
    expect(sair).not.toHaveBeenCalled();
  });
});

describe("menu por perfil (#310)", () => {
  const link = (nome: string) => screen.queryByRole("link", { name: nome });

  it("SuperADM vê Dados, modelos e a Administração completa", async () => {
    const { user, pronto } = montar();
    await pronto();
    await user.click(screen.getByRole("button", { name: "Expandir todos os grupos" }));
    for (const nome of [
      "Importador",
      "Modelos de edital",
      "Modelos de ata",
      "Escritório",
      "Backup",
      "Limpeza de Dados",
    ])
      expect(link(nome)).toBeInTheDocument();
  });

  it("ADM vê Dados e modelos, mas não Escritório, Backup nem Limpeza", async () => {
    const { user, pronto } = montar({
      perfil: "adm",
      nome: "Ana",
      permissoes: [
        "painel.visualizar",
        "prestacao_contas.visualizar",
        "importador.visualizar",
        "modelos.visualizar",
        "modelos_ata.visualizar",
      ],
    });
    await pronto();
    await user.click(screen.getByRole("button", { name: "Expandir todos os grupos" }));
    for (const nome of ["Importador", "Modelos de edital", "Modelos de ata"])
      expect(link(nome)).toBeInTheDocument();
    for (const nome of ["Escritório", "Backup", "Limpeza de Dados"]) expect(link(nome)).toBeNull();
  });

  it("favorito de módulo sem permissão não aparece na seção Favoritos (#296)", async () => {
    localStorage.setItem(
      "krieger.favoritos.u-teste",
      JSON.stringify(["/backup", "/prestacao-contas"]),
    );
    const { pronto } = montar({
      perfil: "user",
      nome: "João",
      permissoes: ["prestacao_contas.visualizar"],
    });
    await pronto();
    expect(screen.getByText("Favoritos")).toBeInTheDocument();
    expect(link("Backup")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Prestação de contas" }).length).toBeGreaterThan(0);
    localStorage.removeItem("krieger.favoritos.u-teste");
  });

  it("Usuário só com rotinas de uso não vê Dados, modelos ou Administração; a ajuda permanece acessível", async () => {
    const { user, pronto } = montar({
      perfil: "user",
      nome: "João",
      permissoes: ["painel.visualizar", "prestacao_contas.visualizar"],
    });
    await pronto();
    await user.click(screen.getByRole("button", { name: "Expandir todos os grupos" }));
    expect(link("Prestação de contas")).toBeInTheDocument();
    for (const nome of ["Importador", "Modelos de edital", "Modelos de ata", "Escritório"])
      expect(link(nome)).toBeNull();
    expect(botaoConta("João")).toHaveAttribute("aria-expanded", "false");
    await user.click(botaoConta("João"));
    expect(link("Central de ajuda")).toBeInTheDocument();
  });
});
