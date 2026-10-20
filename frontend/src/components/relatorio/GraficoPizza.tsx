import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatBRL, formatNumeroBR } from "@/lib/format";

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Pizza da distribuição das despesas por grupo. */
export function GraficoPizza({ dados }: { dados: { nome: string; valor: number }[] }) {
  if (dados.length === 0) return null;
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const config = Object.fromEntries(
    dados.map((d, i) => [d.nome, { label: d.nome, color: CORES[i % CORES.length] as string }]),
  ) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="nome"
              formatter={(valor, nome) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{nome}</span>
                  <span className="num font-medium text-foreground">
                    {formatBRL(Number(valor))} · {total ? formatNumeroBR((Number(valor) / total) * 100, 1) : "0"}%
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={100} strokeWidth={2}>
          {dados.map((d, i) => (
            <Cell key={d.nome} fill={CORES[i % CORES.length]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="nome" />} />
      </PieChart>
    </ChartContainer>
  );
}
