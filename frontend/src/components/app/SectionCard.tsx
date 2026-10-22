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
    <section id={id} className={cn("@container min-w-0 rounded-md border bg-card text-card-foreground shadow-sm", className)}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-3 @max-[14rem]:px-3">
          <div className="min-w-0">
            {titulo && <h2 className="break-words text-sm font-semibold uppercase tracking-wide text-primary">{titulo}</h2>}
            {descricao && <p className="mt-0.5 break-words text-xs text-muted-foreground">{descricao}</p>}
          </div>
          {acoes}
        </header>
      )}
      <div className="p-5 @max-[14rem]:p-3">{children}</div>
    </section>
  );
}
