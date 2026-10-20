import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import type { ResultadoComparativo } from "@/domain/previstoRealizado";

const config = {
  previsto: { label: "Previsto", color: "var(--chart-3)" },
  realizado: { label: "Realizado", color: "var(--chart-1)" },
} satisfies ChartConfig;

const eixo = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumeroBR(v / 1000, 0)} mil` : formatNumeroBR(v, 0));

/** Barras por grupo: previsto × realizado acumulados até o mês escolhido. */
export function GraficoComparativo({ r }: { r: ResultadoComparativo }) {
  const dados = r.grupos.map((g) => ({ grupo: g.nome || "Sem grupo", previsto: g.totais.previsto, realizado: g.totais.realizado }));
  if (dados.length === 0) return null;
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="grupo" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={eixo} width={64} fontSize={12} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(valor, nome) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{config[nome as keyof typeof config]?.label ?? nome}</span>
                  <span className="num font-medium text-foreground">{formatBRL(Number(valor))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="previsto" fill="var(--color-previsto)" radius={[3, 3, 0, 0]} maxBarSize={44} />
        <Bar dataKey="realizado" fill="var(--color-realizado)" radius={[3, 3, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ChartContainer>
  );
}
