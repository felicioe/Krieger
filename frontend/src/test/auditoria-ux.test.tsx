import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/Field";
import { MenuMovel } from "@/components/app/MenuMovel";
import { SecaoRecolhivel } from "@/components/app/SecaoRecolhivel";
import { contagem, haDias, prazoDias } from "@/components/app/textos";
import { QuadroAvisos, SituacaoResultado, tipoAviso } from "@/components/previsao/AvisosPrevisao";
import { ValorPorUnidade } from "@/components/previsao/PainelPrevisao";
import { calcularPrevisao, type ParametrosPrevisao } from "@/domain/previsao";
import type { Demonstrativo } from "@/domain/types";

describe("#62 textos naturais", () => {
  it("singular e plural sem '(s)'", () => {
    expect(contagem(1, "condomínio", "condomínios")).toBe("1 condomínio");
    expect(contagem(2, "condomínio", "condomínios")).toBe("2 condomínios");
    expect(contagem(0, "condomínio", "condomínios")).toBe("0 condomínios");
  });
  it("tempo desde o backup: hoje, ontem, há N dias (nunca 'há 0 dias')", () => {
    expect(haDias(0)).toBe("hoje");
    expect(haDias(1)).toBe("ontem");
    expect(haDias(12)).toBe("há 12 dias");
  });
  it("prazos do painel: vence hoje/amanhã, venceu ontem, vencido há N dias", () => {
    expect(prazoDias(0)).toBe("Vence hoje");
    expect(prazoDias(1)).toBe("Vence amanhã");
    expect(prazoDias(30)).toBe("Em 30 dias");
    expect(prazoDias(-1)).toBe("Venceu ontem");
    expect(prazoDias(-5)).toBe("Vencido há 5 dias");
  });
});

const demo = (valor: number): Demonstrativo =>
  ({
    despesas: { grupos: [{ nome: "Pessoal", itens: [{ nome: "Salários", valor }] }] },
  }) as unknown as Demonstrativo;
const params = (p: Partial<ParametrosPrevisao> = {}): ParametrosPrevisao =>
  ({
    variacao: 5,
    variacaoMetodo: "manual",
    variacaoParam: null,
    arredondamento: "truncar",
    prev: { modo: "tradicional", ajustes: [] },
    deducaoRegex: "",
    rateioAtual: 100,
    ...p,
  }) as ParametrosPrevisao;

describe("#60 avisos da previsão no lugar certo", () => {
  it("cada aviso do cálculo é ligado ao assunto certo (unidades, variação, índices, despesas)", () => {
    const semUnidades = calcularPrevisao(demo(12000), params(), null);
    expect(semUnidades.avisos.map(tipoAviso)).toEqual(["unidades"]);

    const incomum = calcularPrevisao(demo(12000), params({ variacao: 150 }), 10);
    expect(incomum.avisos.map(tipoAviso)).toEqual(["variacao"]);

    const semIndices = calcularPrevisao(
      demo(12000),
      params({ variacaoMetodo: "mediaIndices", indices: [] }),
      10,
    );
    expect(semIndices.avisos.map(tipoAviso)).toEqual(["indices"]);

    const vazio = calcularPrevisao(null, params(), 10);
    expect(vazio.avisos.map(tipoAviso)).toEqual(["despesas"]);
  });

  it("sem unidades o resultado aparece como parcial e o valor por unidade como 'Não calculado'", () => {
    const r = calcularPrevisao(demo(12000), params(), null);
    expect(r.rateioSugerido).toBeNull();
    render(
      <>
        <QuadroAvisos
          id="q"
          itens={r.avisos.map((texto) => ({ texto }))}
          parcial={r.rateioSugerido === null}
        />
        <SituacaoResultado parcial avisos={r.avisos.length} idQuadro="q" />
        <ValorPorUnidade valor={r.rateioSugerido} rodape="truncado" semUnidades />
      </>,
    );
    expect(screen.getByRole("status", { name: /Resultado parcial/ })).toBeInTheDocument();
    expect(screen.getByText("Não calculado")).toBeInTheDocument();
    expect(screen.getByText(/Falta a quantidade de unidades/)).toBeInTheDocument();
  });

  it("caso válido: sem quadro de aviso, situação 'Cálculo completo' e valor em reais", () => {
    const r = calcularPrevisao(demo(12000), params(), 10);
    expect(r.avisos).toEqual([]);
    render(
      <>
        <QuadroAvisos id="q" itens={[]} parcial={false} />
        <SituacaoResultado parcial={false} avisos={0} idQuadro="q" />
        <ValorPorUnidade valor={r.rateioSugerido} rodape="truncado" semUnidades={false} />
      </>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Cálculo completo.")).toBeInTheDocument();
    expect(screen.queryByText("Não calculado")).not.toBeInTheDocument();
  });

  it("o aviso do campo é lido junto com a dica ao focar o campo", () => {
    render(
      <Field
        rotulo="Variação"
        dica="Reajuste aplicado sobre a base."
        aviso="Variação de 150% é incomum."
      >
        <Input />
      </Field>,
    );
    const campo = screen.getByLabelText("Variação");
    expect(campo).toHaveAccessibleDescription(
      "Reajuste aplicado sobre a base. Variação de 150% é incomum.",
    );
    expect(campo).not.toHaveAttribute("aria-invalid");
  });
});

function SecaoDeTeste() {
  const [aberta, setAberta] = useState(false);
  const [nome, setNome] = useState("Porto Seguro");
  return (
    <SecaoRecolhivel titulo="Seguro" resumo={nome} aberta={aberta} aoMudar={setAberta}>
      <label>
        Seguradora
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
    </SecaoRecolhivel>
  );
}

describe("#61 seções recolhíveis do cadastro", () => {
  it("abre e fecha pelo teclado, mostra o resumo e não perde o que foi digitado", async () => {
    const user = userEvent.setup();
    render(<SecaoDeTeste />);
    const botao = screen.getByRole("button", { name: /Seguro/ });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveAccessibleName(/Porto Seguro/);
    // Fechada: o campo existe mas não é alcançável.
    expect(screen.queryByRole("textbox", { name: "Seguradora" })).not.toBeInTheDocument();

    await user.tab();
    expect(botao).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(botao).toHaveAttribute("aria-expanded", "true");
    const campo = screen.getByRole("textbox", { name: "Seguradora" });
    await user.clear(campo);
    await user.type(campo, "Allianz");

    botao.focus();
    await user.keyboard(" ");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveAccessibleName(/Allianz/);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Seguradora" })).toHaveValue("Allianz");
  });
});

/** Mesmo arranjo do layout do sistema: menu do celular + <main> que recebe o foco + rotas reais. */
function montarApp(atrasoLoader: number) {
  let liberar: () => void = () => {};
  const raiz = createRootRoute({
    component: function Layout() {
      const caminho = useRouterState({ select: (s) => s.location.pathname });
      const carregando = useRouterState({ select: (s) => s.status === "pending" });
      return (
        <>
          <MenuMovel
            caminho={caminho}
            carregando={carregando}
            destinoFoco={() => document.getElementById("conteudo")}
          >
            {(aoNavegar) => (
              <nav aria-label="Menu principal">
                <Link to="/" onClick={aoNavegar}>
                  Painel
                </Link>
                <Link to="/atas" onClick={aoNavegar}>
                  Atas
                </Link>
              </nav>
            )}
          </MenuMovel>
          <main id="conteudo" tabIndex={-1}>
            <Outlet />
          </main>
        </>
      );
    },
  });
  const painel = createRoute({
    getParentRoute: () => raiz,
    path: "/",
    component: () => <h1>Painel</h1>,
  });
  const atas = createRoute({
    getParentRoute: () => raiz,
    path: "/atas",
    loader: () =>
      atrasoLoader === 0 ? null : new Promise<null>((ok) => (liberar = () => ok(null))),
    component: () => <h1>Atas</h1>,
  });
  const router = createRouter({
    routeTree: raiz.addChildren([painel, atas]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return { router, liberar: () => liberar() };
}

describe("#47 navegar pelo menu do celular com rotas de verdade", () => {
  it("troca a página (URL e título) e leva o foco ao conteúdo", async () => {
    const user = userEvent.setup();
    const { router } = montarApp(0);
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Painel" });

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const gaveta = await screen.findByRole("dialog", { name: "Menu" });
    await user.click(within(gaveta).getByRole("link", { name: "Atas" }));

    await screen.findByRole("heading", { name: "Atas" });
    expect(router.state.location.pathname).toBe("/atas");
    await waitFor(() => expect(document.getElementById("conteudo")).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("com a página demorando a carregar, o foco só vai para o conteúdo depois que ela aparece", async () => {
    const user = userEvent.setup();
    const { router, liberar } = montarApp(1);
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Painel" });

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const gaveta = await screen.findByRole("dialog", { name: "Menu" });
    await user.keyboard("{Tab}"); // primeiro item
    within(gaveta).getByRole("link", { name: "Atas" }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Ainda carregando: a página anterior continua na tela e o foco não foi para ela.
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(document.getElementById("conteudo")).not.toHaveFocus();

    await act(async () => liberar());
    await screen.findByRole("heading", { name: "Atas" });
    expect(router.state.location.pathname).toBe("/atas");
    await waitFor(() => expect(document.getElementById("conteudo")).toHaveFocus());
    // O destino do foco é o conteúdo da página NOVA (não a anterior nem o <body>).
    expect(document.activeElement).not.toBe(document.body);
    expect(document.getElementById("conteudo")).toContainElement(screen.getByRole("heading", { name: "Atas" }));
    expect(screen.queryByRole("heading", { name: "Painel" })).not.toBeInTheDocument();
  });
});
