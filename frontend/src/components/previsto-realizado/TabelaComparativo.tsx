import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResultadoComparativo, Situacao, Totais } from "@/domain/previstoRealizado";

const ROTULO: Record<Situacao, string> = { dentro: "Dentro", acima: "Acima", abaixo: "Abaixo" };
const VARIANTE: Record<Situacao, "success" | "alerta" | "secondary"> = { dentro: "success", acima: "alerta", abaixo: "secondary" };

export function SituacaoBadge({ situacao, className }: { situacao: Situacao | null; className?: string }) {
  if (!situacao) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge variant={VARIANTE[situacao]} className={className}>
      {ROTULO[situacao]}
    </Badge>
  );
}

export const pctTexto = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${formatNumeroBR(n)}%`);

/** Marcador da situação fora da tolerância (acima/abaixo) nas versões sem a coluna "Situação". */
export const marcaSituacao = (s: Situacao | null) => (s === "acima" || s === "abaixo" ? "*" : "");

/** Legenda do marcador, com a tolerância usada no comparativo. */
export function legendaSituacao(tolerancia: number): string {
  const tol = formatNumeroBR(tolerancia, Number.isInteger(tolerancia) ? 0 : 2);
  return `* Fora da tolerância de ±${tol}% em relação ao previsto: percentual positivo, acima do previsto; negativo, abaixo. Sem marcador, dentro do previsto.`;
}

const th = "h-auto py-2 text-right align-bottom text-xs font-semibold uppercase leading-tight tracking-wide text-primary";

function Valores({ t, forte, compacta }: { t: Totais; forte?: boolean; compacta?: boolean }) {
  return (
    <>
      <TableCell className="num whitespace-nowrap text-right">
        <div>{formatBRL(t.previstoAnual)}</div>
        {!compacta && <div className="text-xs font-normal text-muted-foreground">{formatBRL(t.previstoMensal)}/mês</div>}
      </TableCell>
      <TableCell className={cn("num whitespace-nowrap text-right", forte && "font-semibold")}>{formatBRL(t.previsto)}</TableCell>
      <TableCell className={cn("num whitespace-nowrap text-right", forte && "font-semibold")}>{formatBRL(t.realizado)}</TableCell>
      <TableCell
        className={cn(
          "num whitespace-nowrap text-right",
          t.situacao === "acima" && "text-destructive",
          forte && "font-semibold",
        )}
      >
        {t.diferenca > 0 ? "+" : ""}
        {formatBRL(t.diferenca)}
      </TableCell>
      <TableCell className={cn("num whitespace-nowrap text-right text-xs", t.situacao === "acima" && "text-destructive")}>
        {pctTexto(t.pct)}
        {compacta && marcaSituacao(t.situacao) && (
          <>
            <span aria-hidden>{marcaSituacao(t.situacao)}</span>
            <span className="sr-only"> ({t.situacao === "acima" ? "acima" : "abaixo"} do previsto)</span>
          </>
        )}
      </TableCell>
      {!compacta && (
        <TableCell className="text-center">
          <SituacaoBadge situacao={t.situacao} />
        </TableCell>
      )}
    </>
  );
}

/**
 * Tabela por rubrica e grupo. `compacta` (prévia da folha impressa): sem o "/mês", sem a coluna
 * Situação (vira o marcador "*" no percentual, com legenda), células mais justas — igual ao PDF/Word.
 */
export function TabelaComparativo({
  r,
  compacta = false,
  mostrarAnaliticas = true,
}: {
  r: ResultadoComparativo;
  compacta?: boolean;
  /** false = esconde as linhas por rubrica (contas analíticas), só os totais por grupo e geral. */
  mostrarAnaliticas?: boolean;
}) {
  if (r.grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">A previsão deste exercício não tem despesas lançadas.</p>;
  }
  const ate = r.mesAte.rotulo;
  const nColunas = compacta ? 6 : 7;
  const tabela = (
    <div className={compacta ? "overflow-x-auto" : "-mx-5 -mb-5 overflow-x-auto @max-[14rem]:-mx-3 @max-[14rem]:-mb-3"}>
      <Table className={compacta ? "text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:px-1.5" : undefined}>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead
              className={cn(
                "h-auto py-2 align-bottom text-xs font-semibold uppercase tracking-wide text-primary",
                compacta ? "min-w-[11rem]" : "min-w-[13rem]",
              )}
            >
              Rubrica
            </TableHead>
            <TableHead className={th}>{compacta ? "Previsto anual" : "Previsto anual / mensal"}</TableHead>
            <TableHead className={th}>Previsto até {ate}</TableHead>
            <TableHead className={th}>Realizado até {ate}</TableHead>
            <TableHead className={th}>Diferença</TableHead>
            <TableHead className={th}>%</TableHead>
            {!compacta && (
              <TableHead className="h-auto py-2 text-center align-bottom text-xs font-semibold uppercase tracking-wide text-primary">Situação</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.grupos.map((g) => (
            <Fragment key={g.nome}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={nColunas} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.nome || "Sem grupo"}
                </TableCell>
              </TableRow>
              {mostrarAnaliticas &&
                g.linhas.map((l) => (
                  <TableRow key={`${l.tipo}-${l.nome}`}>
                    <TableCell className={compacta ? "pl-4" : "pl-6"}>
                      {l.tipo === "ajuste" && (
                        <span className={cn("mr-1.5 font-semibold", l.sinal === "-" ? "text-destructive" : "text-primary")}>
                          {l.sinal === "-" ? "−" : "+"}
                        </span>
                      )}
                      <span>{l.nome || "Sem nome"}</span>
                      {l.tipo === "ajuste" && (
                        <Badge variant="outline" className="ml-2 align-middle text-[10px] font-medium text-muted-foreground">
                          ajuste
                        </Badge>
                      )}
                      {l.tipo === "rubrica" && l.previstoAnual === 0 && l.realizado !== 0 && (
                        <Badge variant="warning" className="ml-2 align-middle text-[10px]">
                          não prevista
                        </Badge>
                      )}
                    </TableCell>
                    <Valores t={l} compacta={compacta} />
                  </TableRow>
                ))}
              <TableRow className="border-b-2 hover:bg-transparent">
                <TableCell className={cn("font-semibold text-primary", compacta ? "pl-4" : "pl-6 text-sm")}>Total {g.nome || "sem grupo"}</TableCell>
                <Valores t={g.totais} forte compacta={compacta} />
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-secondary hover:bg-secondary">
            <TableCell className="font-semibold text-primary">Total geral</TableCell>
            <Valores t={r.total} forte compacta={compacta} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
  if (!compacta) return tabela;
  return (
    <div>
      {tabela}
      <p className="mt-2 text-xs text-muted-foreground">{legendaSituacao(r.tolerancia)}</p>
    </div>
  );
}
