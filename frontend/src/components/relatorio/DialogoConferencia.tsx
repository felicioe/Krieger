import { useState } from "react";
import { CircleCheck, CircleX, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Formato } from "@/lib/documento/baixar";
import type { RelatorioFinal, SituacaoConferencia } from "@/domain/relatorioFinal";

const ICONE: Record<SituacaoConferencia, typeof CircleCheck> = { ok: CircleCheck, aviso: TriangleAlert, erro: CircleX };
const COR: Record<SituacaoConferencia, string> = { ok: "text-success", aviso: "text-warning-foreground", erro: "text-destructive" };

/** Resumo de conferência dos totais, mostrado antes de emitir. */
export function DialogoConferencia({
  aberto,
  aoMudar,
  rel,
  aoEmitir,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  rel: RelatorioFinal;
  aoEmitir: (formato: Formato) => Promise<unknown>;
}) {
  const [ocupado, setOcupado] = useState<Formato | null>(null);
  const erros = rel.conferencia.filter((c) => c.situacao === "erro").length;
  const avisos = rel.conferencia.filter((c) => c.situacao === "aviso").length;
  const t = rel.demonstrativo?.totais;

  async function emitir(formato: Formato) {
    setOcupado(formato);
    try {
      await aoEmitir(formato);
      aoMudar(false);
    } catch {
      /* o erro aparece no aviso global */
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !ocupado && aoMudar(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conferência antes de emitir</DialogTitle>
          <DialogDescription>
            {erros || avisos
              ? `${erros ? `${erros} problema(s)` : ""}${erros && avisos ? " e " : ""}${avisos ? `${avisos} ponto(s) de atenção` : ""}. Revise antes de emitir.`
              : "Tudo confere. Revise os totais e emita."}
          </DialogDescription>
        </DialogHeader>

        {t && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Saldo anterior", t.saldoAnterior],
              ["Receitas", t.receitas],
              ["Despesas", t.despesas],
              ["Saldo atual", t.saldoAtual],
            ].map(([r, v]) => (
              <div key={r as string} className="rounded-md border px-3 py-2">
                <div className="text-xs text-muted-foreground">{r}</div>
                <div className="num font-semibold text-primary">{formatBRL(v as number)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Anual ajustado", rel.previsao.totalAnual],
            ["Valor por unidade", rel.previsao.rateioSugerido],
            ["Previsto até o mês", rel.comparativo.total.previsto],
            ["Realizado até o mês", rel.comparativo.total.realizado],
          ].map(([r, v]) => (
            <div key={r as string} className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">{r}</div>
              <div className="num font-semibold">{formatBRL(v as number | null)}</div>
            </div>
          ))}
        </div>

        <ul className="divide-y rounded-md border">
          {rel.conferencia.map((c) => {
            const Icone = ICONE[c.situacao];
            return (
              <li key={c.titulo} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <Icone className={cn("mt-0.5 size-4 shrink-0", COR[c.situacao])} aria-label={c.situacao} />
                <div>
                  <div className="font-medium">{c.titulo}</div>
                  <div className="text-muted-foreground">{c.detalhe}</div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Emitir salva o relatório, registra a data e quem emitiu e baixa o arquivo no formato escolhido.
        </p>

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => aoMudar(false)} disabled={!!ocupado}>
            Voltar e revisar
          </Button>
          <Button variant="outline" type="button" onClick={() => emitir("docx")} disabled={!!ocupado}>
            {ocupado === "docx" && <Loader2 className="animate-spin" />}
            {erros ? "Emitir Word mesmo assim" : "Emitir em Word"}
          </Button>
          <Button type="button" onClick={() => emitir("pdf")} disabled={!!ocupado}>
            {ocupado === "pdf" && <Loader2 className="animate-spin" />}
            {erros ? "Emitir PDF mesmo assim" : "Emitir em PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
