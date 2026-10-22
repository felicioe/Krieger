import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import type { DivergenciaImportacao } from "@/domain/importacao";

/** Confirmação antes de salvar quando os totais mudaram desde a importação do PDF. */
export function DialogoDivergencia({
  aberto,
  aoMudar,
  divergencias,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  divergencias: DivergenciaImportacao[];
  aoConfirmar: () => Promise<unknown>;
}) {
  return (
    <ConfirmDialog
      aberto={aberto}
      aoMudar={aoMudar}
      titulo="Divergência entre o PDF importado e o demonstrativo atual"
      descricao={
        <div className="space-y-2">
          <p>Estes valores mudaram desde que o PDF foi importado. Confira antes de salvar:</p>
          <ul className="list-disc pl-5">
            {divergencias.map((d) => (
              <li key={d.campo}>
                {d.rotulo}: PDF <span className="num">{formatBRL(d.importado)}</span> → atual{" "}
                <span className="num">{formatBRL(d.atual)}</span>
                {d.diferencaPct != null &&
                  ` (${d.diferencaPct > 0 ? "+" : ""}${formatNumeroBR(d.diferencaPct, 1)}%)`}
              </li>
            ))}
          </ul>
        </div>
      }
      rotuloConfirmar="Confirmar e salvar"
      aoConfirmar={aoConfirmar}
    />
  );
}
