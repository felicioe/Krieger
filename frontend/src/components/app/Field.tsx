import { useId, type ReactElement, cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Rótulo + controle + dica/erro. O id é repassado ao controle filho. */
export function Field({
  rotulo,
  dica,
  erro,
  obrigatorio,
  className,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  obrigatorio?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean | undefined }>;
}) {
  const id = useId();
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {cloneElement(children, { id, "aria-invalid": !!erro || undefined })}
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : dica ? (
        <p className="text-xs text-muted-foreground">{dica}</p>
      ) : null}
    </div>
  );
}
