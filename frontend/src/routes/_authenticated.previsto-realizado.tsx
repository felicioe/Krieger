import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { PercentualInput, Selecao } from "@/components/app/inputs";
import { GraficoComparativo } from "@/components/previsto-realizado/GraficoComparativo";
import { SituacaoBadge, TabelaComparativo, pctTexto } from "@/components/previsto-realizado/TabelaComparativo";
import { AvisoSemRealizado } from "@/components/previsto-realizado/AvisoSemRealizado";
import { periodoComparacao, semRealizado } from "@/components/previsto-realizado/semRealizado";
import { itemQuery, listaQuery } from "@/lib/queries";
import { BotaoDocumento } from "@/components/documentos/BotaoDocumento";
import { documentoPrevistoRealizado } from "@/documentos/previstoRealizado";
import { formatBRL } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { cn } from "@/lib/utils";
import { normalizarExercicio } from "@/domain/exercicio";
import { compararPrevistoRealizado, TOLERANCIA_PADRAO, type Totais } from "@/domain/previstoRealizado";
import type { Condominio, ConfigEscritorio, Exercicio, Mensal } from "@/domain/types";
import { contagem } from "@/components/app/textos";

type Busca = { exercicio?: string; ate?: number };

export const Route = createFileRoute("/_authenticated/previsto-realizado")({
  head: () => cabecalho("Previsto × Realizado", "Comparativo entre o orçamento previsto e o realizado."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const ate = Number(s["ate"]);
    const exercicio = s["exercicio"];
    return {
      ...(typeof exercicio === "string" && exercicio ? { exercicio } : {}),
      ...(Number.isInteger(ate) && ate >= 1 && ate <= 12 ? { ate } : {}),
    };
  },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]),
  component: PaginaComparativo,
});

function PaginaComparativo() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/previsto-realizado" });
  const { data: exerciciosRaw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [tolerancia, setTolerancia] = useState<number | null>(TOLERANCIA_PADRAO);
  const [mostrarAnaliticas, setMostrarAnaliticas] = useState(true);

  const exercicios = useMemo(
    () =>
      exerciciosRaw
        .map((e) => normalizarExercicio(e))
        .sort((a, b) => Number(b.ano) - Number(a.ano) || a.condoNome.localeCompare(b.condoNome, "pt-BR")),
    [exerciciosRaw],
  );
  const exercicio = exercicios.find((e) => e.id === busca.exercicio) ?? exercicios[0];
  const condo = exercicio ? condominios.find((c) => c.id === exercicio.condoId) : undefined;

  const r = useMemo(
    () =>
      exercicio
        ? compararPrevistoRealizado(exercicio, mensais, { condominio: condo ?? null, mesAte: busca.ate ?? null, tolerancia })
        : null,
    [exercicio, mensais, condo, busca.ate, tolerancia],
  );

  const cabeca = (
    <PageHeader
      titulo="Previsto × Realizado"
      descricao="Previsão orçamentária do exercício (já com os ajustes) comparada ao realizado acumulado nos relatórios mensais do exercício seguinte."
    />
  );

  if (!exercicio || !r) {
    return (
      <>
        {cabeca}
        <SectionCard titulo="Nenhuma previsão disponível">
          <p className="text-sm text-muted-foreground">
            Crie uma prestação de contas com a previsão orçamentária para comparar com o realizado.
          </p>
          <Button asChild className="mt-4">
            <Link to="/prestacao-contas">Ir para Prestação de contas</Link>
          </Button>
        </SectionCard>
      </>
    );
  }

  const opcoesExercicio = exercicios.map((e) => ({
    valor: e.id,
    rotulo: `${e.condoNome || condominios.find((c) => c.id === e.condoId)?.nome || "Sem condomínio"} · previsão ${e.ano} → ${Number(e.ano) + 1}`,
  }));
  const opcoesMes = r.meses.map((m) => ({
    valor: String(m.posicao),
    rotulo: `${m.rotulo}${m.relatorios === 0 ? " (sem relatório)" : ""}`,
  }));
  const ate = r.mesAte.rotulo;
  const mesesTexto = r.mesAte.posicao === 1 ? "1 mês" : `${r.mesAte.posicao} meses`;
  const semDados = semRealizado(r);

  return (
    <>
      <PageHeader
        titulo="Previsto × Realizado"
        descricao="Previsão orçamentária do exercício (já com os ajustes) comparada ao realizado acumulado nos relatórios mensais do exercício seguinte."
        acoes={
          <BotaoDocumento
            rotulo="Gerar comparativo"
            gerar={() => documentoPrevistoRealizado({ comparativo: r, exercicio, condominio: condo ?? null, escritorio })}
          />
        }
      />

      <SectionCard titulo="Parâmetros">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field rotulo="Previsão (prestação de contas)" className="sm:col-span-3">
            <Selecao value={exercicio.id} onChange={(id) => navigate({ search: { exercicio: id }, replace: true })} opcoes={opcoesExercicio} />
          </Field>
          <Field rotulo="Acumulado até" dica={`${r.meses[0]!.rotulo} a ${ate} · ${mesesTexto}`} className="sm:col-span-2">
            <Selecao
              value={String(r.mesAte.posicao)}
              onChange={(v) => navigate({ search: { exercicio: exercicio.id, ate: Number(v) }, replace: true })}
              opcoes={opcoesMes}
            />
          </Field>
          <Field rotulo="Tolerância" dica="Faixa considerada “dentro”." className="sm:col-span-1">
            <PercentualInput value={tolerancia} onChange={setTolerancia} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {r.relatoriosUsados === 0 ? "Nenhum relatório mensal somado ainda." : `${contagem(r.relatoriosUsados, "relatório mensal somado", "relatórios mensais somados")}.`}{" "}
          <Link to="/previsao-orcamentaria" search={{ exercicio: exercicio.id }} className="text-primary underline-offset-2 hover:underline">
            Abrir a previsão do exercício {exercicio.ano}
          </Link>
        </p>
      </SectionCard>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Previsto anual" valor={formatBRL(r.total.previstoAnual)} detalhe={`${formatBRL(r.total.previstoMensal)} por mês`} />
        <Indicador rotulo={`Previsto até ${ate}`} valor={formatBRL(r.total.previsto)} detalhe={mesesTexto} />
        <Indicador
          rotulo={`Realizado até ${ate}`}
          valor={semDados ? "—" : formatBRL(r.total.realizado)}
          detalhe={semDados ? "nenhum relatório mensal" : contagem(r.relatoriosUsados, "relatório mensal", "relatórios mensais")}
        />
        {semDados ? <Indicador rotulo="Diferença" valor="—" detalhe="sem realizado para comparar" /> : <IndicadorDiferenca t={r.total} />}
      </div>

      {r.avisos.length > 0 && (
        <Alert variant="warning" className="mt-6">
          <TriangleAlert />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {r.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 space-y-6">
        {semDados && r.grupos.length > 0 ? (
          <SectionCard titulo="Por grupo e rubrica" descricao={`Período de comparação: ${periodoComparacao(r)}.`}>
            <AvisoSemRealizado r={r} />
          </SectionCard>
        ) : (
          <>
            <SectionCard titulo="Por grupo" descricao={`Previsto e realizado acumulados até ${ate}.`}>
              <GraficoComparativo r={r} />
            </SectionCard>

            <SectionCard
              titulo="Por rubrica"
              descricao={`Diferença = realizado − previsto até ${ate}. Tolerância de ${pctTexto(r.tolerancia).replace("+", "")}.`}
              acoes={
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mostrar-analiticas"
                    checked={mostrarAnaliticas}
                    onCheckedChange={(v) => setMostrarAnaliticas(v === true)}
                  />
                  <Label htmlFor="mostrar-analiticas" className="text-sm font-normal text-muted-foreground">
                    Mostrar contas analíticas
                  </Label>
                </div>
              }
            >
              <TabelaComparativo r={r} mostrarAnaliticas={mostrarAnaliticas} />
            </SectionCard>
          </>
        )}

        {r.deduzidas.length > 0 && (
          <SectionCard titulo="Fora da comparação" descricao="Despesas retiradas pela dedução da previsão (ex.: fundo de obras).">
            <ul className="divide-y text-sm">
              {r.deduzidas.map((d) => (
                <li key={`${d.grupo}-${d.nome}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                  <span className="min-w-0">
                    {d.nome} <span className="text-xs text-muted-foreground">· {d.grupo}</span>
                  </span>
                  <span className="num text-muted-foreground sm:whitespace-nowrap">{semDados ? "Sem relatório mensal no período" : `Realizado até ${ate}: ${formatBRL(d.realizado)}`}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </>
  );
}

function Indicador({ rotulo, valor, detalhe, className }: { rotulo: string; valor: string; detalhe?: string; className?: string }) {
  return (
    <div className={cn("min-w-0 break-words rounded-md border bg-card px-4 py-4 sm:px-5 shadow-sm", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="num mt-1 text-xl font-semibold text-primary">{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

function IndicadorDiferenca({ t }: { t: Totais }) {
  return (
    <div className="min-w-0 break-words rounded-md border bg-card px-4 py-4 sm:px-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Diferença</span>
        <SituacaoBadge situacao={t.situacao} />
      </div>
      <div className={cn("num mt-1 text-xl font-semibold", t.situacao === "acima" ? "text-destructive" : "text-primary")}>
        {t.diferenca > 0 ? "+" : ""}
        {formatBRL(t.diferenca)}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{pctTexto(t.pct)} sobre o previsto</div>
    </div>
  );
}
