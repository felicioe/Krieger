import { describe, expect, it } from "vitest";
import { classificarArquivo } from "../src/filtro.js";

describe("classificarArquivo", () => {
  it("reconhece convenção, acentuada ou não, e ignora caixa", () => {
    expect(classificarArquivo("Convenção Condominial.pdf")).toBe("convencao");
    expect(classificarArquivo("CONVENCAO-2010.pdf")).toBe("convencao");
  });

  it("reconhece regimento interno", () => {
    expect(classificarArquivo("Regimento Interno - versão final.pdf")).toBe("regimento");
  });

  it("reconhece atas e assembleias, no singular e no plural", () => {
    expect(classificarArquivo("Ata AGO 2024.pdf")).toBe("ata");
    expect(classificarArquivo("atas-assembleias-2020-2023.pdf")).toBe("ata");
    expect(classificarArquivo("Assembleia Geral Extraordinária 03-2022.pdf")).toBe("ata");
  });

  it("ignora arquivos que não batem com nenhum padrão", () => {
    expect(classificarArquivo("Balancete Janeiro 2024.pdf")).toBeNull();
    expect(classificarArquivo("Nota Fiscal 12345.pdf")).toBeNull();
  });

  it("ignora arquivos que não são PDF mesmo que o nome bata", () => {
    expect(classificarArquivo("convencao.docx")).toBeNull();
    expect(classificarArquivo("ata-reuniao.jpg")).toBeNull();
  });
});
