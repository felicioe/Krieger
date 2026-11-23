import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { baseDoRateio, distribuirRateio } from "@/domain/fracoes";
import type { ResultadoPrevisao } from "@/domain/previsao";
import type { Arredondamento, Condominio } from "@/domain/types";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Base do rateio e, quando o cadastro tem frações válidas, quanto cada unidade paga pela fração
 * ideal (#132). O rateio sugerido e o índice da previsão não mudam: o reajuste % é igual para
 * todas as unidades; aqui aparece só a divisão do total mensal entre elas.
 */
export function DistribuicaoFracao({
  resultado,
  condominio,
  arredondamento,
}: {
  resultado: ResultadoPrevisao;
  condominio: Pick<Condominio, "unidades" | "fracaoUnidades"> | null | undefined;
  arredondamento: Arredondamento;
}) {
  const [aberta, setAberta] = useState(false);
  if (!condominio) return null;
  const base = baseDoRateio(condominio);

  if (base.tipo === "unidades")
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Base do rateio: <strong>quantidade de unidades</strong>
        {base.unidades ? ` (${base.unidades})` : ""}. {base.motivo}
      </p>
    );

  const meses = resultado.mesesAnalisados || 12;
  const totalMensal = (resultado.totalAnual / meses) * (1 + (resultado.fundoReservaPct || 0) / 100);
  const d = distribuirRateio(totalMensal, base, arredondamento);

  return (
    <SectionCard
      titulo="Rateio por fração ideal"
      descricao="Base do rateio: fração ideal (fração prevista do cadastro). O reajuste % é o mesmo para todas as unidades; muda só quanto cada uma paga."
    >
      {base.aviso && <p className="mb-3 text-sm text-warning">{base.aviso}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Total mensal com fundo de reserva: <strong className="num">{formatBRL(d.total)}</strong>,
          distribuído entre {d.cotas.length} {d.cotas.length === 1 ? "unidade" : "unidades"}.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={aberta}
          onClick={() => setAberta((v) => !v)}
        >
          <ChevronDown className={cn("transition-transform", aberta && "rotate-180")} />
          {aberta ? "Ocultar cotas por unidade" : "Ver cotas por unidade"}
        </Button>
      </div>
      {d.residuo !== 0 && (
        <p className="mt-2 text-sm text-warning">
          Não foi possível distribuir {formatBRL(Math.abs(d.residuo))} da diferença de
          arredondamento. Confira o total e as frações.
        </p>
      )}
      {aberta && (
        <div className="mt-3 max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Participação</TableHead>
                <TableHead className="text-right">Cota mensal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.cotas.map((c) => (
                <TableRow key={c.unidade}>
                  <TableCell>{c.unidade}</TableCell>
                  <TableCell className="num text-right">
                    {formatNumeroBR(c.percentual, 4)}%
                  </TableCell>
                  <TableCell className="num text-right">{formatBRL(c.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="num text-right">100%</TableCell>
                <TableCell className="num text-right">{formatBRL(d.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
