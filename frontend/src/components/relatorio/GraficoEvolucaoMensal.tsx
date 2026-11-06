import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import type { PontoEvolucaoMensal } from "@/domain/relatorioFinal";

const config = {
  receitas: { label: "Receitas", color: "var(--chart-1)" },
  despesas: { label: "Despesas", color: "var(--chart-5)" },
  saldo: { label: "Saldo atual", color: "var(--chart-3)" },
} satisfies ChartConfig;

const eixo = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumeroBR(v / 1000, 0)} mil` : formatNumeroBR(v, 0));

/** Evolução mensal de receitas, despesas e saldo ao longo do exercício. */
export function GraficoEvolucaoMensal({ pontos }: { pontos: PontoEvolucaoMensal[] }) {
  if (pontos.length === 0) return null;
  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <LineChart data={pontos} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={eixo} fontSize={12} width={56} />
        <ChartTooltip
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
        <Line type="monotone" dataKey="receitas" stroke="var(--color-receitas)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="despesas" stroke="var(--color-despesas)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="saldo" stroke="var(--color-saldo)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  );
}
