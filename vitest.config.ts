import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // VITEST_INCLUDE roda ferramentas locais de scripts/ (fora do CI), ex.: o relatório de apólices.
    include: process.env["VITEST_INCLUDE"]
      ? [process.env["VITEST_INCLUDE"]]
      : ["domain/**/*.{test,spec}.ts", "lib/**/*.{test,spec}.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});
