import { useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { adicionarPalavraChave } from "@/domain/rubricaAmigavel";

/**
 * Campo de rubrica (água, energia, elevador, dedução): em vez de pedir que o usuário escreva
 * regex, oferece "digite uma palavra e clique em adicionar" — a palavra vira uma alternativa
 * somada à expressão já existente (`domain/rubricaAmigavel.ts`), sem reescrever nada do que já
 * havia. A expressão técnica continua editável, só que recolhida por padrão (`<details>`), pra
 * quem realmente precisa ajustá-la à mão.
 */
export function CampoRubrica({
  rotulo,
  dica,
  placeholder = "ex.: água, esgoto",
  value,
  onChange,
}: {
  rotulo: string;
  dica?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [palavra, setPalavra] = useState("");

  const adicionar = () => {
    if (!palavra.trim()) return;
    onChange(adicionarPalavraChave(value, palavra));
    setPalavra("");
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionar();
    }
  };

  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label className="break-words text-xs font-medium text-muted-foreground">{rotulo}</Label>
      <div className="flex gap-2">
        <Input
          aria-label={`Adicionar palavra-chave — ${rotulo}`}
          placeholder={placeholder}
          value={palavra}
          onChange={(e) => setPalavra(e.target.value)}
          onKeyDown={aoTeclar}
        />
        <Button type="button" variant="outline" size="icon" onClick={adicionar} aria-label={`Adicionar palavra-chave a ${rotulo}`}>
          <Plus />
        </Button>
      </div>
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Expressão técnica (normalmente não precisa mexer aqui)</summary>
        <Input
          aria-label={`Expressão técnica — ${rotulo}`}
          className="mt-1.5 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </details>
    </div>
  );
}
