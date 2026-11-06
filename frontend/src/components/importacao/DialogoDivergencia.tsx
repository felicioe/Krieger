import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import type { DivergenciaImportacao } from "@/domain/importacao";
import type { Demonstrativo } from "@/domain/types";
import type { DivergenciaPendente } from "./useTravaImportacao";

/**
 * Os quatro totais na ordem do demonstrativo. Valores mudados vêm de `divergenciasImportacao`;
 * os que não mudaram são só exibidos como estão gravados no demonstrativo.
 */
const TOTAIS: {
  campo: DivergenciaImportacao["campo"];
  rotulo: string;
  valor: (d: Demonstrativo) => number;
}[] = [
  { campo: "saldoAnterior", rotulo: "Saldo anterior", valor: (d) => d.saldoAnterior.total },
  { campo: "receitas", rotulo: "Receitas", valor: (d) => d.receitas.subtotal },
  { campo: "despesas", rotulo: "Despesas", valor: (d) => d.despesas.subtotal },
  { campo: "saldoAtual", rotulo: "Saldo atual", valor: (d) => d.saldoAtual.total },
];

type Linha = {
  campo: string;
  rotulo: string;
  importado: number;
  atual: number;
  diferenca: string;
  mudou: boolean;
};

function textoDiferenca(d: DivergenciaImportacao): string {
  if (d.diferencaPct == null) return "mudou (no PDF era zero)";
  return `${d.diferencaPct > 0 ? "+" : ""}${formatNumeroBR(d.diferencaPct, 1)}%`;
}

function linhas(p: DivergenciaPendente): Linha[] {
  return TOTAIS.map((t) => {
    const d = p.divergencias.find((x) => x.campo === t.campo);
    return d
      ? {
          campo: t.campo,
          rotulo: d.rotulo,
          importado: d.importado,
          atual: d.atual,
          diferenca: textoDiferenca(d),
          mudou: true,
        }
      : {
          campo: t.campo,
          rotulo: t.rotulo,
          importado: t.valor(p.importado),
          atual: t.valor(p.atual),
          diferenca: "sem mudança",
          mudou: false,
        };
  });
}

/** Confirmação antes de salvar quando os totais mudaram desde a importação do PDF. */
export function DialogoDivergencia({
  aberto,
  aoMudar,
  pendente,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  pendente: DivergenciaPendente | null;
  aoConfirmar: () => Promise<unknown>;
}) {
  const ls = pendente ? linhas(pendente) : [];
  const nMudou = pendente?.divergencias.length ?? 0;
  return (
    <ConfirmDialog
      aberto={aberto}
      aoMudar={aoMudar}
      titulo="Divergência entre o PDF importado e o demonstrativo atual"
      descricao={
        <div className="space-y-3">
          <p>
            {nMudou === 1 ? "Um total mudou" : `${nMudou} totais mudaram`} desde que o PDF foi
            importado. Confira antes de salvar; suas edições são mantidas nos dois casos.
          </p>
          {/* Tabela a partir de 640 px; abaixo disso, um bloco por total (sem rolagem lateral). */}
          <table className="hidden w-full text-left text-sm sm:table">
            <caption className="sr-only">
              Totais do PDF importado comparados com o demonstrativo atual
            </caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Total
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  PDF importado
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  Atual
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Diferença
                </th>
              </tr>
            </thead>
            <tbody>
              {ls.map((l) => (
                <tr key={l.campo} className="border-b last:border-0">
                  <th
                    scope="row"
                    className={
                      l.mudou
                        ? "py-1.5 pr-3 font-semibold text-foreground"
                        : "py-1.5 pr-3 font-normal"
                    }
                  >
                    {l.rotulo}
                  </th>
                  <td className="num py-1.5 pr-3 text-right whitespace-nowrap">
                    {formatBRL(l.importado)}
                  </td>
                  <td
                    className={
                      l.mudou
                        ? "num py-1.5 pr-3 text-right font-semibold whitespace-nowrap text-foreground"
                        : "num py-1.5 pr-3 text-right whitespace-nowrap"
                    }
                  >
                    {formatBRL(l.atual)}
                  </td>
                  <td
                    className={
                      l.mudou
                        ? "num py-1.5 text-right font-semibold text-foreground"
                        : "py-1.5 text-right"
                    }
                  >
                    {l.diferenca}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="grid gap-2 text-left text-sm sm:hidden">
            {ls.map((l) => (
              <li
                key={l.campo}
                className={
                  l.mudou
                    ? "rounded-md border border-warning/60 bg-warning/10 p-2"
                    : "rounded-md border p-2"
                }
              >
                <p className={l.mudou ? "font-semibold text-foreground" : ""}>
                  {l.rotulo}: {l.diferenca}
                </p>
                <p className="num">
                  PDF {formatBRL(l.importado)} · atual {formatBRL(l.atual)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      }
      rotuloCancelar="Voltar e revisar"
      rotuloConfirmar="Confirmar e salvar"
      aoConfirmar={aoConfirmar}
    />
  );
}
