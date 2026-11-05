import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportarApolice } from "@/components/importacao/ImportarApolice";
import { ImportarFracao } from "@/components/importacao/ImportarFracao";
import { condominioPadrao } from "@/domain/condominio";

const { salvar, sucesso, falha } = vi.hoisted(() => ({
  salvar: vi.fn(),
  sucesso: vi.fn(),
  falha: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: { salvar },
  mensagemErro: (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado."),
}));
vi.mock("sonner", () => ({ toast: { success: sucesso, error: falha } }));
vi.mock("@/lib/pdfTexto", () => ({ extrairTextoPdf: vi.fn(async () => "PDF fictício") }));
vi.mock("@/domain/pdfParser", () => ({
  lerApoliceSeguro: () => ({
    seguradora: "Seguradora de teste",
    numeroApolice: "123",
    vigenciaIni: "01/01/2026",
    vigenciaFim: "31/12/2026",
    riscoAbsoluto: 1000,
    coberturas: [],
  }),
  lerListagemFracao: () => ({
    condominio: "Acácias",
    total: 100,
    unidades: [
      { unidade: "001", fracaoUnidade: 100, fracaoBox: 0, fracaoTotal: 100, fracaoPrevista: 100 },
    ],
  }),
}));

beforeEach(() => {
  salvar.mockReset();
  sucesso.mockClear();
  falha.mockClear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("#228 recuperação da aplicação de dados importados", () => {
  it.each(["apolice", "fracao"] as const)(
    "%s impede repetição, preserva prévia no erro e permite tentar novamente",
    async (tipo) => {
      const user = userEvent.setup();
      const c = { ...condominioPadrao(), id: "c1", nome: "Acácias" };
      const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { container } = render(
        <QueryClientProvider client={consulta}>
          {tipo === "apolice" ? (
            <ImportarApolice condominios={[c]} />
          ) : (
            <ImportarFracao condominios={[c]} />
          )}
        </QueryClientProvider>,
      );
      const arquivo = container.querySelector<HTMLInputElement>('input[type="file"]')!;
      fireEvent.change(arquivo, {
        target: { files: [new File(["PDF fictício"], "exemplo.pdf", { type: "application/pdf" })] },
      });
      const destino = await screen.findByRole("combobox", { name: "Cadastro de destino" });
      await user.click(destino);
      await user.click(screen.getByRole("option", { name: "Acácias" }));

      let rejeitar!: (erro: Error) => void;
      salvar.mockImplementationOnce(
        () =>
          new Promise((_resolver, rejeicao) => {
            rejeitar = rejeicao;
          }),
      );
      const botao = screen.getByRole("button", {
        name: tipo === "apolice" ? "Aplicar ao cadastro" : "Aplicar no cadastro",
      });
      await user.click(botao);
      expect(salvar).toHaveBeenCalledTimes(1);
      expect(botao).toBeDisabled();
      expect(destino).toBeDisabled();
      await user.click(botao);
      expect(salvar).toHaveBeenCalledTimes(1);

      await act(async () => {
        rejeitar(new Error("Sem conexão."));
      });
      expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão.");
      expect(falha).toHaveBeenCalledTimes(1);
      expect(botao).toBeEnabled();
      expect(destino).toHaveTextContent("Acácias");

      salvar.mockResolvedValueOnce(c);
      await user.click(botao);
      await waitFor(() => expect(salvar).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /Aplicar (ao|no) cadastro/ })).toBeNull(),
      );
      expect(sucesso).toHaveBeenCalledWith(
        tipo === "apolice"
          ? "Dados da apólice aplicados ao cadastro do condomínio."
          : "Unidades e frações importadas no cadastro.",
      );
    },
  );
});
