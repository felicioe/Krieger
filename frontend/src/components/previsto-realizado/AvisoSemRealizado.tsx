import { CalendarClock } from "lucide-react";
import type { ResultadoComparativo } from "@/domain/previstoRealizado";
import { textoSemRealizado } from "./semRealizado";

/** Mensagem no lugar da tabela e das barras quando o período comparado não tem relatório mensal. */
export function AvisoSemRealizado({ r }: { r: ResultadoComparativo }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm">
      <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="min-w-0 text-foreground">{textoSemRealizado(r)}</p>
    </div>
  );
}
