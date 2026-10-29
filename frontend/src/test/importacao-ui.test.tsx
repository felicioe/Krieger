import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConferenciaPdf } from "@/components/importacao/ResumoImportacao";
import { DialogoDivergencia } from "@/components/importacao/DialogoDivergencia";
import { useTravaImportacao } from "@/components/importacao/useTravaImportacao";
import { marcarCriadoPorPdf } from "@/components/importacao/criadoPorPdf";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { mockApi } from "@/lib/mockApi";
import type { Demonstrativo } from "@/domain/types";

// ---------- Fixtures ----------

function demo(totais: {
  saldoAnterior?: number;
  receitas?: number;
  despesas?: number;
  saldoAtual?: number;
}): Demonstrativo {
  const d = demonstrativoVazio("Residencial Teste");
  return {
    ...d,
    saldoAnterior: { ...d.saldoAnterior, total: totais.saldoAnterior ?? 15000 },
    receitas: { ...d.receitas, subtotal: totais.receitas ?? 20500 },
    despesas: { ...d.despesas, subtotal: totais.despesas ?? 11000 },
    saldoAtual: { ...d.saldoAtual, total: totais.saldoAtual ?? 24500 },
  };
}

// ---------- #68: estados da conferência do PDF ----------

describe("conferência automática do PDF (#68)", () => {
  it("verificado mostra a cobertura e diz que não há diferenças", () => {
    render(
      <ConferenciaPdf
        conf={{ ok: true, mensagens: [], estado: "verificado", comparacoes: 4, esperadas: 4 }}
        layout="dre_simples"
      />,
    );
    expect(screen.getByText(/Conferência completa/)).toBeInTheDocument();
    expect(screen.getByText(/4 de 4 seções comparadas/)).toBeInTheDocument();
  });

  it("parcial mostra só o que foi comparado e pede conferência manual", () => {
    render(
      <ConferenciaPdf
        conf={{ ok: false, mensagens: [], estado: "parcial", comparacoes: 2, esperadas: 4 }}
        layout="dre_simples"
      />,
    );
    expect(screen.getByText(/Conferência parcial/)).toBeInTheDocument();
    expect(screen.getByText(/só 2 de 4 seções puderam ser comparadas/)).toBeInTheDocument();
    expect(screen.queryByText(/sem diferenças/)).not.toBeInTheDocument();
  });

  it("não verificado nunca afirma que os totais conferem", () => {
    render(
      <ConferenciaPdf
        conf={{ ok: false, mensagens: [], estado: "nao_verificado", comparacoes: 0, esperadas: 0 }}
        layout="comparativo"
      />,
    );
    expect(screen.getByText(/Totais não conferidos/)).toBeInTheDocument();
    expect(screen.queryByText(/sem diferenças|conferem/)).not.toBeInTheDocument();
  });

  it("divergente lista as diferenças com a cobertura em linhas no comparativo", () => {
    render(
      <ConferenciaPdf
        conf={{
          ok: false,
          mensagens: ['Receita "Taxa": soma dos meses R$ 10,00 × total R$ 11,00.'],
          estado: "divergente",
          comparacoes: 3,
          esperadas: 3,
        }}
        layout="comparativo"
      />,
    );
    expect(
      screen.getByText(/Conferência com diferenças \(3 de 3 linhas comparadas\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Receita "Taxa"/)).toBeInTheDocument();
  });

  it("sem o estado do domínio (contrato antigo) e sem mensagens, não afirma que conferem", () => {
    render(<ConferenciaPdf conf={{ ok: true, mensagens: [] }} layout="dre_simples" />);
    expect(screen.getByText(/Totais não conferidos/)).toBeInTheDocument();
    expect(screen.queryByText(/sem diferenças/)).not.toBeInTheDocument();
  });
});

// ---------- #70: trava de divergência no primeiro Salvar ----------

describe("trava de divergência da importação (#70)", () => {
  it("sem PDF importado, salva direto", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTravaImportacao("mensais", "m-sem", null));
    act(() => result.current.salvar(demo({ receitas: 1 }), gravar));
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(result.current.dialogo.aberto).toBe(false);
  });

  it("PDF importado sem mudança nos totais: salva direto e não confere de novo depois", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTravaImportacao("mensais", "m-igual", null));
    act(() => result.current.marcarImportado(demo({})));
    await act(async () => result.current.salvar(demo({}), gravar));
    expect(gravar).toHaveBeenCalledTimes(1);
    // Edição legítima depois de salvo: não alerta.
    await act(async () => result.current.salvar(demo({ receitas: 99999 }), gravar));
    expect(gravar).toHaveBeenCalledTimes(2);
    expect(result.current.dialogo.aberto).toBe(false);
  });

  it("total mudou: abre a confirmação sem gravar; confirmar grava e esquece a referência", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTravaImportacao("mensais", "m-mudou", null));
    act(() => result.current.marcarImportado(demo({})));
    act(() => result.current.salvar(demo({ receitas: 22500 }), gravar));
    expect(gravar).not.toHaveBeenCalled();
    expect(result.current.dialogo.aberto).toBe(true);
    expect(result.current.dialogo.pendente?.divergencias.map((d) => d.campo)).toEqual(["receitas"]);
    await act(async () => result.current.dialogo.aoConfirmar());
    expect(gravar).toHaveBeenCalledTimes(1);
    act(() => result.current.salvar(demo({ receitas: 30000 }), gravar));
    expect(gravar).toHaveBeenCalledTimes(2);
  });

  it("falha ao salvar mantém a referência do PDF", async () => {
    const gravar = vi.fn().mockRejectedValueOnce(new Error("falhou")).mockResolvedValue(undefined);
    const { result } = renderHook(() => useTravaImportacao("exercicios", "e-falha", null));
    act(() => result.current.marcarImportado(demo({})));
    act(() => result.current.salvar(demo({ despesas: 12000 }), gravar));
    await act(async () => {
      await expect(result.current.dialogo.aoConfirmar()).rejects.toThrow("falhou");
    });
    // Ainda confere no próximo Salvar.
    act(() => result.current.dialogo.aoMudar(false));
    act(() => result.current.salvar(demo({ despesas: 12000 }), gravar));
    expect(result.current.dialogo.aberto).toBe(true);
    expect(gravar).toHaveBeenCalledTimes(1);
  });

  it("falha no salvamento direto (sem mudança) também mantém a referência", async () => {
    const gravar = vi.fn().mockRejectedValueOnce(new Error("falhou")).mockResolvedValue(undefined);
    const { result } = renderHook(() => useTravaImportacao("mensais", "m-falha-direta", null));
    act(() => result.current.marcarImportado(demo({})));
    await act(async () => result.current.salvar(demo({}), gravar));
    act(() => result.current.salvar(demo({ saldoAtual: 1 }), gravar));
    expect(result.current.dialogo.aberto).toBe(true);
  });

  it("registro recém-criado por PDF confere no primeiro Salvar; aberto depois, não", () => {
    marcarCriadoPorPdf("mensais", "m-criado");
    const gravar = vi.fn().mockResolvedValue(undefined);
    const primeiro = renderHook(() => useTravaImportacao("mensais", "m-criado", demo({})));
    act(() => primeiro.result.current.salvar(demo({ receitas: 1 }), gravar));
    expect(primeiro.result.current.dialogo.aberto).toBe(true);
    primeiro.unmount();
    const depois = renderHook(() => useTravaImportacao("mensais", "m-criado", demo({})));
    act(() => depois.result.current.salvar(demo({ receitas: 1 }), gravar));
    expect(depois.result.current.dialogo.aberto).toBe(false);
    expect(gravar).toHaveBeenCalledTimes(1);
  });

  it("a confirmação mostra os quatro totais, com 'sem mudança' e o caso de PDF zerado", () => {
    render(
      <DialogoDivergencia
        aberto
        aoMudar={() => {}}
        aoConfirmar={async () => {}}
        pendente={{
          importado: demo({ saldoAnterior: 0 }),
          atual: demo({ saldoAnterior: 500, receitas: 22550 }),
          divergencias: [
            {
              campo: "saldoAnterior",
              rotulo: "Saldo anterior",
              importado: 0,
              atual: 500,
              diferencaPct: null,
            },
            {
              campo: "receitas",
              rotulo: "Receitas",
              importado: 20500,
              atual: 22550,
              diferencaPct: 10,
            },
          ],
        }}
      />,
    );
    const tabela = screen.getByRole("table", { hidden: true });
    expect(tabela.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(tabela).toHaveTextContent("mudou (no PDF era zero)");
    expect(tabela).toHaveTextContent("+10,0%");
    expect(tabela).toHaveTextContent("sem mudança");
    expect(screen.getByRole("button", { name: "Voltar e revisar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar e salvar" })).toBeInTheDocument();
  });
});

// ---------- #69: confirmação única e idempotente (adaptador do preview) ----------

describe("confirmar importação numa chamada só (#69)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await mockApi.auth.entrar("admin", "admin123");
  });

  async function pendente(id: string) {
    await mockApi.salvar("importacoes", {
      id,
      status: "pendente",
      arquivo: "x.pdf",
      importadoEm: new Date().toISOString(),
      cadastro: { codigo: "9", nome: "Novo", cnpj: null, contas: [], revisar: true },
      condominioId: null,
      destino: "mensais",
    });
  }
  const pedido = (importacaoId: string, condominio: Record<string, unknown>) => ({
    importacaoId,
    destino: "mensais" as const,
    condominio: condominio as never,
    registro: { id: "reg-1", condoId: "cond-novo", condoNome: "Novo" } as never,
    cadastro: { codigo: "9", nome: "Novo", cnpj: null },
  });

  it("cria condomínio, registro e confirma a importação com uma única gravação; repetir não duplica", async () => {
    await pendente("imp-1");
    const espia = vi.spyOn(Storage.prototype, "setItem");
    const r = await mockApi.confirmarImportacao(pedido("imp-1", { id: "cond-novo", nome: "Novo" }));
    const gravacoes = espia.mock.calls.filter(([k]) => k === "krieger-mock-dados-v1").length;
    espia.mockRestore();
    expect(gravacoes).toBe(1);
    expect(r).toMatchObject({
      condominioId: "cond-novo",
      criouCondominio: true,
      reutilizado: false,
    });

    const de_novo = await mockApi.confirmarImportacao(
      pedido("imp-1", { id: "cond-novo", nome: "Novo" }),
    );
    expect(de_novo.reutilizado).toBe(true);
    expect(de_novo.registro.id).toBe("reg-1");
    expect(
      (await mockApi.listar<{ id: string }>("mensais")).filter((m) => m.id === "reg-1"),
    ).toHaveLength(1);
    expect(
      (await mockApi.listar<{ id: string }>("condominios")).filter((c) => c.id === "cond-novo"),
    ).toHaveLength(1);
    const imp = await mockApi.obter<{ status: string; registroId: string }>("importacoes", "imp-1");
    expect(imp).toMatchObject({ status: "confirmado", registroId: "reg-1" });
  });

  it("erro não grava nada pela metade", async () => {
    await pendente("imp-2");
    const antes = await mockApi.listar("condominios");
    await expect(mockApi.confirmarImportacao(pedido("imp-2", { id: "cond-novo" }))).rejects.toThrow(
      "Condomínio não encontrado.",
    );
    expect(await mockApi.listar("condominios")).toHaveLength(antes.length);
    expect((await mockApi.listar<{ id: string }>("mensais")).some((m) => m.id === "reg-1")).toBe(
      false,
    );
    expect(await mockApi.obter("importacoes", "imp-2")).toMatchObject({ status: "pendente" });
  });

  it("importação descartada não pode ser confirmada", async () => {
    await pendente("imp-3");
    const imp = await mockApi.obter<Record<string, unknown>>("importacoes", "imp-3");
    await mockApi.salvar("importacoes", { ...imp!, id: "imp-3", status: "descartado" });
    await expect(
      mockApi.confirmarImportacao(pedido("imp-3", { id: "cond-novo", nome: "Novo" })),
    ).rejects.toThrow(/descartada/);
  });

  it("condomínio existente: camposComplementares só preenche o que está em branco, nunca sobrescreve", async () => {
    await mockApi.salvar("condominios", { id: "cond-existente", codigo: "", nome: "Já Cadastrado", cnpj: "" });
    await pendente("imp-4");
    const r = await mockApi.confirmarImportacao({
      ...pedido("imp-4", {
        id: "cond-existente",
        camposComplementares: { codigo: "123", nome: "Outro Nome (não deve substituir)", cnpj: "12.345.678/0001-90" },
      }),
      registro: { id: "reg-4", condoId: "cond-existente", condoNome: "Já Cadastrado" } as never,
    });
    expect(r).toMatchObject({ criouCondominio: false, atualizouCadastro: true });
    const salvo = (await mockApi.listar<{ id: string; codigo: string; nome: string; cnpj: string }>("condominios")).find((c) => c.id === "cond-existente")!;
    expect(salvo.nome).toBe("Já Cadastrado");
    expect(salvo.codigo).toBe("123");
    expect(salvo.cnpj).toBe("12.345.678/0001-90");
  });

  it("condomínio existente sem camposComplementares: não mexe no cadastro", async () => {
    await mockApi.salvar("condominios", { id: "cond-existente-2", codigo: "", nome: "Outro Já Cadastrado", cnpj: "" });
    await pendente("imp-5");
    const r = await mockApi.confirmarImportacao({
      ...pedido("imp-5", { id: "cond-existente-2" }),
      registro: { id: "reg-5", condoId: "cond-existente-2", condoNome: "Outro Já Cadastrado" } as never,
    });
    expect(r).toMatchObject({ criouCondominio: false, atualizouCadastro: false });
    const salvo = (await mockApi.listar<{ id: string; codigo: string }>("condominios")).find((c) => c.id === "cond-existente-2")!;
    expect(salvo.codigo).toBe("");
  });

  it("condomínio restaurado de backup sem código/CNPJ (não só vazio): completa sem lançar", async () => {
    // api.php só exige id+nome no backup; código/CNPJ podem faltar de verdade, não só vir vazios.
    await mockApi.salvar("condominios", { id: "cond-sem-campos", nome: "Sem Campos" } as never);
    await pendente("imp-6");
    const r = await mockApi.confirmarImportacao({
      ...pedido("imp-6", { id: "cond-sem-campos", camposComplementares: { codigo: "456", nome: null, cnpj: "99.999.999/0001-99" } }),
      registro: { id: "reg-6", condoId: "cond-sem-campos", condoNome: "Sem Campos" } as never,
    });
    expect(r).toMatchObject({ criouCondominio: false, atualizouCadastro: true });
    const salvo = (await mockApi.listar<{ id: string; codigo: string; nome: string; cnpj: string }>("condominios")).find((c) => c.id === "cond-sem-campos")!;
    expect(salvo.nome).toBe("Sem Campos");
    expect(salvo.codigo).toBe("456");
    expect(salvo.cnpj).toBe("99.999.999/0001-99");
  });

  it("salvar condomínio com código já existente reaproveita o id e não duplica o cadastro", async () => {
    await mockApi.salvar("condominios", {
      id: "cond-notre-dame-1",
      codigo: "006",
      nome: "Residencial Notre Dame",
      cnpj: "00.356.681/0001-25",
    });
    const res2 = await mockApi.salvar("condominios", {
      id: "cond-notre-dame-2-duplicado",
      codigo: "6",
      nome: "CONDOMINIO RESIDENCIAL NOTRE DAME",
      cnpj: "00.356.681/0001-25",
    });
    expect(res2.id).toBe("cond-notre-dame-1");
    const lista = (await mockApi.listar<{ id: string; codigo: string; nome: string }>("condominios")).filter(
      (c) => c.codigo === "006" || c.codigo === "6",
    );
    expect(lista).toHaveLength(1);
    expect(lista[0]!.id).toBe("cond-notre-dame-1");
    expect(lista[0]!.nome).toBe("CONDOMINIO RESIDENCIAL NOTRE DAME");
  });

  it("manutencao.limpar apaga condomínios individualmente ou todos os cadastros operacionais", async () => {
    const antes = await mockApi.manutencao.contagens();
    expect(antes.condominios).toBeGreaterThan(0);

    const rCondo = await mockApi.manutencao.limpar("condominios");
    expect(rCondo.ok).toBe(true);
    expect(rCondo.apagados).toBe(antes.condominios);
    expect((await mockApi.manutencao.contagens()).condominios).toBe(0);

    const rTudo = await mockApi.manutencao.limpar("tudo");
    expect(rTudo.ok).toBe(true);
    const depois = await mockApi.manutencao.contagens();
    expect(depois.condominios).toBe(0);
    expect(depois.exercicios).toBe(0);
    expect(depois.mensais).toBe(0);
    expect(depois.assembleias).toBe(0);
    expect(depois.atas).toBe(0);
  });
});

// ---------- #71: foco volta ao "Importar PDF" ----------

const leitura = vi.hoisted(() => ({ texto: "" as string | Error }));
vi.mock("@/lib/pdfTexto", () => ({
  extrairTextoPdf: async () => {
    if (leitura.texto instanceof Error) throw leitura.texto;
    return leitura.texto;
  },
}));

const TEXTO_OK = [
  "Condomínio: (73) - Estrelas do Mar - CNPJ: 12.345.678/0001-90",
  "Demonstrativo de Receitas e Despesas - Período de 01/08/2026 a 31/08/2026",
  "(+) RECEITAS",
  "    Taxa condominial".padEnd(31) + "20.000,00",
  "".padEnd(31) + "20.000,00",
].join("\n");

describe("foco depois da janela de importação (#71)", () => {
  function montar() {
    render(
      <ImportarPdf
        modo="editor"
        destino="mensais"
        condominio={undefined}
        nomeCondominio="Estrelas"
        aoAplicar={() => {}}
      />,
    );
    return screen.getByRole("button", { name: "Importar PDF" });
  }
  const arquivo = () => new File(["%PDF"], "relatorio.pdf", { type: "application/pdf" });

  it.each([
    [
      "Cancelar",
      async (u: ReturnType<typeof userEvent.setup>) =>
        u.click(await screen.findByRole("button", { name: "Cancelar" })),
    ],
    [
      "Escape",
      async (u: ReturnType<typeof userEvent.setup>) => {
        await screen.findByRole("button", { name: "Cancelar" });
        await u.keyboard("{Escape}");
      },
    ],
  ])("depois de ler o PDF, %s devolve o foco ao botão", async (_nome, fechar) => {
    leitura.texto = TEXTO_OK;
    const u = userEvent.setup();
    const botao = montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do relatório"), arquivo());
    await fechar(u);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(botao).toHaveFocus());
  });

  it("depois de um erro de leitura, Fechar devolve o foco ao botão", async () => {
    leitura.texto = new Error("Arquivo corrompido");
    const u = userEvent.setup();
    const botao = montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do relatório"), arquivo());
    // Botão "Fechar" do rodapé (o primeiro); o "X" do canto também se chama Fechar.
    await u.click((await screen.findAllByRole("button", { name: "Fechar" }))[0]!);
    await waitFor(() => expect(botao).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("o X (Fechar) do canto também devolve o foco ao botão", async () => {
    leitura.texto = TEXTO_OK;
    const u = userEvent.setup();
    const botao = montar();
    await u.upload(screen.getByLabelText("Arquivo PDF do relatório"), arquivo());
    await screen.findByRole("button", { name: "Cancelar" });
    await u.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(botao).toHaveFocus());
  });
});
