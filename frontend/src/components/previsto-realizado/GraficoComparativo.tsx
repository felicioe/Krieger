import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBRL, formatNumeroBR, formatValorCurto } from "@/lib/format";
import type { ResultadoComparativo } from "@/domain/previstoRealizado";

const config = {
  previsto: { label: "Previsto", color: "var(--chart-3)" },
  realizado: { label: "Realizado", color: "var(--chart-1)" },
} satisfies ChartConfig;

const eixo = (v: number) =>
  Math.abs(v) >= 1000 ? `${formatNumeroBR(v / 1000, 0)} mil` : formatNumeroBR(v, 0);

const FONTE = 12;
const MAX_LINHAS = 3;
/** Altura de cada grupo: duas barras e o respiro, ou o rótulo de 3 linhas, o que for maior. */
const ALTURA_GRUPO = 48;

const FONTE_MIN = 9;
let contexto: CanvasRenderingContext2D | null | undefined;

/** Largura real do texto na fonte do sistema (sem navegador, estima 0,62 em por caractere). */
function medir(texto: string, fonte: number): number {
  if (contexto === undefined)
    contexto =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!contexto) return texto.length * fonte * 0.62;
  contexto.font = `${fonte}px "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif`;
  return contexto.measureText(texto).width;
}

/** Quebra o nome do grupo em até 3 linhas que cabem na largura do eixo (o nome inteiro fica no tooltip). */
function quebrarRotulo(texto: string, largura: number, fonte: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    if (!atual) atual = p;
    else if (medir(`${atual} ${p}`, fonte) <= largura) atual += ` ${p}`;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > MAX_LINHAS) {
    let ultima = linhas.slice(MAX_LINHAS - 1).join(" ");
    while (ultima.length > 1 && medir(`${ultima}…`, fonte) > largura) ultima = ultima.slice(0, -1);
    linhas.splice(MAX_LINHAS - 1, linhas.length, `${ultima.trimEnd()}…`);
  }
  return linhas;
}

function RotuloGrupo(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
  largura: number;
}) {
  const { x = 0, y = 0, payload, largura } = props;
  const nome = payload?.value ?? "";
  const util = largura - 10;
  // Uma palavra sozinha mais larga que o eixo (ex.: "ADMINISTRATIVAS" no celular) reduz a fonte desse rótulo, sem cortar.
  const maiorPalavra = Math.max(0, ...nome.split(/\s+/).map((p) => medir(p, FONTE)));
  const fonte =
    maiorPalavra > util ? Math.max(FONTE_MIN, Math.floor((FONTE * util) / maiorPalavra)) : FONTE;
  const linhas = quebrarRotulo(nome, util, fonte);
  const passo = fonte + 2;
  const inicio = y - ((linhas.length - 1) * passo) / 2;
  return (
    <text x={x - 6} y={inicio} textAnchor="end" dominantBaseline="central" fontSize={fonte} className="fill-foreground">
      <title>{nome}</title>
      {linhas.map((l, i) => (
        <tspan key={i} x={x - 6} dy={i === 0 ? 0 : passo}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** Valor curto na ponta da barra (zero aparece como "0", não como vazio); o exato fica no tooltip e na tabela. */
function ValorNaBarra(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string }) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const w = Number(props.width ?? 0);
  const h = Number(props.height ?? 0);
  const v = Number(props.value ?? 0);
  // Ponta direita da barra: o fim, se positiva; o eixo zero, se negativa (não invade os nomes dos grupos).
  const pos = Math.max(x, x + w) + 4;
  return (
    <text x={pos} y={y + h / 2} dominantBaseline="central" fontSize={11} className="fill-foreground num" aria-hidden>
      {formatValorCurto(v)}
    </text>
  );
}

/**
 * Barras horizontais por grupo: previsto × realizado acumulados até o mês escolhido.
 * Os grupos ficam no eixo vertical, então qualquer quantidade e qualquer tamanho de nome
 * cabem — o gráfico só cresce em altura.
 */
export function GraficoComparativo({ r }: { r: ResultadoComparativo }) {
  const movel = useIsMobile();
  const dados = r.grupos.map((g) => ({
    grupo: g.nome || "Sem grupo",
    previsto: g.totais.previsto,
    realizado: g.totais.realizado,
  }));
  if (dados.length === 0) return null;
  const larguraRotulo = movel ? 120 : 168;
  const altura = dados.length * ALTURA_GRUPO + 72;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: altura }}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 4, right: movel ? 52 : 64, left: 4, bottom: 0 }}
        barCategoryGap="22%"
        barGap={2}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={eixo}
          fontSize={FONTE}
        />
        <YAxis
          type="category"
          dataKey="grupo"
          width={larguraRotulo}
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={<RotuloGrupo largura={larguraRotulo} />}
        />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(valor, nome) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[nome as keyof typeof config]?.label ?? nome}
                  </span>
                  <span className="num font-medium text-foreground">
                    {formatBRL(Number(valor))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="previsto"
          fill="var(--color-previsto)"
          radius={[0, 3, 3, 0]}
          maxBarSize={16}
        >
          <LabelList dataKey="previsto" content={<ValorNaBarra />} />
        </Bar>
        <Bar
          dataKey="realizado"
          fill="var(--color-realizado)"
          radius={[0, 3, 3, 0]}
          maxBarSize={16}
        >
          <LabelList dataKey="realizado" content={<ValorNaBarra />} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
