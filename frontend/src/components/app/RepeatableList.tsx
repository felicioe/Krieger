import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lista de linhas repetíveis (adicionar, remover e reordenar).
 * `colunas` define o grid das linhas (ex.: "@2xl:grid-cols-[1fr_2fr_8rem]").
 * O layout segue a LARGURA DA PRÓPRIA LISTA (container query), não a da tela: abaixo de
 * `@2xl` (42rem) os botões da linha descem para baixo dos campos e os títulos somem, para que
 * os campos usem a largura toda mesmo ao lado do menu fixo (ex.: tablet a 768 px).
 * Use variantes `@xs:`/`@2xl:` em `colunas`, não `sm:`/`md:`.
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
  const qtdBotoes = reordenavel ? 3 : 1;

  return (
    <div className="@container space-y-2">
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <>
          {cabecalhos && (
            <div className="hidden items-center gap-2 @2xl:flex">
              <div className={cn("grid min-w-0 flex-1 gap-2", colunas)}>
                {cabecalhos.map((c) => (
                  <span key={c} className="text-xs font-medium text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
              {/* Espaço invisível do mesmo tamanho dos botões da linha, para alinhar os títulos. */}
              <div className="invisible flex shrink-0 gap-1" aria-hidden="true">
                {Array.from({ length: qtdBotoes }, (_, k) => (
                  <span key={k} className="block h-0 w-9 max-md:w-11 pointer-coarse:w-11" />
                ))}
              </div>
            </div>
          )}
          {itens.map((item, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2 @2xl:flex-row @2xl:items-start @2xl:border-0 @2xl:bg-transparent @2xl:p-0"
            >
              <div className={cn("grid min-w-0 flex-1 gap-2", colunas)}>
                {render(item, (p) => atualizar(i, p), i)}
              </div>
              <div className="flex shrink-0 justify-end gap-1">
                {reordenavel && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      aria-label={`Mover linha ${i + 1} para cima`}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => mover(i, 1)}
                      disabled={i === itens.length - 1}
                      aria-label={`Mover linha ${i + 1} para baixo`}
                    >
                      <ArrowDown />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remover(i)}
                  aria-label={`Remover linha ${i + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...itens, novo()])}
      >
        <Plus /> {rotuloAdicionar}
      </Button>
    </div>
  );
}
