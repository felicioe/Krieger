import { forwardRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão "Mostrar senha"/"Ocultar senha". Começa oculta. Só troca o
 * `type` do mesmo `<input>` (não remonta), então valor, preenchimento automático e
 * `autoComplete` continuam. O botão é `type="button"` (nunca envia o formulário) e, com o
 * mouse, não tira o foco do campo. Repassa id/aria-* (vindos do `Field`) ao `<input>`.
 */
export const CampoSenha = forwardRef<HTMLInputElement, Omit<ComponentProps<"input">, "type">>(
  function CampoSenha({ className, id, ...props }, ref) {
    const [visivel, setVisivel] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visivel ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn("pr-11 max-md:pr-12 pointer-coarse:pr-12", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-controls={id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisivel((v) => !v)}
          className="absolute right-0 top-0 rounded-l-none text-muted-foreground hover:text-foreground"
        >
          {visivel ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
    );
  },
);
