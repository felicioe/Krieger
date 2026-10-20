import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Coluna<T> {
  chave: string;
  titulo: string;
  render?: (linha: T) => ReactNode;
  alinhar?: "esquerda" | "direita" | "centro";
  className?: string;
}

/** Tabela simples e reutilizável, com estado vazio e clique na linha. */
export function DataTable<T>({
  colunas,
  dados,
  chaveLinha,
  aoClicar,
  vazio = "Nenhum registro encontrado.",
}: {
  colunas: Coluna<T>[];
  dados: T[];
  chaveLinha: (linha: T) => string;
  aoClicar?: (linha: T) => void;
  vazio?: ReactNode;
}) {
  const alinhamento = (a?: Coluna<T>["alinhar"]) =>
    a === "direita" ? "text-right" : a === "centro" ? "text-center" : "text-left";

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {colunas.map((c) => (
              <TableHead
                key={c.chave}
                className={cn("text-xs font-semibold uppercase tracking-wide text-primary", alinhamento(c.alinhar), c.className)}
              >
                {c.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colunas.length} className="py-10 text-center text-sm text-muted-foreground">
                {vazio}
              </TableCell>
            </TableRow>
          ) : (
            dados.map((linha) => (
              <TableRow
                key={chaveLinha(linha)}
                onClick={aoClicar ? () => aoClicar(linha) : undefined}
                className={cn(aoClicar && "cursor-pointer")}
              >
                {colunas.map((c) => (
                  <TableCell key={c.chave} className={cn(alinhamento(c.alinhar), c.className)}>
                    {c.render ? c.render(linha) : String((linha as Record<string, unknown>)[c.chave] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
