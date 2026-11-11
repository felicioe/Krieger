import { beforeEach, describe, expect, it, vi } from "vitest";
import { baixarMatrizXlsx } from "@/lib/exportar";

const escreverXlsx = vi.fn();
const salvarArquivo = vi.fn();

vi.mock("write-excel-file/browser", () => ({ default: escreverXlsx }));

describe("exportação XLSX", () => {
  beforeEach(() => {
    escreverXlsx.mockReset();
    salvarArquivo.mockReset();
  });

  it("preserva texto e números e limita o nome da aba", async () => {
    salvarArquivo.mockResolvedValue(undefined);
    escreverXlsx.mockReturnValue({ toFile: salvarArquivo });

    await baixarMatrizXlsx(
      "relatório: anual",
      "Uma aba com nome maior que trinta e um caracteres",
      [
        ["Conta", "Valor"],
        ["Energia", 123.45],
      ],
    );

    expect(escreverXlsx).toHaveBeenCalledWith(
      [
        [{ value: "Conta" }, { value: "Valor" }],
        [{ value: "Energia" }, { value: 123.45 }],
      ],
      { sheet: "Uma aba com nome maior que trin" },
    );
    expect(salvarArquivo).toHaveBeenCalledWith("relatório- anual.xlsx");
  });
});
