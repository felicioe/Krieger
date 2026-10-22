import type { MouseEvent, ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Coluna<T> {
  chave: string;
  titulo: string;
  render?: (linha: T) => ReactNode;
  alinhar?: "esquerda" | "direita" | "centro";
  className?: string;
}

/**
 * Abrir o registro: com `aoClicar`, cada linha ganha um botão na coluna `colunaAcao`
 * (padrão: a primeira) — alcançável por Tab, ativado por Enter/Espaço — cujo nome
 * acessível é `rotuloAcao(linha)` (ex.: "Abrir condomínio Residencial Acácias").
 * O clique em qualquer ponto da linha continua abrindo o registro com o mouse/toque.
 */
type Acao<T> =
  | { aoClicar: (linha: T) => void; rotuloAcao: (linha: T) => string; colunaAcao?: string }
  | { aoClicar?: undefined; rotuloAcao?: undefined; colunaAcao?: undefined };

/** Controles que já têm ação própria: clicar neles não abre o registro da linha. */
const INTERATIVO =
  "a,button,input,select,textarea,label,summary,[role=button],[role=checkbox],[role=switch],[role=combobox],[role=menuitem],[role=link],[contenteditable=true]";

/** Tabela simples e reutilizável, com estado vazio e ação de abrir o registro. */
export function DataTable<T>({
  colunas,
  dados,
  chaveLinha,
  aoClicar,
  rotuloAcao,
  colunaAcao,
  vazio = "Nenhum registro encontrado.",
}: {
  colunas: Coluna<T>[];
  dados: T[];
  chaveLinha: (linha: T) => string;
  vazio?: ReactNode;
} & Acao<T>) {
  const alinhamento = (a?: Coluna<T>["alinhar"]) =>
    a === "direita" ? "text-right" : a === "centro" ? "text-center" : "text-left";
  const chaveAcao = colunaAcao ?? colunas[0]?.chave;

  const cliqueLinha = (linha: T) => (e: MouseEvent<HTMLTableRowElement>) => {
    // O botão da linha (e qualquer controle interno) cuida do próprio clique: evita abrir duas vezes.
    if ((e.target as HTMLElement).closest(INTERATIVO)) return;
    // Não abre o registro quando a pessoa só está selecionando texto da linha.
    if (window.getSelection()?.toString()) return;
    aoClicar?.(linha);
  };

  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {colunas.map((c) => (
              <TableHead
                key={c.chave}
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-primary",
                  alinhamento(c.alinhar),
                  c.className,
                )}
              >
                {c.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colunas.length}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                {vazio}
              </TableCell>
            </TableRow>
          ) : (
            dados.map((linha) => (
              <TableRow
                key={chaveLinha(linha)}
                onClick={aoClicar ? cliqueLinha(linha) : undefined}
                className={cn(aoClicar && "cursor-pointer focus-within:bg-muted/50")}
              >
                {colunas.map((c) => {
                  const conteudo = c.render
                    ? c.render(linha)
                    : String((linha as Record<string, unknown>)[c.chave] ?? "");
                  return (
                    <TableCell key={c.chave} className={cn(alinhamento(c.alinhar), c.className)}>
                      {aoClicar && c.chave === chaveAcao ? (
                        <button
                          type="button"
                          onClick={() => aoClicar(linha)}
                          aria-label={rotuloAcao(linha)}
                          className="-mx-1 -my-1 inline-block max-w-full cursor-pointer rounded-sm px-1 py-1 text-left align-middle underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
                        >
                          {conteudo}
                        </button>
                      ) : (
                        conteudo
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
