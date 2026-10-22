import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { corDoGrafico } from "@/components/app/coresGrafico";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBRL, formatNumeroBR } from "@/lib/format";

/**
 * Pizza da distribuição das despesas por grupo.
 * Cada grupo tem cor própria (sem repetir, qualquer quantidade) e a altura cresce
 * com o número de grupos para a legenda, que quebra linha, não espremer a pizza.
 */
export function GraficoPizza({ dados }: { dados: { nome: string; valor: number }[] }) {
  const movel = useIsMobile();
  if (dados.length === 0) return null;
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const config = Object.fromEntries(
    dados.map((d, i) => [d.nome, { label: d.nome, color: corDoGrafico(i) }]),
  ) satisfies ChartConfig;
  const linhasLegenda = movel ? dados.length : Math.ceil(dados.length / 3);
  const altura = 250 + linhasLegenda * 24;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: altura }}>
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="nome"
              formatter={(valor, nome) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{nome}</span>
                  <span className="num font-medium text-foreground">
                    {formatBRL(Number(valor))} ·{" "}
                    {total ? formatNumeroBR((Number(valor) / total) * 100, 1) : "0"}%
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={dados}
          dataKey="valor"
          nameKey="nome"
          innerRadius={50}
          outerRadius={100}
          strokeWidth={2}
        >
          {dados.map((d, i) => (
            <Cell key={d.nome} fill={corDoGrafico(i)} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="nome" />} />
      </PieChart>
    </ChartContainer>
  );
}
