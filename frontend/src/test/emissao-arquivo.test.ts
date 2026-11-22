import { describe, expect, it, vi } from "vitest";
import type { Documento } from "@/lib/documento/tipos";

// Falha simulada na biblioteca de PDF: a emissão só pode seguir se o arquivo existir.
vi.mock("@/lib/documento/pdf", () => ({
  gerarPdf: vi.fn(() => Promise.reject(new Error("falha de geração"))),
}));

import { gerarArquivo } from "@/lib/documento/baixar";

const doc = { arquivo: "relatorio-final-teste" } as unknown as Documento;

describe("gerarArquivo (emissão do relatório final)", () => {
  it("propaga a falha de geração, para que a emissão não seja registrada", async () => {
    await expect(gerarArquivo(doc, "pdf")).rejects.toThrow("falha de geração");
  });
});
