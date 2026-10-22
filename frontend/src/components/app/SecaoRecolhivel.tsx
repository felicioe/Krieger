import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Cartão de seção que abre e fecha pelo título (botão de verdade: Tab + Enter/Espaço,
 * `aria-expanded`). Fechada, mostra um resumo do que já está preenchido.
 * O conteúdo continua montado quando fechado (só fica escondido), então nada do que foi
 * digitado se perde ao recolher.
 */
export function SecaoRecolhivel({
  titulo,
  descricao,
  resumo,
  aberta,
  aoMudar,
  children,
  className,
}: {
  titulo: string;
  descricao?: ReactNode;
  /** Situação atual em uma linha (ex.: "3 membros"), visível com a seção fechada ou aberta. */
  resumo?: ReactNode;
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible open={aberta} onOpenChange={aoMudar} asChild>
      <section className={cn("min-w-0 rounded-md border bg-card text-card-foreground", className)}>
        <h2 className="m-0">
          <CollapsibleTrigger
            className={cn(
              "flex w-full items-start gap-3 rounded-md px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:min-h-11 pointer-coarse:min-h-11",
              aberta && "rounded-b-none border-b",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold uppercase tracking-wide text-primary">
                {titulo}
              </span>
              {resumo && (
                <span className="mt-0.5 block text-xs font-normal text-foreground">{resumo}</span>
              )}
              {descricao && aberta && (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {descricao}
                </span>
              )}
            </span>
            <span
              className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-muted-foreground"
              aria-hidden="true"
            >
              <span>{aberta ? "Recolher" : "Abrir"}</span>
              <ChevronDown
                className={cn("size-4 transition-transform", aberta && "rotate-180")}
                aria-hidden="true"
              />
            </span>
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent forceMount hidden={!aberta} className="p-5">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
