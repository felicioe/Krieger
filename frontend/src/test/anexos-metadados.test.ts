import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/lib/mockApi";
import { realApi } from "@/lib/realApi";
import type { AnexoImportado } from "@/domain/types";

describe("Anexos por exercício sem conteúdo do PDF", () => {
  beforeEach(async () => {
    localStorage.clear();
    await mockApi.auth.entrar("admin", "admin123");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("filtra os metadados, mantém tamanho e busca o original somente por id", async () => {
    const base = { tipo: "comparativo_financeiro" as const, arquivo: "Referência & teste.pdf", importadoEm: "2026-11-05T12:00:00Z", relatorio: {} as AnexoImportado["relatorio"] };
    const original = { ...base, id: "anexo-1", exercicioId: "exercicio-1", arquivoDataUrl: "data:application/pdf;base64,AQ==" };
    await mockApi.salvar("anexos_importacao", original);
    await mockApi.salvar("anexos_importacao", { ...base, id: "anexo-2", exercicioId: "exercicio-2", arquivoDataUrl: "data:application/pdf;base64," + "AAAA".repeat(100000) });
    const metadados = await mockApi.anexos.listar("exercicio-1");
    expect(metadados).toEqual([{ ...base, id: "anexo-1", exercicioId: "exercicio-1", arquivoBytes: 1, temArquivo: true }]);
    expect(JSON.stringify(metadados)).not.toContain("arquivoDataUrl");
    expect(await mockApi.obter("anexos_importacao", "anexo-1")).toEqual(original);
    expect(await mockApi.anexos.listar("sem-anexos")).toEqual([]);
  });

  it("rejeita listagem sem exercício e exige sessão", async () => {
    await expect(mockApi.anexos.listar("")).rejects.toMatchObject({ status: 400 });
    await mockApi.auth.sair();
    await expect(mockApi.anexos.listar("exercicio-1")).rejects.toMatchObject({ status: 401 });
  });

  it("API real solicita projeção filtrada com autenticação e codificação do identificador", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "a1", arquivoBytes: 2, temArquivo: true }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await realApi.anexos.listar("exercicio&outro=1")).toEqual([{ id: "a1", arquivoBytes: 2, temArquivo: true }]);
    expect(fetchMock).toHaveBeenCalledWith("api.php?a=listar&s=anexos_importacao&metadados=1&exercicioId=exercicio%26outro%3D1", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("API real preserva a recusa de permissão em vez de ocultar a falha como lista vazia", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "Sem permissão." }), { status: 403 })));
    await expect(realApi.anexos.listar("exercicio-1")).rejects.toMatchObject({ status: 403, message: "Sem permissão." });
  });
});
