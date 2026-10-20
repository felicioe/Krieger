import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, FileSpreadsheet, Megaphone, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable } from "@/components/app/DataTable";
import { itemQuery, listaQuery } from "@/lib/queries";
import { dataParaBR, formatData } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { backupAtrasado, calcularVencimentos, diasDesdeBackup, proximasAssembleias } from "@/domain/painel";
import type { Assembleia, Condominio, ConfigBackup, Exercicio } from "@/domain/types";

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

function Indicador({ titulo, valor, icone: Icone, to }: { titulo: string; valor: number; icone: LucideIcon; to: string }) {
  return (
    <Link to={to} className="group rounded-md border bg-card p-5 transition-colors hover:border-sidebar-indicator">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</span>
        <Icone className="size-4 text-sidebar-indicator" />
      </div>
      <div className="num mt-3 text-3xl font-semibold text-primary">{valor}</div>
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
  const proximas = proximasAssembleias(assembleias, hoje, 5);
  const nomeCondo = (id: string) => condos.find((c) => c.id === id)?.nome ?? "—";
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
                : `O último backup foi feito há ${diasBackup} dias (${formatData(backup?.em)}).`}
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link to="/backup">Fazer backup</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador titulo="Condomínios" valor={condos.length} icone={Building2} to="/condominios" />
        <Indicador titulo="Prestações de contas" valor={exercicios.length} icone={FileSpreadsheet} to="/prestacao-contas" />
        <Indicador titulo="Editais" valor={assembleias.length} icone={Megaphone} to="/editais" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard titulo="Atenção" descricao="Vencimentos nos próximos 90 dias e itens vencidos">
          {vencimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vencimento nos próximos 90 dias.</p>
          ) : (
            <ul className="divide-y">
              {vencimentos.map((v, i) => (
                <li key={`${v.condoId}-${v.tipo}-${i}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      to="/condominios/$id"
                      params={{ id: v.condoId }}
                      className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {v.condoNome}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {v.descricao} · {dataParaBR(v.data)}
                    </div>
                  </div>
                  <Badge variant={v.dias < 0 ? "alerta" : v.dias <= 30 ? "warning" : "secondary"} className="shrink-0">
                    {v.dias < 0 ? `Vencido há ${-v.dias} dia(s)` : v.dias === 0 ? "Vence hoje" : `Em ${v.dias} dia(s)`}
                  </Badge>
                </li>
              ))}
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
            vazio="Nenhuma assembleia agendada."
          />
        </SectionCard>
      </div>
    </>
  );
}
