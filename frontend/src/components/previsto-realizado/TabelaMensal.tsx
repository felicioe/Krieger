import { Fragment } from "react";
import { Link } from "@/components/app/LinkPermitido";
import { SectionCard } from "@/components/app/SectionCard";
import { contagem } from "@/components/app/textos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RolagemTabela } from "@/components/ui/table";
import type { CelulaMensal, ResultadoMensalDetalhado } from "@/domain/previstoRealizadoMensal";
import { formatBRL, formatNumeroBR } from "@/lib/format";

type Opcoes = { orcado: boolean; horizontal: boolean; vertical: boolean };
const percentual = (valor: number | null) => (valor === null ? "—" : `${formatNumeroBR(valor)}%`);
const celula = "num whitespace-nowrap px-3 py-2 text-right";
const grupo = "min-w-32 max-w-48 break-words bg-card px-3 py-2 text-left md:sticky md:left-0";

export function TabelaMensal({
  resultado: r,
  ...opcoes
}: { resultado: ResultadoMensalDetalhado } & Opcoes) {
  const periodo = `${r.meses[0]?.rotulo ?? "—"} a ${r.meses.at(-1)?.rotulo ?? "—"}`;
  const faltantes = r.meses.filter((mes) => mes.relatorios === 0);
  const parcial = faltantes.length > 0;
  if (r.relatoriosUsados === 0) {
    return (
      <SectionCard className="mt-6" titulo="Sem realizado no período" descricao={periodo}>
        <p className="text-sm text-muted-foreground">
          Ainda não há relatório mensal importado ou lançado neste período. A ausência de dados não
          representa despesa zero. Importe os meses para começar a comparação.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/importador">Ir ao Importador</Link>
        </Button>
      </SectionCard>
    );
  }
  const qtd = (opcoes.orcado ? 2 : 1) + (opcoes.horizontal ? 1 : 0) + (opcoes.vertical ? 2 : 0);
  return (
    <>
      {parcial && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            Sem relatório mensal em: {faltantes.map((mes) => mes.rotulo).join(", ")}. O realizado
            acumulado é parcial; meses ausentes aparecem como “Sem dados”, sem variação calculada.
          </AlertDescription>
        </Alert>
      )}
      <SectionCard
        className="mt-6"
        titulo="Conferência mensal"
        descricao={`${periodo} · ${contagem(r.relatoriosUsados, "relatório mensal considerado", "relatórios mensais considerados")}.`}
      >
        <p className="mb-3 text-xs text-muted-foreground">
          H: variação do realizado sobre o previsto. V: participação no total.{" "}
          {parcial && "O total realizado considera somente os meses com relatório."} Role a tabela
          para conferir os meses.
        </p>
        <RolagemTabela className="max-h-[70vh] rounded-md border">
          <table
            className="min-w-max border-collapse text-sm"
            aria-label={`Comparativo mensal de ${periodo}${parcial ? " (realizado parcial)" : ""}`}
          >
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b">
                <th scope="col" rowSpan={2} className={`${grupo} md:z-20`}>
                  Grupo
                </th>
                {r.meses.map((mes) => (
                  <th
                    key={mes.posicao}
                    scope="colgroup"
                    colSpan={qtd}
                    className="border-l px-3 py-2 text-center"
                  >
                    {mes.rotulo}
                    {mes.relatorios === 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        Sem dados
                      </span>
                    )}
                  </th>
                ))}
                <th
                  scope="colgroup"
                  colSpan={opcoes.orcado ? 2 : 1}
                  className="border-l px-3 py-2 text-center"
                >
                  Total do período
                  {parcial && <span className="block text-xs font-normal">Realizado parcial</span>}
                </th>
              </tr>
              <tr className="border-b text-xs text-muted-foreground">
                {r.meses.map((mes) => (
                  <Cabecalhos key={mes.posicao} {...opcoes} />
                ))}
                {opcoes.orcado && (
                  <th scope="col" className="border-l px-3 py-1 text-right">
                    Previsto
                  </th>
                )}
                <th scope="col" className="px-3 py-1 text-right">
                  {parcial ? "Realizado parcial" : "Realizado"}
                </th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((linha) => (
                <tr key={linha.grupo} className="border-b last:border-0">
                  <th scope="row" className={`${grupo} font-medium`}>
                    {linha.grupo}
                  </th>
                  {linha.mensal.map((c, i) => (
                    <Celulas
                      key={r.meses[i]!.posicao}
                      valor={c}
                      temDados={r.meses[i]!.relatorios > 0}
                      {...opcoes}
                    />
                  ))}
                  {opcoes.orcado && (
                    <td className={`${celula} border-l font-medium`}>
                      {formatBRL(linha.total.previsto)}
                    </td>
                  )}
                  <td className={`${celula} font-medium`}>{formatBRL(linha.total.realizado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted font-semibold">
                <th scope="row" className={`${grupo} bg-muted`}>
                  Total
                </th>
                {r.meses.map((mes, i) => {
                  const previsto = r.linhas.reduce(
                    (soma, linha) => soma + linha.mensal[i]!.previsto,
                    0,
                  );
                  const realizado = r.linhas.reduce(
                    (soma, linha) => soma + linha.mensal[i]!.realizado,
                    0,
                  );
                  const totalMes: CelulaMensal = {
                    previsto,
                    realizado,
                    diferenca: realizado - previsto,
                    horizontal: previsto
                      ? ((realizado - previsto) / Math.abs(previsto)) * 100
                      : null,
                    verticalPrevisto: null,
                    verticalRealizado: null,
                  };
                  return (
                    <Celulas
                      key={mes.posicao}
                      valor={totalMes}
                      temDados={mes.relatorios > 0}
                      {...opcoes}
                    />
                  );
                })}
                {opcoes.orcado && (
                  <td className={`${celula} border-l`}>{formatBRL(r.total.previsto)}</td>
                )}
                <td className={celula}>{formatBRL(r.total.realizado)}</td>
              </tr>
            </tfoot>
          </table>
        </RolagemTabela>
      </SectionCard>
    </>
  );
}

function Celulas({
  valor: c,
  temDados,
  orcado,
  horizontal,
  vertical,
}: { valor: CelulaMensal; temDados: boolean } & Opcoes) {
  return (
    <>
      {orcado && <td className={`${celula} border-l`}>{formatBRL(c.previsto)}</td>}
      <td className={`${celula}${orcado ? "" : " border-l"}`}>
        {temDados ? (
          formatBRL(c.realizado)
        ) : (
          <span className="text-muted-foreground">Sem dados</span>
        )}
      </td>
      {horizontal && (
        <td className={`${celula} text-muted-foreground`}>
          {temDados ? percentual(c.horizontal) : "—"}
        </td>
      )}
      {vertical && (
        <>
          <td className={`${celula} text-muted-foreground`}>{percentual(c.verticalPrevisto)}</td>
          <td className={`${celula} text-muted-foreground`}>
            {temDados ? percentual(c.verticalRealizado) : "—"}
          </td>
        </>
      )}
    </>
  );
}

function Cabecalhos({ orcado, horizontal, vertical }: Opcoes) {
  return (
    <Fragment>
      {orcado && (
        <th scope="col" className="border-l px-3 py-1 text-right">
          Previsto
        </th>
      )}
      <th scope="col" className="px-3 py-1 text-right">
        Realizado
      </th>
      {horizontal && (
        <th scope="col" className="px-3 py-1 text-right">
          H %
        </th>
      )}
      {vertical && (
        <>
          <th scope="col" className="px-3 py-1 text-right">
            V prev.
          </th>
          <th scope="col" className="px-3 py-1 text-right">
            V real.
          </th>
        </>
      )}
    </Fragment>
  );
}
