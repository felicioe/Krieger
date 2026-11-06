import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/app/DataTable";
import { Field } from "@/components/app/Field";
import { Selecao, SelecaoBusca } from "@/components/app/inputs";
import { MenuMovel } from "@/components/app/MenuMovel";
import { RepeatableList } from "@/components/app/RepeatableList";

type Condo = { id: string; nome: string; codigo: string };
const CONDOS: Condo[] = [
  { id: "c1", nome: "Residencial Acácias", codigo: "001" },
  { id: "c2", nome: "Edifício Ipê", codigo: "002" },
];

function Tabela({ aoClicar, aoEditar }: { aoClicar: (c: Condo) => void; aoEditar?: () => void }) {
  return (
    <DataTable<Condo>
      colunas={[
        { chave: "codigo", titulo: "Código" },
        { chave: "nome", titulo: "Nome" },
        {
          chave: "acoes",
          titulo: "",
          render: (c) => (
            <button type="button" onClick={aoEditar}>
              Editar {c.nome}
            </button>
          ),
        },
      ]}
      dados={CONDOS}
      chaveLinha={(c) => c.id}
      aoClicar={aoClicar}
      colunaAcao="nome"
      rotuloAcao={(c) => `Abrir condomínio ${c.nome}`}
    />
  );
}

describe("#30 DataTable: abrir registro pelo teclado", () => {
  it("Tab alcança a ação da linha e Enter abre o registro correto", async () => {
    const user = userEvent.setup();
    const aoClicar = vi.fn();
    render(<Tabela aoClicar={aoClicar} />);

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Abrir condomínio Residencial Acácias" }),
    ).toHaveFocus();
    await user.tab(); // botão interno "Editar" da 1ª linha
    await user.tab();
    expect(screen.getByRole("button", { name: "Abrir condomínio Edifício Ipê" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(aoClicar).toHaveBeenCalledWith(CONDOS[1]);
  });

  it("Espaço também abre o registro", async () => {
    const user = userEvent.setup();
    const aoClicar = vi.fn();
    render(<Tabela aoClicar={aoClicar} />);
    screen.getByRole("button", { name: "Abrir condomínio Residencial Acácias" }).focus();
    await user.keyboard(" ");
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(aoClicar).toHaveBeenCalledWith(CONDOS[0]);
  });

  it("clicar no botão da linha abre uma vez só (sem navegação dupla)", async () => {
    const user = userEvent.setup();
    const aoClicar = vi.fn();
    render(<Tabela aoClicar={aoClicar} />);
    await user.click(screen.getByRole("button", { name: "Abrir condomínio Residencial Acácias" }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it("clicar em outra célula da linha continua abrindo o registro com o mouse", async () => {
    const user = userEvent.setup();
    const aoClicar = vi.fn();
    render(<Tabela aoClicar={aoClicar} />);
    await user.click(screen.getByText("002"));
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(aoClicar).toHaveBeenCalledWith(CONDOS[1]);
  });

  it("controle interno da linha não abre o registro", async () => {
    const user = userEvent.setup();
    const aoClicar = vi.fn();
    const aoEditar = vi.fn();
    render(<Tabela aoClicar={aoClicar} aoEditar={aoEditar} />);
    await user.click(screen.getByRole("button", { name: "Editar Edifício Ipê" }));
    expect(aoEditar).toHaveBeenCalledTimes(1);
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("sem aoClicar a tabela não cria botões de abrir", () => {
    render(
      <DataTable<Condo>
        colunas={[{ chave: "nome", titulo: "Nome" }]}
        dados={CONDOS}
        chaveLinha={(c) => c.id}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("#31 Field: dica, erro e obrigatoriedade ligadas ao campo", () => {
  it("liga a dica ao campo por aria-describedby e expõe a obrigatoriedade", () => {
    render(
      <Field rotulo="Nova senha" obrigatorio dica="Mínimo de 8 caracteres.">
        <Input type="password" />
      </Field>,
    );
    const campo = screen.getByLabelText(/Nova senha/);
    // O asterisco é só visual: o nome acessível fica limpo e a obrigatoriedade vai por aria-required.
    expect(campo).toHaveAccessibleName("Nova senha");
    expect(campo).toHaveAccessibleDescription("Mínimo de 8 caracteres.");
    expect(campo).toHaveAttribute("aria-required", "true");
    expect(campo).not.toHaveAttribute("aria-invalid");
  });

  it("com erro, descreve o campo pelo erro e marca aria-invalid", () => {
    render(
      <Field rotulo="Senha atual" dica="Dica" erro="Informe a senha atual.">
        <Input />
      </Field>,
    );
    const campo = screen.getByLabelText("Senha atual");
    expect(campo).toHaveAccessibleDescription("Informe a senha atual.");
    expect(campo).toHaveAttribute("aria-invalid", "true");
  });

  it("cada campo tem ids próprios para dica e erro", () => {
    render(
      <>
        <Field rotulo="A" dica="Dica A">
          <Input />
        </Field>
        <Field rotulo="B" dica="Dica B">
          <Input />
        </Field>
      </>,
    );
    const a = screen.getByLabelText("A").getAttribute("aria-describedby");
    const b = screen.getByLabelText("B").getAttribute("aria-describedby");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    expect(screen.getByLabelText("A")).toHaveAccessibleDescription("Dica A");
    expect(screen.getByLabelText("B")).toHaveAccessibleDescription("Dica B");
  });

  it("sem obrigatório, não marca aria-required", () => {
    render(
      <Field rotulo="Observação">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Observação")).not.toHaveAttribute("aria-required");
  });

  it("Selecao recebe rótulo, dica, erro e obrigatoriedade no botão da lista", () => {
    render(
      <Field rotulo="Perfil" obrigatorio erro="Escolha o perfil.">
        <Selecao
          value=""
          onChange={() => undefined}
          opcoes={[
            { valor: "admin", rotulo: "Administrador" },
            { valor: "usuario", rotulo: "Usuário" },
          ]}
        />
      </Field>,
    );
    const trigger = screen.getByRole("combobox", { name: "Perfil" });
    expect(trigger).toHaveAccessibleDescription("Escolha o perfil.");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-required", "true");
  });

  it("SelecaoBusca filtra inline por nome sem acento, código ou CNPJ e repassa acessibilidade do Field", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(
      <Field rotulo="Condomínio" obrigatorio dica="Pesquise pelo nome.">
        <SelecaoBusca
          value="c1"
          onChange={aoMudar}
          opcoes={[
            { valor: "c1", rotulo: "COND. ED. PAOLA GABRIELA", detalhe: "006", busca: "006 COND. ED. PAOLA GABRIELA 00.356.681/0001-25" },
            { valor: "c2", rotulo: "CONDOMÍNIO CALEDÔNIA", detalhe: "042", busca: "042 CONDOMÍNIO CALEDÔNIA 76.706.944/0001-40" },
          ]}
        />
      </Field>,
    );
    const trigger = screen.getByRole("combobox", { name: "Condomínio" });
    expect(trigger).toHaveAccessibleDescription("Pesquise pelo nome.");
    expect(trigger).toHaveAttribute("aria-required", "true");

    await user.click(trigger);
    const campoBusca = await screen.findByPlaceholderText(/Pesquisar por nome/i);
    await user.type(campoBusca, "caledonia");
    const opcoes = screen.getAllByRole("option");
    expect(opcoes).toHaveLength(1);
    expect(opcoes[0]).toHaveTextContent("CONDOMÍNIO CALEDÔNIA");

    await user.click(opcoes[0]!);
    expect(aoMudar).toHaveBeenCalledWith("c2");
  });
});

function MenuDeTeste() {
  return (
    <>
      <MenuMovel destinoFoco={() => document.getElementById("conteudo-teste")}>
        {(aoNavegar) => (
          <nav aria-label="Menu principal">
            <button type="button" onClick={aoNavegar}>
              Condomínios
            </button>
          </nav>
        )}
      </MenuMovel>
      <main id="conteudo-teste" tabIndex={-1}>
        Conteúdo
      </main>
    </>
  );
}

describe("#47 Menu do celular: teclado e retorno do foco", () => {
  it("Enter abre, Escape fecha e o foco volta ao Abrir menu", async () => {
    const user = userEvent.setup();
    render(<MenuDeTeste />);
    const abrir = screen.getByRole("button", { name: "Abrir menu" });

    await user.tab();
    expect(abrir).toHaveFocus();
    await user.keyboard("{Enter}");
    const gaveta = await screen.findByRole("dialog", { name: "Menu" });
    expect(gaveta).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("Espaço abre e o botão Fechar (em português) fecha devolvendo o foco", async () => {
    const user = userEvent.setup();
    render(<MenuDeTeste />);
    const abrir = screen.getByRole("button", { name: "Abrir menu" });
    abrir.focus();
    await user.keyboard(" ");
    const gaveta = await screen.findByRole("dialog", { name: "Menu" });

    await user.click(within(gaveta).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("escolher um destino no menu leva o foco ao conteúdo da página", async () => {
    const user = userEvent.setup();
    render(<MenuDeTeste />);
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const gaveta = await screen.findByRole("dialog", { name: "Menu" });

    await user.click(within(gaveta).getByRole("button", { name: "Condomínios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementById("conteudo-teste")).toHaveFocus();
  });
});

function ListaDeTeste({ inicial, reordenavel = true }: { inicial: string[]; reordenavel?: boolean }) {
  const [itens, setItens] = useState(inicial.map((texto) => ({ texto })));
  return (
    <>
      <RepeatableList<{ texto: string }>
        itens={itens}
        onChange={setItens}
        novo={() => ({ texto: "" })}
        reordenavel={reordenavel}
        render={(it, up, i) => (
          <input aria-label={`Texto ${i + 1}`} value={it.texto} onChange={(e) => up({ texto: e.target.value })} />
        )}
      />
      <output data-testid="ordem">{itens.map((i) => i.texto).join(",")}</output>
    </>
  );
}

describe("RepeatableList: reordenar pela alça sem mouse", () => {
  it("Tab chega na alça e a seta para baixo troca a linha de posição, mantendo o foco nela", async () => {
    const user = userEvent.setup();
    render(<ListaDeTeste inicial={["A", "B", "C"]} />);

    await user.tab(); // campo da linha 1
    await user.tab();
    const alca = screen.getByRole("button", { name: "Reordenar linha 1" });
    expect(alca).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("ordem")).toHaveTextContent("B,A,C");
    expect(screen.getByRole("button", { name: "Reordenar linha 2" })).toHaveFocus();
    expect(screen.getByLabelText("Texto 2")).toHaveValue("A");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("ordem")).toHaveTextContent("B,C,A");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByTestId("ordem")).toHaveTextContent("A,B,C");
    expect(screen.getByRole("button", { name: "Reordenar linha 1" })).toHaveFocus();
  });

  it("nas pontas a seta não move e avisa o leitor de tela", async () => {
    const user = userEvent.setup();
    render(<ListaDeTeste inicial={["A", "B"]} />);
    screen.getByRole("button", { name: "Reordenar linha 1" }).focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId("ordem")).toHaveTextContent("A,B");
    expect(screen.getByText("A linha já é a primeira.")).toBeInTheDocument();
  });

  it("a alça tem instruções de teclado em português e lista não reordenável não mostra alça", () => {
    const { unmount } = render(<ListaDeTeste inicial={["A", "B"]} />);
    const alca = screen.getByRole("button", { name: "Reordenar linha 1" });
    expect(alca).toHaveAccessibleDescription(/setas para cima e para baixo/);
    unmount();

    render(<ListaDeTeste inicial={["A", "B"]} reordenavel={false} />);
    expect(screen.queryByRole("button", { name: /Reordenar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover linha 1" })).toBeInTheDocument();
  });
});
