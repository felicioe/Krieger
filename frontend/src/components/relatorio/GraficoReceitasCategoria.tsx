import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { corDoGrafico } from "@/components/app/coresGrafico";
import { cn } from "@/lib/utils";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import type { SerieReceita } from "@/domain/relatorioFinal";

const eixo = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumeroBR(v / 1000, 1)} mil` : formatNumeroBR(v, 0));

/**
 * Evolução mensal de cada categoria de receita — um mini-gráfico por categoria, cada um com sua
 * própria escala. A Taxa condominial costuma ser bem maior que as outras receitas (multas,
 * rendimentos de aplicação etc.); numa única escala compartilhada, as menores viravam uma linha
 * quase reta no rodapé — escala própria por categoria resolve isso (small multiples).
 */
export function GraficoReceitasCategoria({ series }: { series: SerieReceita[] }) {
  if (series.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
      {series.map((s, i) => (
        <MiniGrafico key={s.nome} serie={s} cor={corDoGrafico(i)} />
      ))}
    </div>
  );
}

function MiniGrafico({ serie, cor }: { serie: SerieReceita; cor: string }) {
  const config = { valor: { label: serie.nome, color: cor } } satisfies ChartConfig;
  const ultimo = serie.pontos[serie.pontos.length - 1];
  const anterior = serie.pontos[serie.pontos.length - 2];
  const variacao = ultimo && anterior && anterior.valor !== 0 ? ((ultimo.valor - anterior.valor) / anterior.valor) * 100 : null;

  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5 text-xs font-semibold text-foreground">
          <span className="mt-0.5 size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: cor }} aria-hidden="true" />
          <span className="break-words">{serie.nome}</span>
        </div>
        {ultimo && (
          <div className="shrink-0 text-right">
            <div className="num text-sm font-semibold text-foreground">{formatBRL(ultimo.valor)}</div>
            {variacao !== null && (
              <div className={cn("num text-[10px]", variacao >= 0 ? "text-success" : "text-destructive")}>
                {variacao >= 0 ? "+" : ""}
                {formatNumeroBR(variacao, 1)}% vs. {anterior!.mes}
              </div>
            )}
          </div>
        )}
      </div>
      <ChartContainer config={config} className="aspect-auto h-[110px] w-full">
        <LineChart data={serie.pontos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={9} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tickFormatter={eixo} fontSize={9} width={42} domain={["auto", "auto"]} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(valor) => <span className="num font-medium text-foreground">{formatBRL(Number(valor))}</span>}
              />
            }
          />
          <Line type="monotone" dataKey="valor" stroke={cor} strokeWidth={2} dot={{ r: 2.5 }} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
