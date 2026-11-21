import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DinheiroInput, InteiroInput } from "@/components/app/inputs";
import { RepeatableList } from "@/components/app/RepeatableList";
import { formatBRL } from "@/lib/format";
import {
  avisosDaLinhaRateio,
  formatarPercentualCompleto,
  linhaRateioAlterada,
  linhaRateioNova,
  parsePercentualCompleto,
  percentualEmUsoDaLinha,
  variacaoCompleta,
  type LinhaRateioForm,
} from "@/domain/historicoRateio";
import type { PrevisaoAprovada } from "@/domain/types";

/**
 * Histórico de rateios no cadastro do condomínio, ao lado dos índices de correção (issue #297).
 * Alterações e exclusões são gravadas ao salvar o cadastro. O % informado vale mais que o calculado;
 * a sugestão com todas as casas decimais fica à mão (botão "Usar") para não perder precisão ao digitar.
 */
export function HistoricoRateiosCondominio({
  condoId,
  linhas,
  iniciais,
  onChange,
  desabilitado,
  erros,
  previsoes,
  exerciciosFechados,
}: {
  condoId: string;
  linhas: LinhaRateioForm[];
  iniciais: LinhaRateioForm[];
  onChange: (linhas: LinhaRateioForm[]) => void;
  desabilitado: boolean;
  /** Erros por linha (mesma ordem); null antes da primeira tentativa de salvar. */
  erros: (string | null)[] | null;
  previsoes: PrevisaoAprovada[];
  exerciciosFechados: { condoId: string; ano: number | string }[];
}) {
  const inicialDe = (l: LinhaRateioForm) => iniciais.find((i) => i.idExistente === l.idExistente);
  const inalterada = (l: LinhaRateioForm) => {
    const i = l.idExistente ? inicialDe(l) : undefined;
    return !!i && !linhaRateioAlterada(i, l);
  };
  const avisos = linhas.flatMap((l) =>
    avisosDaLinhaRateio(
      l.ano,
      percentualEmUsoDaLinha(l, inalterada(l)).valor,
      previsoes,
      exerciciosFechados,
      condoId,
    ).map((a) => `${l.ano}: ${a}`),
  );

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Rateio atual (do ano anterior) e rateio aprovado de cada ano. O previsto do ano seguinte usa
        o % da linha: o <strong>% informado vale mais que o calculado</strong>. Alterações e
        exclusões são gravadas ao salvar o cadastro.
      </p>
      <fieldset disabled={desabilitado} className="min-w-0">
        <RepeatableList
          itens={linhas}
          onChange={onChange}
          novo={() =>
            linhaRateioNova(
              (linhas.reduce((m, l) => Math.max(m, l.ano ?? 0), 0) ||
                new Date().getFullYear() - 1) + 1,
            )
          }
          reordenavel={false}
          colunas="grid-cols-1 @min-[12rem]:grid-cols-2 @2xl:grid-cols-[6rem_9rem_9rem_9rem_minmax(0,1fr)]"
          cabecalhos={[
            "Ano",
            "Rateio atual",
            "Rateio aprovado",
            "% informado",
            "% em uso e sugestões",
          ]}
          rotuloAdicionar="Adicionar ano"
          vazio="Nenhum rateio registrado."
          render={(l, up, i) => {
            const emUso = percentualEmUsoDaLinha(l, inalterada(l));
            const calculado = variacaoCompleta(l.rateioAtual, l.rateioAprovado);
            const doSugerido = variacaoCompleta(l.rateioAtual, l.rateioSugerido);
            const informado = parsePercentualCompleto(l.textoPercentual);
            const usar = (v: number | null) =>
              v !== null && up({ textoPercentual: formatarPercentualCompleto(v) });
            const erro = erros?.[i] ?? null;
            return (
              <>
                <InteiroInput
                  aria-label="Ano"
                  maxLength={4}
                  value={l.ano}
                  onChange={(v) => up({ ano: v })}
                  aria-invalid={erro ? true : undefined}
                />
                <DinheiroInput
                  aria-label="Rateio atual"
                  value={l.rateioAtual}
                  onChange={(v) => up({ rateioAtual: v })}
                />
                <DinheiroInput
                  aria-label="Rateio aprovado"
                  value={l.rateioAprovado}
                  onChange={(v) => up({ rateioAprovado: v })}
                  aria-invalid={erro ? true : undefined}
                />
                <Input
                  aria-label="% informado"
                  value={l.textoPercentual}
                  onChange={(e) =>
                    up({ textoPercentual: e.target.value.replace(/[^\d.,%-]/g, "") })
                  }
                  onBlur={() => informado !== null && usar(informado)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="vazio = calculado"
                  className="num text-right"
                />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex flex-wrap items-center gap-2">
                    {(emUso.valor === null || emUso.valor === 0) && (
                      <TriangleAlert
                        className="size-4 text-warning-foreground"
                        aria-label="Conferir o percentual"
                      />
                    )}
                    <span className="num text-sm text-foreground">
                      {emUso.valor === null ? "—" : `${formatarPercentualCompleto(emUso.valor)}%`}
                    </span>
                    <Badge variant={emUso.origem === "informado" ? "default" : "secondary"}>
                      {emUso.origem === "informado" ? "Informado" : "Calculado"}
                    </Badge>
                  </p>
                  {calculado !== null && calculado !== informado && (
                    <p className="flex flex-wrap items-center gap-2">
                      Calculado dos rateios:{" "}
                      <span className="num">{formatarPercentualCompleto(calculado)}%</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => usar(calculado)}
                      >
                        Usar
                      </Button>
                    </p>
                  )}
                  {doSugerido !== null && (
                    <p className="flex flex-wrap items-center gap-2">
                      Sugestão do sistema ({formatBRL(l.rateioSugerido ?? 0)}):{" "}
                      <span className="num">{formatarPercentualCompleto(doSugerido)}%</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => usar(doSugerido)}
                      >
                        Usar
                      </Button>
                    </p>
                  )}
                  {erro && (
                    <p className="text-destructive" role="alert">
                      {erro}
                    </p>
                  )}
                </div>
              </>
            );
          }}
        />
      </fieldset>
      {avisos.length > 0 && (
        <ul
          className="mt-3 space-y-1 text-sm text-muted-foreground"
          aria-label="Avisos do histórico de rateios"
        >
          {avisos.map((a) => (
            <li key={a} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" /> {a}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
