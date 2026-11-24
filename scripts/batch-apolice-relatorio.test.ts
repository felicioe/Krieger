/**
 * Ferramenta LOCAL (fora da suíte do CI): relatório de reconhecimento de
 * apólices sobre os .txt extraídos dos PDFs de seguros.
 * Rodar: VITEST_INCLUDE=scripts/batch-apolice-relatorio.test.ts APOLICE_TXT_DIR=<pasta> npx vitest run
 */
import { describe, expect, it } from "vitest";
import { lerApoliceSeguro } from "@/domain/pdfParser";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RESULTS_DIR = process.env["APOLICE_TXT_DIR"] ?? "C:\\Users\\Evandro\\.claude\\parser_results";
const RELATORIO = path.join(os.tmpdir(), "batch-apolice-report.md");

describe("batch: lerApoliceSeguro em todos os PDFs de Seguros", () => {
  it("relatório de reconhecimento de layouts", () => {
    const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".txt")).sort();
    const reportLines = [
      "# Relatório de Reconhecimento de Layouts – Apólices de Seguro",
      "",
      `- **Total de arquivos:** ${files.length}`,
      "",
      "| Arquivo | Reconhecido | Seguradora | Nº Apólice | Vigência | Risco | Coberturas |",
      "|---|---|---|---|---|---|---|",
    ];

    let recognized = 0;
    let notRecognized = 0;

    files.forEach((file) => {
      const filePath = path.join(RESULTS_DIR, file);
      const text = fs.readFileSync(filePath, "utf8");
      const resultado = lerApoliceSeguro(text);

      if (resultado) {
        recognized++;
        reportLines.push(
          `| ${file} | ✅ Sim | ${resultado.seguradora ?? "—"} | ${resultado.numeroApolice ?? "—"} | ${resultado.vigenciaIni ?? "—"} → ${resultado.vigenciaFim ?? "—"} | R$ ${resultado.riscoAbsoluto ?? 0} | ${resultado.coberturas?.length ?? 0} |`
        );
      } else {
        notRecognized++;
        reportLines.push(`| ${file} | ❌ Não | — | — | — | — | — |`);
      }
    });

    reportLines.push(
      "",
      "## Resumo",
      "",
      `- ✅ Reconhecidos: ${recognized}`,
      `- ❌ Não reconhecidos: ${notRecognized}`,
      "",
    );

    fs.writeFileSync(RELATORIO, reportLines.join("\n"), "utf8");

    console.log(`\n📊 RELATÓRIO SALVO: ${RELATORIO}`);
    console.log(`Reconhecidos: ${recognized} / ${files.length}`);
    console.log(`Não reconhecidos: ${notRecognized} / ${files.length}`);

    expect(true).toBe(true);
  });
});
