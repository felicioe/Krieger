import { useId, type ReactElement, cloneElement } from "react";
import { TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PropsControle = {
  id?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  "aria-describedby"?: string | undefined;
  "aria-required"?: boolean | undefined;
};

/**
 * Rótulo + controle + dica/erro. O id é repassado ao controle filho, junto com
 * `aria-describedby` (dica ou erro, cada um com id próprio), `aria-invalid` e
 * `aria-required` — assim a tecnologia assistiva lê a dica, o erro e a obrigatoriedade
 * ao focar o campo. Usa `aria-required` (e não `required`) para não acionar a
 * validação nativa do navegador, que não segue as mensagens do sistema.
 */
export function Field({
  rotulo,
  dica,
  erro,
  aviso,
  obrigatorio,
  className,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  /** Alerta não bloqueante (ex.: valor incomum); aparece junto da dica e é lido ao focar o campo. */
  aviso?: string | null;
  obrigatorio?: boolean;
  className?: string;
  children: ReactElement<PropsControle>;
}) {
  const id = useId();
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;
  const idAviso = `${id}-aviso`;
  const descricao = erro ? idErro : dica ? idDica : undefined;
  const descricaoFilho = children.props["aria-describedby"];
  const describedBy = [descricaoFilho, descricao, aviso ? idAviso : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={id} className="break-words text-xs font-medium text-muted-foreground">
        {rotulo}
        {obrigatorio && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        "aria-invalid": !!erro || undefined,
        "aria-describedby": describedBy,
        "aria-required": obrigatorio || children.props["aria-required"] || undefined,
      })}
      {erro ? (
        <p id={idErro} className="text-xs text-destructive">
          {erro}
        </p>
      ) : dica ? (
        <p id={idDica} className="text-xs text-muted-foreground">
          {dica}
        </p>
      ) : null}
      {aviso && (
        <p id={idAviso} className="flex items-start gap-1 rounded-sm bg-warning/15 px-1.5 py-1 text-xs text-warning-foreground">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{aviso}</span>
        </p>
      )}
    </div>
  );
}
