import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lista de linhas repetíveis (adicionar, remover e reordenar).
 * `colunas` define o grid das linhas (ex.: "sm:grid-cols-[1fr_2fr_8rem]").
 */
export function RepeatableList<T>({
  itens,
  onChange,
  novo,
  render,
  colunas = "sm:grid-cols-2",
  cabecalhos,
  rotuloAdicionar = "Adicionar linha",
  vazio = "Nenhum item cadastrado.",
  reordenavel = true,
}: {
  itens: T[];
  onChange: (itens: T[]) => void;
  novo: () => T;
  render: (item: T, atualizar: (parcial: Partial<T>) => void, indice: number) => ReactNode;
  colunas?: string;
  cabecalhos?: string[];
  rotuloAdicionar?: string;
  vazio?: string;
  reordenavel?: boolean;
}) {
  const atualizar = (i: number, parcial: Partial<T>) =>
    onChange(itens.map((it, j) => (j === i ? { ...it, ...parcial } : it)));
  const remover = (i: number) => onChange(itens.filter((_, j) => j !== i));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= itens.length) return;
    const copia = [...itens];
    const a = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = a;
    onChange(copia);
  };

  return (
    <div className="space-y-2">
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <>
          {cabecalhos && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className={cn("grid flex-1 gap-2", colunas)}>
                {cabecalhos.map((c) => (
                  <span key={c} className="text-xs font-medium text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
              <div className={reordenavel ? "w-[6.5rem]" : "w-9"} />
            </div>
          )}
          {itens.map((item, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border bg-muted/40 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              <div className={cn("grid flex-1 gap-2", colunas)}>{render(item, (p) => atualizar(i, p), i)}</div>
              <div className="flex shrink-0 gap-0.5">
                {reordenavel && (
                  <>
                    <Button type="button" variant="ghost" size="icon" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para cima">
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} aria-label="Mover para baixo">
                      <ArrowDown />
                    </Button>
                  </>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => remover(i)} aria-label="Remover linha" className="text-destructive hover:text-destructive">
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...itens, novo()])}>
        <Plus /> {rotuloAdicionar}
      </Button>
    </div>
  );
}
