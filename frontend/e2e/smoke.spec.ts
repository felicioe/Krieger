import { expect, test, type Page } from "@playwright/test";

// Cenários que antes eram verificados à mão: hidratação (#353), rolagem horizontal (#356, #406),
// nomes acessíveis (#355, #408). Dados fictícios do modo demonstração (localhost).

const CHAVE_SESSAO = "krieger-mock-sessao-v1";

// A sessão é gravada antes de qualquer script da página, em todo documento que for aberto.
async function comSessao(page: Page) {
  await page.addInitScript((chave) => {
    if (!localStorage.getItem(chave)) localStorage.setItem(chave, "u-admin");
  }, CHAVE_SESSAO);
}

function coletarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  return erros;
}

test.describe("rotas autenticadas abertas direto", () => {
  for (const rota of ["#/painel", "#/condominios/condo-acacias", "#/prestacao-contas"]) {
    test(`${rota} sem erro de hidratação nem de console`, async ({ page }) => {
      await comSessao(page);
      const erros = coletarErros(page);
      // Documento novo na própria rota: a hidratação acontece com o hash já aberto.
      await page.goto(`/${rota}`);
      await page.waitForLoadState("networkidle");
      expect(erros).toEqual([]);
    });
  }
});

const rotasSemRolagem = [
  "#/previsao-orcamentaria?exercicio=exe-acacias-2025",
  "#/drive-documentos",
];

test.describe("sem rolagem horizontal", () => {
  test.use({ viewport: { width: 320, height: 800 } });
  for (const rota of rotasSemRolagem) {
    test(`320 px com texto a 200%: ${rota}`, async ({ page }) => {
      await comSessao(page);
      await page.goto(`/${rota}`);
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "html{font-size:200%!important}" });
      const medida = await page.evaluate(() => ({
        largura: document.documentElement.clientWidth,
        rolagem: document.documentElement.scrollWidth,
      }));
      expect(medida.rolagem).toBeLessThanOrEqual(medida.largura);
    });
  }
});

test.describe("1280 px com texto a 200%", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("Previsão sem rolagem horizontal", async ({ page }) => {
    await comSessao(page);
    await page.goto("/#/previsao-orcamentaria?exercicio=exe-acacias-2025");
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "html{font-size:200%!important}" });
    const medida = await page.evaluate(() => ({
      largura: document.documentElement.clientWidth,
      rolagem: document.documentElement.scrollWidth,
    }));
    expect(medida.rolagem).toBeLessThanOrEqual(medida.largura);
  });
});

// Campo sem nome acessível ou botão cujo nome não contém o texto visível.
const auditarNomes = () => {
  const nomeDe = (el: Element): string => {
    const ids = el.getAttribute("aria-labelledby");
    if (ids) return ids.split(" ").map((i) => document.getElementById(i)?.textContent ?? "").join(" ").trim();
    if (el.getAttribute("aria-label")) return (el.getAttribute("aria-label") ?? "").trim();
    const rotulos = (el as HTMLInputElement).labels;
    if (rotulos && rotulos.length) return Array.from(rotulos).map((l) => l.textContent ?? "").join(" ").trim();
    return "";
  };
  const campos = Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea"))
    .filter((el) => (el as HTMLElement).offsetParent !== null)
    .filter((el) => !nomeDe(el))
    .map((el) => `campo sem nome: ${(el as HTMLInputElement).name || el.outerHTML.slice(0, 60)}`);
  const botoes = Array.from(document.querySelectorAll("button"))
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ visivel: (el.textContent ?? "").replace(/\s+/g, " ").trim(), nome: nomeDe(el) || (el.textContent ?? "").trim() }))
    .filter((b) => b.visivel && !b.nome.includes(b.visivel.slice(0, 12)))
    .map((b) => `botão visível "${b.visivel.slice(0, 40)}" com nome "${b.nome.slice(0, 40)}"`);
  return [...campos, ...botoes];
};

test.describe("nomes acessíveis (#355, #408)", () => {
  for (const rota of ["#/condominios/condo-acacias", "#/editais", "#/atas", "#/relatorio-mensal", "#/modelos"]) {
    test(`sem divergência em ${rota}`, async ({ page }) => {
      await comSessao(page);
      await page.goto(`/${rota}`);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(auditarNomes)).toEqual([]);
    });
  }
});
