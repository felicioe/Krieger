import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botões "+" / "−" de acréscimo ou redução (ajustes, deduções, variação). */
export function SinalToggle({
  valor,
  onChange,
  rotulo = "Sinal",
  className,
}: {
  valor: "+" | "-";
  onChange: (s: "+" | "-") => void;
  rotulo?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-9 overflow-hidden rounded-md border border-control max-md:h-auto pointer-coarse:h-auto", className)} role="group" aria-label={rotulo}>
      {(["+", "-"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={valor === s}
          aria-label={s === "+" ? "Acréscimo" : "Redução"}
          onClick={() => onChange(s)}
          className={cn(
            "flex flex-1 items-center justify-center transition-colors max-md:min-h-11 max-md:min-w-11 pointer-coarse:min-h-11 pointer-coarse:min-w-11 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            valor === s
              ? s === "+"
                ? "bg-primary text-primary-foreground"
                : "bg-destructive text-destructive-foreground"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {s === "+" ? <Plus className="size-4" /> : <Minus className="size-4" />}
        </button>
      ))}
    </div>
  );
}
