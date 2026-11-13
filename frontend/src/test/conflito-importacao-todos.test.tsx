import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConflitoImportacaoDialog } from "@/components/importacao/ConflitoImportacao";
import type { ItemDivergenteImportacao } from "@/domain/types";

/** Três contas divergentes: o caso do print (77 itens) reduzido ao essencial. */
const itens: ItemDivergenteImportacao[] = [
  {
    secao: "saldoAnterior",
    nome: "Sicoob S/A - Conta corrente",
    ocorrencia: 0,
    valorAtual: 6723.04,
    valorNovo: 117178.28,
    diferencaPct: 1643.1,
  },
  {
    secao: "despesas",
    grupo: "Pessoal",
    nome: "Salários",
    ocorrencia: 0,
    valorAtual: null,
    valorNovo: 820.8,
    diferencaPct: null,
  },
  {
    secao: "receitas",
    nome: "Taxa de condomínio",
    ocorrencia: 0,
    valorAtual: 515174.99,
    valorNovo: 515174.99,
    diferencaPct: 0,
  },
];

describe("diálogo de divergências — decisão em bloco", () => {
  it("'Manter os gravados' decide todos os itens de uma vez e libera o botão final", async () => {
    const u = userEvent.setup();
    let recebidas: { escolha: "manter" | "atualizar" }[] = [];
    render(
      <ConflitoImportacaoDialog
        aberto
        itens={itens}
        aoConfirmar={(e) => {
          recebidas = e;
        }}
        aoCancelar={() => {}}
      />,
    );

    const confirmar = screen.getByRole("button", { name: "Confirmar e aplicar" });
    expect(confirmar).toBeDisabled();
    expect(screen.getByText("3 itens ainda precisam de decisão.")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Manter os gravados" }));

    expect(confirmar).toBeEnabled();
    expect(screen.getByText(/3 manter · 0 do PDF/)).toBeInTheDocument();

    await u.click(confirmar);
    expect(recebidas.map((i) => i.escolha)).toEqual(["manter", "manter", "manter"]);
  });

  it("'Usar todos do PDF' decide todos como atualizar", async () => {
    const u = userEvent.setup();
    let recebidas: { escolha: "manter" | "atualizar" }[] = [];
    render(
      <ConflitoImportacaoDialog
        aberto
        itens={itens}
        aoConfirmar={(e) => {
          recebidas = e;
        }}
        aoCancelar={() => {}}
      />,
    );

    await u.click(screen.getByRole("button", { name: "Usar todos do PDF" }));
    expect(screen.getByText(/0 manter · 3 do PDF/)).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Confirmar e aplicar" }));
    expect(recebidas.map((i) => i.escolha)).toEqual(["atualizar", "atualizar", "atualizar"]);
  });

  it("a decisão em bloco pode ser ajustada item a item depois", async () => {
    const u = userEvent.setup();
    let recebidas: { escolha: "manter" | "atualizar" }[] = [];
    render(
      <ConflitoImportacaoDialog
        aberto
        itens={itens}
        aoConfirmar={(e) => {
          recebidas = e;
        }}
        aoCancelar={() => {}}
      />,
    );

    await u.click(screen.getByRole("button", { name: "Manter os gravados" }));
    // Ajuste individual por cima do bloco: o terceiro item passa a usar o valor do PDF.
    expect(screen.getAllByRole("radiogroup")).toHaveLength(3);
    // Cada item tem 2 opções (manter/atualizar); a 6ª é o "atualizar" do último item.
    const opcoes = screen.getAllByRole("radio");
    await u.click(opcoes[5]!);
    expect(screen.getByText(/2 manter · 1 do PDF/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Confirmar e aplicar" }));
    expect(recebidas).toHaveLength(3);
  });
});
