import { defineConfig } from "@playwright/test";

// Testes de navegador contra o build de produção. Antes: `npm run build`.
// PW_CHROMIUM aponta para um Chromium já instalado (ex.: /opt/pw-browsers/chromium).
const porta = Number(process.env.PORTA_E2E ?? 4173);
const chromium = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${porta}`,
    trace: "off",
    launchOptions: chromium ? { executablePath: chromium, args: ["--no-sandbox"] } : {},
  },
  webServer: {
    command: `node e2e/servidor.mjs .output/public ${porta}`,
    url: `http://127.0.0.1:${porta}/`,
    reuseExistingServer: !process.env.CI,
  },
});
