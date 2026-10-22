import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { AvisoImportacoesPendentes } from "@/components/importacao/AvisoImportacoesPendentes";
import { Selecao } from "@/components/app/inputs";
import { DialogoNovoMensal } from "@/components/mensal/DialogoNovoMensal";
import { listaQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { competenciaMensal, normalizarMensal, ordemCompetencia, rotuloCompetencia } from "@/domain/mensal";
import type { Condominio, Mensal } from "@/domain/types";

type Busca = { condo?: string; novo?: string };

export const Route = createFileRoute("/_authenticated/relatorio-mensal/")({
  head: () => cabecalho("Relatório mensal", "Relatórios mensais de receitas e despesas dos condomínios."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const condo = s["condo"];
    const novo = s["novo"];
    return {
      ...(typeof condo === "string" && condo ? { condo } : {}),
      ...(typeof novo === "string" ? { novo } : {}),
    };
  },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
    ]),
  component: ListaMensais,
});

const TODOS = "__todos";

type Linha = Mensal & { comp: string; ordem: number; receitas: number; despesas: number; saldo: number; naoFecha: boolean };

function ListaMensais() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/relatorio-mensal/" });
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const [condo, setCondo] = useState(busca.condo ?? TODOS);
  const novoAberto = busca.novo !== undefined;

  const linhas = useMemo<Linha[]>(() => {
    const porId = new Map(condominios.map((c) => [c.id, c]));
    return mensais
      .map((raw) => {
        const m = normalizarMensal(raw);
        const c = competenciaMensal(m);
        const d = m.demonstrativo;
        return {
          ...m,
          condoNome: m.condoNome || porId.get(m.condoId)?.nome || "",
          comp: rotuloCompetencia(c),
          ordem: ordemCompetencia(c),
          receitas: d?.totais.receitas ?? 0,
          despesas: d?.totais.despesas ?? 0,
          saldo: d?.totais.saldoAtual ?? 0,
          naoFecha: (d?.avisos.length ?? 0) > 0,
        };
      })
      .filter((m) => condo === TODOS || m.condoId === condo)
      .sort((a, b) => b.ordem - a.ordem || a.condoNome.localeCompare(b.condoNome, "pt-BR"));
  }, [mensais, condominios, condo]);

  const opcoesCondo = [
    { valor: TODOS, rotulo: "Todos os condomínios" },
    ...[...condominios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => ({ valor: c.id, rotulo: c.nome })),
  ];

  const abrirNovo = (v: boolean) =>
    navigate({ search: (s) => (v ? { ...s, novo: condo === TODOS ? "" : condo } : { ...(s.condo ? { condo: s.condo } : {}) }), replace: true });

  return (
    <>
      <PageHeader
        titulo="Relatório mensal"
        descricao="Demonstrativo do mês, contas a receber e notas explicativas de cada condomínio."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link to="/importador">
                <FileUp /> Importar PDF
              </Link>
            </Button>
            <Button onClick={() => abrirNovo(true)} disabled={condominios.length === 0}>
              <Plus /> Novo relatório mensal
            </Button>
          </>
        }
      />
      <AvisoImportacoesPendentes />
      <div className="mb-4 max-w-sm">
        <Selecao
          aria-label="Filtrar por condomínio"
          value={condo}
          onChange={(v) => {
            setCondo(v);
            navigate({ search: v === TODOS ? {} : { condo: v }, replace: true });
          }}
          opcoes={opcoesCondo}
          className="bg-card"
        />
      </div>
      <DataTable<Linha>
        colunas={[
          { chave: "comp", titulo: "Mês", className: "w-24 num" },
          {
            chave: "condoNome",
            titulo: "Condomínio",
            render: (m) => (
              <span className="font-medium text-foreground">
                {m.condoNome}
                {m.naoFecha && (
                  <Badge variant="warning" className="ml-2 align-middle text-[10px]">
                    saldo não fecha
                  </Badge>
                )}
              </span>
            ),
          },
          { chave: "receitas", titulo: "Receitas", alinhar: "direita", className: "num whitespace-nowrap", render: (m) => formatBRL(m.receitas) },
          { chave: "despesas", titulo: "Despesas", alinhar: "direita", className: "num whitespace-nowrap", render: (m) => formatBRL(m.despesas) },
          { chave: "saldo", titulo: "Saldo atual", alinhar: "direita", className: "num whitespace-nowrap", render: (m) => formatBRL(m.saldo) },
          {
            chave: "receber",
            titulo: "A receber",
            alinhar: "direita",
            className: "num whitespace-nowrap",
            render: (m) =>
              m.receber.unidades || m.receber.valor ? (
                <span>
                  {formatBRL(m.receber.valor)}
                  {m.receber.unidades ? <span className="ml-1 text-xs text-muted-foreground">({m.receber.unidades} un.)</span> : null}
                </span>
              ) : (
                "—"
              ),
          },
        ]}
        dados={linhas}
        chaveLinha={(m) => m.id}
        aoClicar={(m) => navigate({ to: "/relatorio-mensal/$id", params: { id: m.id } })}
        colunaAcao="condoNome"
        rotuloAcao={(m) => `Abrir relatório mensal de ${m.condoNome}${m.naoFecha ? " (saldo não fecha)" : ""}, ${m.comp}`}
        vazio={
          condominios.length === 0
            ? "Cadastre um condomínio antes de criar relatórios mensais."
            : condo !== TODOS
              ? "Nenhum relatório mensal deste condomínio."
              : "Nenhum relatório mensal cadastrado."
        }
      />
      <DialogoNovoMensal
        aberto={novoAberto}
        aoMudar={abrirNovo}
        condominios={condominios}
        mensais={mensais.map((m) => normalizarMensal(m))}
        condoInicial={busca.novo ?? ""}
      />
    </>
  );
}
