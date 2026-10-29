import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calculator,
  ChevronRight,
  FileSpreadsheet,
  FlameKindling,
  Megaphone,
  ShieldCheck,
  SquareCheckBig,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable } from "@/components/app/DataTable";
import { itemQuery, listaQuery } from "@/lib/queries";
import { dataParaBR, formatData } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import {
  backupAtrasado,
  calcularPendenciasAjuste,
  calcularVencimentos,
  diasDesdeBackup,
  proximasAssembleias,
  type PendenciaAjuste,
  type TipoVencimento,
} from "@/domain/painel";
import type { Assembleia, Condominio, ConfigBackup, Exercicio } from "@/domain/types";
import { haDias, prazoDias } from "@/components/app/textos";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => cabecalho("Painel", "Visão geral dos condomínios, vencimentos e próximas assembleias."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
      queryClient.ensureQueryData(itemQuery<ConfigBackup>("config", "backup")),
    ]),
  component: Painel,
});

const TIPO_ASSEMBLEIA = { ordinaria: "Ordinária", extraordinaria: "Extraordinária" } as const;
const MODALIDADE = { online: "On-line", presencial: "Presencial", hibrida: "Híbrida" } as const;

const ICONE_VENCIMENTO: Record<TipoVencimento, LucideIcon> = {
  seguro: ShieldCheck,
  extintores: FlameKindling,
  vistoria: SquareCheckBig,
  mandato: Users,
};

const ICONE_PENDENCIA: Record<PendenciaAjuste["tipo"], LucideIcon> = {
  alerta_cadastro: Building2,
  divergencia_previsao: Calculator,
};

function urgenciaVencimento(dias: number): "alerta" | "warning" | "secondary" {
  return dias < 0 ? "alerta" : dias <= 30 ? "warning" : "secondary";
}

function Indicador({ titulo, valor, icone: Icone, to }: { titulo: string; valor: number; icone: LucideIcon; to: string }) {
  // #82: com texto 200% em 320 px a palavra "CONDOMÍNIOS" + ícone + p-5 passavam da coluna;
  // o ícone pode descer de linha e o respiro lateral é menor só abaixo de sm.
  return (
    <Link to={to} className="group min-w-0 rounded-md border bg-card p-4 shadow-sm transition-colors hover:border-sidebar-indicator sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</span>
        <Icone className="size-4 shrink-0 text-sidebar-indicator" aria-hidden />
      </div>
      <div className="num mt-3 break-words text-3xl font-semibold text-primary">{valor}</div>
    </Link>
  );
}

function Painel() {
  const navigate = useNavigate();
  const { data: condos } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const { data: backup } = useSuspenseQuery(itemQuery<ConfigBackup>("config", "backup"));

  const hoje = new Date();
  const vencimentos = calcularVencimentos(condos, hoje, 90);
  const pendencias = calcularPendenciasAjuste(condos, exercicios);
  const proximas = proximasAssembleias(assembleias, hoje, 5);
  const nomeCondo = (id: string) => condos.find((c) => c.id === id)?.nome ?? "Condomínio não encontrado";
  const diasBackup = diasDesdeBackup(backup?.em, hoje);

  return (
    <>
      <PageHeader titulo="Painel" descricao={`Hoje, ${dataParaBR(hoje)}`} />

      {backupAtrasado(backup?.em, hoje) && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>Backup pendente</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {diasBackup === null
                ? "Nenhum backup foi feito até agora."
                : `O último backup foi feito ${haDias(diasBackup)} (${formatData(backup?.em)}).`}
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link to="/backup">Fazer backup</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {pendencias.length > 0 && (
        <SectionCard
          className="mb-6 border-destructive/30"
          titulo="Pendências de ajuste"
          descricao="Precisam de atenção para os relatórios ficarem corretos — clique para abrir e resolver."
        >
          <ul className="divide-y">
            {pendencias.map((p, i) => {
              const Icone = ICONE_PENDENCIA[p.tipo];
              const miolo = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Icone className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-foreground">{p.condoNome}</span>
                    <span className="block break-words text-xs text-muted-foreground">{p.descricao}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </>
              );
              const classe = "alvo-toque flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-primary";
              return (
                <li key={`${p.tipo}-${p.condoId}-${p.exercicioId ?? i}`}>
                  {p.tipo === "divergencia_previsao" ? (
                    <Link to="/previsao-orcamentaria" search={{ exercicio: p.exercicioId! }} className={classe}>
                      {miolo}
                    </Link>
                  ) : (
                    <Link to="/condominios/$id" params={{ id: p.condoId }} className={classe}>
                      {miolo}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Indicador titulo="Condomínios" valor={condos.length} icone={Building2} to="/condominios" />
        <Indicador titulo="Prestações de contas" valor={exercicios.length} icone={FileSpreadsheet} to="/prestacao-contas" />
        <Indicador titulo="Editais" valor={assembleias.length} icone={Megaphone} to="/editais" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Vencimentos e prazos" descricao="Próximos 90 dias e itens já vencidos.">
          {vencimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vencimento nos próximos 90 dias.</p>
          ) : (
            <ul className="divide-y">
              {vencimentos.map((v, i) => {
                const Icone = ICONE_VENCIMENTO[v.tipo];
                return (
                  // #82: o selo de prazo não encolhia (shrink-0) e passava da página em 320 px com texto 200%.
                  // Agora desce para a linha de baixo quando não cabe ao lado do nome e quebra o texto se preciso.
                  <li
                    key={`${v.condoId}-${v.tipo}-${i}`}
                    className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icone className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-[1_1_6rem]">
                      <Link
                        to="/condominios/$id"
                        params={{ id: v.condoId }}
                        className="alvo-toque block break-words text-sm font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {v.condoNome}
                      </Link>
                      <div className="break-words text-xs text-muted-foreground">
                        {v.descricao} · {dataParaBR(v.data)}
                      </div>
                    </div>
                    <Badge variant={urgenciaVencimento(v.dias)} className="ml-auto max-w-full shrink-0">
                      {prazoDias(v.dias)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard titulo="Próximas assembleias">
          <DataTable
            colunas={[
              { chave: "data", titulo: "Data", className: "whitespace-nowrap", render: (a: Assembleia) => <span className="num">{formatData(a.data)}{a.hora1 ? ` · ${a.hora1}` : ""}</span> },
              { chave: "condo", titulo: "Condomínio", render: (a) => nomeCondo(a.condoId) },
              {
                chave: "tipo",
                titulo: "Tipo",
                render: (a) => (
                  <span>
                    {TIPO_ASSEMBLEIA[a.tipo] ?? a.tipo}
                    {a.modalidade && <span className="block text-xs text-muted-foreground">{MODALIDADE[a.modalidade] ?? a.modalidade}</span>}
                  </span>
                ),
              },
            ]}
            dados={proximas}
            chaveLinha={(a) => a.id}
            aoClicar={(a) => navigate({ to: "/editais/$id", params: { id: a.id } })}
            colunaAcao="condo"
            rotuloAcao={(a) => `Abrir edital de ${nomeCondo(a.condoId)}, ${formatData(a.data)}`}
            vazio="Nenhuma assembleia agendada."
          />
        </SectionCard>
      </div>
    </>
  );
}
