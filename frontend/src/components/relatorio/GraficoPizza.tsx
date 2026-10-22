import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { corDoGrafico } from "@/components/app/coresGrafico";
import { formatBRL, formatNumeroBR } from "@/lib/format";

/**
 * Pizza da distribuição das despesas por grupo.
 * Cada grupo tem cor própria (sem repetir, qualquer quantidade). A legenda fica abaixo, em lista,
 * com nome, valor e percentual — igual ao PDF/Word —, e o nome quebra linha em vez de ser cortado.
 */
export function GraficoPizza({ dados }: { dados: { nome: string; valor: number }[] }) {
  if (dados.length === 0) return null;
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const pct = (v: number) => `${total ? formatNumeroBR((v / total) * 100, 1) : "0"}%`;
  const config = Object.fromEntries(
    dados.map((d, i) => [d.nome, { label: d.nome, color: corDoGrafico(i) }]),
  ) satisfies ChartConfig;
  return (
    <div className="@container">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 230 }}>
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="nome"
                formatter={(valor, nome) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{nome}</span>
                    <span className="num font-medium text-foreground">
                      {formatBRL(Number(valor))} · {pct(Number(valor))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={100} strokeWidth={2}>
            {dados.map((d, i) => (
              // Cada fatia é exposta como imagem: o nome e o valor dão a ela um nome acessível.
              <Cell key={d.nome} fill={corDoGrafico(i)} aria-label={`${d.nome}: ${formatBRL(d.valor)} (${pct(d.valor)})`} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs @lg:grid-cols-2" aria-label="Legenda: despesas por grupo">
        {dados.map((d, i) => (
          <li key={d.nome} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 size-3 shrink-0 rounded-[3px]" style={{ backgroundColor: corDoGrafico(i) }} />
            <span className="min-w-0 flex-1 break-words text-foreground">{d.nome}</span>
            <span className="num shrink-0 text-right text-muted-foreground">
              {formatBRL(d.valor)} · {pct(d.valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
