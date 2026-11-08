import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PularParaConteudo } from "@/components/app/PularParaConteudo";
import { Carregando } from "@/components/app/Carregando";

/**
 * Correções dos achados da auditoria técnica de 08/11/2026
 * (docs/auditorias/IMPECCABLE-2026-11-08.md). Cada caso cobre o aceite escrito no relatório.
 */
describe("P2 atalho de salto para o conteúdo", () => {
  function Pagina() {
    return (
      <>
        <PularParaConteudo />
        <nav aria-label="Menu">
          <a href="#outra">Painel</a>
          <a href="#outra">Atas</a>
        </nav>
        <main id="conteudo" tabIndex={-1}>
          <h1>Painel</h1>
        </main>
      </>
    );
  }

  it("é o primeiro elemento focável, antes dos links do menu", async () => {
    const user = userEvent.setup();
    render(<Pagina />);
    await user.tab();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveFocus();
  });

  it("leva o foco ao conteúdo da rota sem trocar o endereço", async () => {
    const user = userEvent.setup();
    render(<Pagina />);
    const antes = window.location.hash;
    const atalho = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(atalho).toHaveAttribute("href", "#conteudo");
    await user.click(atalho);
    expect(document.getElementById("conteudo")).toHaveFocus();
    // A rota do roteador é por hash: o salto não pode trocá-la.
    expect(window.location.hash).toBe(antes);
  });

  it("também funciona por Enter, como qualquer link", async () => {
    const user = userEvent.setup();
    render(<Pagina />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(document.getElementById("conteudo")).toHaveFocus();
  });
});

describe("P3 estado de carregamento anunciado", () => {
  it("expõe região viva educada com o texto do estado", () => {
    render(<Carregando />);
    const regiao = screen.getByRole("status");
    expect(regiao).toHaveAttribute("aria-live", "polite");
    expect(regiao).toHaveAttribute("aria-atomic", "true");
    expect(regiao).toHaveTextContent("Carregando");
  });

  it("o ícone é decorativo: não acrescenta texto ao anúncio", () => {
    render(<Carregando texto="Carregando editais…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando editais…");
    const icone = screen.getByRole("status").querySelector("svg");
    expect(icone).toHaveAttribute("aria-hidden", "true");
  });
});

describe("P2 preferência por movimento reduzido", () => {
  // O CSS é a fonte; o build do Tailwind não geraria a media query sozinho para
  // as animações da gaveta e do diálogo (auditoria, evidência: 0 ocorrências no compilado).
  const css = readFileSync("src/styles.css", "utf8");

  it("o CSS declara a media query de movimento reduzido", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("a media query encurta animação e transição, sem esconder conteúdo", () => {
    const inicio = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const bloco = css.slice(inicio, inicio + 500);
    expect(bloco).toContain("animation-duration: 0.01ms !important");
    expect(bloco).toContain("transition-duration: 0.01ms !important");
    expect(bloco).toContain("animation-iteration-count: 1 !important");
    // Nada de display:none/visibility:hidden: o controle continua existindo e focável.
    expect(bloco).not.toContain("display: none");
    expect(bloco).not.toContain("visibility: hidden");
  });
});

describe("P3 avisos semânticos em vez de cores literais", () => {
  // Prévia do relatório final: o aviso de rateio aprovado. Renderizá-la exigiria montar
  // todo o RelatorioFinal; a garantia aqui é sobre a origem, que é onde as classes viviam.
  const fonte = readFileSync("src/components/relatorio/PreviaRelatorio.tsx", "utf8");

  it("não usa mais as cores amber literais", () => {
    expect(fonte).not.toContain("amber-");
  });

  it("usa o aviso da biblioteca com os tokens de warning", () => {
    expect(fonte).toContain("avisoRateioAprovado");
    expect(fonte).toContain('variant="warning"');
  });
});
