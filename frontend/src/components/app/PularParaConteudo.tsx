import type { MouseEvent } from "react";
import { ID_CONTEUDO } from "@/components/app/foco";

/**
 * Atalho "Pular para o conteúdo" (auditoria Impeccable de 08/11/2026, P2).
 *
 * Sem ele, o primeiro Tab no desktop percorre todos os links do menu lateral antes do
 * conteúdo. O `<main>` já aceita foco (`tabIndex={-1}`); aqui o foco é movido explicitamente,
 * com `preventDefault`, para o salto não trocar o hash do roteador. Visível só ao foco — o
 * `sr-only`/`focus:not-sr-only` do Tailwind deixa o link fora da tela até ele receber Tab.
 */
export function PularParaConteudo() {
  function irParaConteudo(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    document.getElementById(ID_CONTEUDO)?.focus();
  }

  return (
    <a
      href={`#${ID_CONTEUDO}`}
      onClick={irParaConteudo}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Pular para o conteúdo
    </a>
  );
}
