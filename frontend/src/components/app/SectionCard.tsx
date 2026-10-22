import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cartão branco com borda fina e título de seção. */
export function SectionCard({
  id,
  titulo,
  descricao,
  acoes,
  children,
  className,
}: {
  /** Âncora para atalhos que levam até a seção. */
  id?: string;
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 rounded-md border bg-card text-card-foreground", className)}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
          </div>
          {acoes}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
