import { VERSOES } from "@/components/versoes/versoes";

/**
 * Rodapé da tela de entrada: só autoria e versão atual. O Registro de Alterações fica
 * dentro do sistema, no bloco da conta do menu lateral (pedido #81, que substituiu o
 * acesso público ao registro na tela de entrada das entregas #77/#79).
 */
export function RodapeLogin() {
  return (
    <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
      {/* No celular cada item fica numa linha (sem separador solto); a partir de sm, lado a lado. */}
      <div className="mx-auto flex flex-col items-center gap-1 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
        <span>Feito pela Therafinancial</span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span>Versão {VERSOES.versaoAtual}</span>
      </div>
    </footer>
  );
}
