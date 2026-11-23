import { describe, it } from "vitest";
import { lerApoliceSeguro } from "@/domain/pdfParser";
import fs from "node:fs";
import path from "node:path";

const DIR = "C:/Users/Evandro/OneDrive/Desktop/Arquivos/krieger/Condomínios/Seguros";

describe("batch: lerApoliceSeguro em todos os PDFs de Seguros", () => {
  it("relatório de reconhecimento", async () => {
    const { execFileSync } = await import("node:child_process");
    const pdfs = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
    const out: Array<{ file: string; ok: boolean; info?: string }> = [];
    const tmpDir = path.join(process.cwd(), ".tmp-apolice");
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const pdf of pdfs) {
      const dest = path.join(tmpDir, pdf.replace(/\.pdf$/i, ".txt"));
      try {
        execFileSync("C:/Users/Evandro/bin/../../../../ucrt64/bin/pdftotext", ["-layout", path.join(DIR, pdf), dest], {
          stdio: "ignore",
        });
      } catch {
        try {
          execFileSync("pdftotext", ["-layout", path.join(DIR, pdf), dest], { stdio: "ignore" });
        } catch {
          out.push({ file: pdf, ok: false, info: "pdftotext falhou" });
          continue;
        }
      }
      let texto = "";
      try {
        texto = fs.readFileSync(dest, "utf8");
      } catch {
        out.push({ file: pdf, ok: false, info: "sem texto extraído" });
        continue;
      }
      const r = lerApoliceSeguro(texto);
      if (r) {
        out.push({
          file: pdf,
          ok: true,
          info: `${r.seguradora} | ${r.numeroApolice} | ${r.condominio?.nome} | ${r.condominio?.cnpj} | ${r.vigenciaIni}→${r.vigenciaFim}`,
        });
      } else {
        out.push({ file: pdf, ok: false, info: `não reconhecido (${texto.trim().length} chars)` });
      }
    }

    const ok = out.filter((o) => o.ok);
    const bad = out.filter((o) => !o.ok);
    console.log(`\n=== RECONHECIDOS: ${ok.length} / NÃO RECONHECIDOS: ${bad.length} ===\n`);
    for (const o of ok) console.log(`OK   ${o.file}\n     ${o.info}`);
    console.log("\n--- FALHAS ---");
    for (const o of bad) console.log(`FAIL ${o.file} — ${o.info}`);
  }, 300000);
});