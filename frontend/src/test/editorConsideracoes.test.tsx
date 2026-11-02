import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorConsideracoes } from "@/components/relatorio/EditorConsideracoes";
import type { ConsumoServico } from "@/domain/relatorioFinal";
import { considDoCondominio } from "@/domain/exercicio";
import { condominioPadrao } from "@/domain/condominio";

const leitura = vi.hoisted(() => ({ texto: "", espera: Promise.resolve() }));
vi.mock("@/lib/pdfTexto", () => ({
  extrairTextoPdf: async () => {
    await leitura.espera;
    return leitura.texto;
  },
}));

// Estrutura real do layout Allianz (ver domain/pdfParser.ts), dados fictícios.
const APOLICE = [
  "  APÓLICE",
  "  SEGURO           CONDOMÍNIO",
  "     Seguradora Exemplar",
  "                                             Nº. da Apólice: 999888777M1X000011",
  "    Agradecemos por escolher a Seguradora Exemplar.",
  "  Nome: CONDOMÍNIO JARDIM TESTE                            CNPJ: 12.345.678/0001-99",
  "  Limite Máximo de Garantia da Apólice: R$ 5.000.000,00     Versão da tabela: 1/1",
  "  Vigência: das 24H de 15/03/2025 às 24H de 15/03/2026      Valor de Novo: Sim",
  "14 COBERTURAS                              Limite Máximo       Preço por",
  "   Básica Simples                         R$  5.000.000,00   R$      200,00         Sem Franquia",
  "   Danos Elétricos                        R$     30.000,00   R$    1.500,00   20        3.000,00",
  "   Vendaval / Ciclone / Tornado / Granizo R$      45.000,00  R$      600,00   20        2.000,00",
].join("\n");

const CONSUMO_VAZIO: ConsumoServico = { valor: 0, manual: false, rubricas: [], automatico: { valor: 0, rubricas: [] } };

function renderEditor() {
  const consid = considDoCondominio({ ...condominioPadrao(), id: "c1" });
  const onChange = vi.fn();
  const utils = render(
    <EditorConsideracoes
      consid={consid}
      onChange={onChange}
      condominio={null}
      receberMensais={null}
      agua={CONSUMO_VAZIO}
      energia={CONSUMO_VAZIO}
      elevador={CONSUMO_VAZIO}
    />,
  );
  const rerenderComConsid = (c: Parameters<typeof EditorConsideracoes>[0]["consid"]) =>
    utils.rerender(
      <EditorConsideracoes
        consid={c}
        onChange={onChange}
        condominio={null}
        receberMensais={null}
        agua={CONSUMO_VAZIO}
        energia={CONSUMO_VAZIO}
        elevador={CONSUMO_VAZIO}
      />,
    );
  return { onChange, consid, rerenderComConsid };
}

describe("EditorConsideracoes — importar apólice (PDF)", () => {
  it("preenche seguradora, vigência, risco absoluto e coberturas a partir do PDF", async () => {
    leitura.texto = APOLICE;
    const { onChange } = renderEditor();

    const arquivo = new File(["x"], "apolice.pdf", { type: "application/pdf" });
    const entrada = screen.getByLabelText("Arquivo PDF da apólice de seguro");
    await userEvent.upload(entrada, arquivo);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const novo = onChange.mock.calls.at(-1)![0];
    expect(novo.seguradora).toBe("Seguradora Exemplar");
    expect(novo.vigenciaSeguro).toBe("15/03/2026");
    expect(novo.seguro.riscoAbsoluto).toBe(5000000);
    expect(novo.seguro.coberturas).toEqual([
      { desc: "Danos Elétricos", valor: 30000 },
      { desc: "Vendaval / Ciclone / Tornado / Granizo", valor: 45000 },
    ]);
  });

  it("edição em outro campo durante a importação não é perdida (achado do Codex no PR #109)", async () => {
    leitura.texto = APOLICE;
    let liberar: () => void = () => {};
    leitura.espera = new Promise((res) => {
      liberar = res;
    });
    const { onChange, consid, rerenderComConsid } = renderEditor();

    const arquivo = new File(["x"], "apolice.pdf", { type: "application/pdf" });
    const entrada = screen.getByLabelText("Arquivo PDF da apólice de seguro");
    await userEvent.upload(entrada, arquivo); // dispara a importação; fica pendente em leitura.espera

    // Enquanto o PDF ainda está sendo lido, o usuário edita outro campo (ex.: vistoria) — o pai
    // (dono do estado) re-renderiza o editor com o consid já atualizado.
    const comVistoria = { ...consid, vistoriaLei: "Lei Municipal 123/2026" };
    rerenderComConsid(comVistoria);

    liberar();
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const novo = onChange.mock.calls.at(-1)![0];
    expect(novo.vistoriaLei).toBe("Lei Municipal 123/2026"); // não foi perdida
    expect(novo.seguradora).toBe("Seguradora Exemplar"); // e a apólice foi aplicada mesmo assim
  });

  it("PDF de outro layout: não altera os campos", async () => {
    leitura.texto = "DEMONSTRATIVO GERAL ENCERRADO EM 31/10/2026\nCONSIDERAÇÕES FINAIS";
    const { onChange } = renderEditor();

    const arquivo = new File(["x"], "outro.pdf", { type: "application/pdf" });
    const entrada = screen.getByLabelText("Arquivo PDF da apólice de seguro");
    await userEvent.upload(entrada, arquivo);

    await waitFor(() => expect(screen.getByRole("button", { name: /importar apólice/i })).not.toBeDisabled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
