import type { ReactNode } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Onde cada aviso do cálculo deve aparecer na tela. Os textos vêm prontos do cálculo da previsão;
 * aqui só se escolhe o lugar (campo ou ação) pelo assunto do texto. Aviso que não se encaixa em
 * nenhum assunto continua aparecendo no quadro geral.
 */
export type TipoAviso = "unidades" | "variacao" | "indices" | "despesas" | "geral";

export function tipoAviso(texto: string): TipoAviso {
  const t = texto.toLowerCase();
  if (t.includes("unidades")) return "unidades";
  if (t.includes("índice")) return "indices";
  if (t.includes("variação")) return "variacao";
  if (t.includes("despesas") || t.includes("demonstrativo")) return "despesas";
  return "geral";
}

export type ItemAviso = { texto: string; acao?: ReactNode };

/**
 * Quadro no topo da previsão. `parcial` = falta algo para chegar ao valor por unidade
 * (o cálculo devolveu vazio); sem `parcial`, os avisos são pontos a conferir num resultado já calculado.
 * Anuncia mudanças com educação (role="status"), sem interromper a digitação.
 */
export function QuadroAvisos({
  itens,
  parcial,
  id,
}: {
  itens: ItemAviso[];
  parcial: boolean;
  id: string;
}) {
  if (itens.length === 0 && !parcial) return null;
  return (
    <section
      id={id}
      role="status"
      aria-labelledby={`${id}-titulo`}
      className="rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <h2 id={`${id}-titulo`} className="font-semibold">
            {parcial
              ? "Resultado parcial: o valor por unidade ainda não foi calculado"
              : "Confira antes de usar este resultado"}
          </h2>
          {itens.length > 0 && (
            <ul className="space-y-2">
              {itens.map((a) => (
                <li key={a.texto} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span>{a.texto}</span>
                  {a.acao}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Linha de situação no topo do resumo: completo, completo com pontos a conferir, ou parcial. */
export function SituacaoResultado({
  parcial,
  avisos,
  idQuadro,
}: {
  parcial: boolean;
  avisos: number;
  idQuadro: string;
}) {
  const ok = !parcial && avisos === 0;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
        ok
          ? "bg-success/10 text-foreground"
          : "border border-warning bg-warning/10 text-warning-foreground",
      )}
    >
      {ok ? (
        <CircleCheck className="mt-px size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {ok ? (
          "Cálculo completo."
        ) : (
          <>
            <strong className="font-semibold">
              {parcial ? "Resultado parcial." : "Cálculo feito, com pontos a conferir."}
            </strong>{" "}
            <AcaoAviso onClick={() => irPara(idQuadro)}>
              {avisos === 1
                ? "Ver o aviso"
                : avisos > 1
                  ? `Ver os ${avisos} avisos`
                  : "Ver o que falta"}
            </AcaoAviso>
          </>
        )}
      </span>
    </div>
  );
}

/** Rola até o elemento e leva o foco a ele (sem âncora "#", que trocaria a rota em "#/..."). */
export function irPara(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
}

/** Valor ausente: traço visível, "não calculado" para o leitor de tela. */
export function SemValor({ motivo = "não calculado" }: { motivo?: string | undefined }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{motivo}</span>
    </>
  );
}

/** Botão-link pequeno usado como ação de um aviso. */
export function AcaoAviso({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11 pointer-coarse:min-h-11"
    >
      {children}
    </button>
  );
}
