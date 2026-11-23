import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { imprimirPdfBase64 } from "@/lib/driveProcessador";
import { totalCadastrosOperacionais } from "@/routes/_authenticated.limpeza-dados";
import type { ContagensLimpeza } from "@/lib/api";

describe("correções da auditoria Impeccable 22/11/2026", () => {
  it("soma modelos_ata no total de cadastros operacionais da Limpeza de Dados (#372)", () => {
    const contagens: ContagensLimpeza = {
      condominios: 2,
      exercicios: 3,
      mensais: 4,
      assembleias: 1,
      atas: 1,
      modelos_ata: 5,
      modelos: 2,
      importacoes: 1,
      anexos_importacao: 1,
      decisoes_previsao: 1,
      decisoes_importacao: 1,
      documentos: 2,
      backups: 10,
    };
    // Backups não entram no total operacional; modelos_ata entra (2+3+4+1+1+5+2+1+1+1+1+2 = 24)
    expect(totalCadastrosOperacionais(contagens)).toBe(24);
  });

  it("retorna false e revoga Blob URL quando o navegador bloqueia pop-up na impressão do Drive (#376)", () => {
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:teste-pdf");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    try {
      const ok = imprimirPdfBase64("data:application/pdf;base64,JVBERi0xLjQ=");
      expect(ok).toBe(false);
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith("blob:teste-pdf");
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
      openSpy.mockRestore();
    }
  });

  it("mantém contenção de altura e rolagem interna no DialogContent base (#375)", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Modal longo</DialogTitle>
          <p>Conteúdo</p>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[90vh]");
    expect(dialog.className).toContain("overflow-y-auto");
  });
});
