import { Loader2 } from "lucide-react";

/**
 * Estado de espera do carregamento de rota. Anunciado como região viva educada
 * (auditoria Impeccable de 08/11/2026, P3): quem usa leitor de tela ouve que a página
 * está carregando sem que o foco seja movido. O ícone é decorativo — o texto é quem
 * carrega o significado.
 */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {texto}
    </div>
  );
}
