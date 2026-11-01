import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { Selecao } from "@/components/app/inputs";
import { DialogoNovaAta } from "@/components/atas/DialogoNovaAta";
import { listaQuery } from "@/lib/queries";
import { formatData } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { normalizarAta, rotuloStatus } from "@/domain/ata";
import { rotuloModalidade, rotuloTipo } from "@/domain/edital";
import type { Assembleia, Ata, Condominio } from "@/domain/types";

type Busca = { condo?: string; status?: string; novo?: string };

export const Route = createFileRoute("/_authenticated/atas/")({
  head: () => cabecalho("Atas", "Atas das assembleias dos condomínios."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const condo = s["condo"];
    const status = s["status"];
    const novo = s["novo"];
    return {
      ...(typeof condo === "string" && condo ? { condo } : {}),
      ...(status === "rascunho" || status === "finalizada" ? { status } : {}),
      ...(typeof novo === "string" ? { novo } : {}),
    };
  },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Ata>("atas")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
    ]),
  component: ListaAtas,
});

const TODOS = "__todos";

type Linha = Ata & { condoNome: string };

function ListaAtas() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/atas/" });
  const { data: atas } = useSuspenseQuery(listaQuery<Ata>("atas"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const condo = busca.condo ?? TODOS;
  const status = busca.status ?? TODOS;
  const novoAberto = busca.novo !== undefined;

  const normalizadas = useMemo(() => atas.map((a) => normalizarAta(a)), [atas]);
  const linhas = useMemo<Linha[]>(() => {
    const nomeCondo = new Map(condominios.map((c) => [c.id, c.nome]));
    return normalizadas
      .map((a) => ({ ...a, condoNome: nomeCondo.get(a.condoId) ?? "—" }))
      .filter((a) => (condo === TODOS || a.condoId === condo) && (status === TODOS || a.status === status))
      .sort((a, b) => b.data.localeCompare(a.data) || a.condoNome.localeCompare(b.condoNome, "pt-BR"));
  }, [normalizadas, condominios, condo, status]);

  const filtrar = (parcial: { condo?: string; status?: string }) => {
    const c = parcial.condo ?? condo;
    const st = parcial.status ?? status;
    navigate({ search: { ...(c !== TODOS ? { condo: c } : {}), ...(st !== TODOS ? { status: st } : {}) }, replace: true });
  };
  const abrirNovo = (v: boolean) => {
    navigate({
      search: (s) => {
        const { novo: _n, ...resto } = s;
        return v ? { ...resto, novo: condo === TODOS ? "" : condo } : resto;
      },
      replace: true,
    });
  };

  return (
    <>
      <PageHeader
        titulo="Atas"
        descricao="Atas das assembleias, digitadas durante a reunião."
        acoes={
          <Button permissao="atas.editar" onClick={() => abrirNovo(true)} disabled={condominios.length === 0}>
            <Plus /> Nova ata
          </Button>
        }
      />
      <div className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Selecao
          aria-label="Filtrar por condomínio"
          value={condo}
          onChange={(v) => filtrar({ condo: v })}
          opcoes={[
            { valor: TODOS, rotulo: "Todos os condomínios" },
            ...[...condominios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => ({ valor: c.id, rotulo: c.nome })),
          ]}
          className="bg-card"
        />
        <Selecao
          aria-label="Filtrar por situação"
          value={status}
          onChange={(v) => filtrar({ status: v })}
          opcoes={[
            { valor: TODOS, rotulo: "Todas as situações" },
            { valor: "rascunho", rotulo: "Rascunho" },
            { valor: "finalizada", rotulo: "Finalizada" },
          ]}
          className="bg-card"
        />
      </div>
      <DataTable<Linha>
        colunas={[
          {
            chave: "data",
            titulo: "Data",
            className: "w-32 whitespace-nowrap",
            render: (a) => (
              <span className="num">
                {formatData(a.data)}
                {a.hora && <span className="block text-xs text-muted-foreground">{a.hora}</span>}
              </span>
            ),
          },
          { chave: "condoNome", titulo: "Condomínio", render: (a) => <span className="font-medium text-foreground">{a.condoNome}</span> },
          {
            chave: "tipo",
            titulo: "Assembleia",
            render: (a) => (
              <span>
                {rotuloTipo(a.tipo)}
                <span className="block text-xs text-muted-foreground">{rotuloModalidade(a.modalidade)}</span>
              </span>
            ),
          },
          {
            chave: "presentes",
            titulo: "Presentes",
            alinhar: "direita",
            className: "num whitespace-nowrap",
            render: (a) =>
              a.quorum.unidadesPresentes || a.quorum.totalUnidades
                ? `${a.quorum.unidadesPresentes} de ${a.quorum.totalUnidades} un.`
                : "—",
          },
          { chave: "itens", titulo: "Itens", alinhar: "direita", className: "num w-16", render: (a) => a.itens.length || "—" },
          {
            chave: "status",
            titulo: "Situação",
            className: "w-28",
            render: (a) => <Badge variant={a.status === "finalizada" ? "success" : "warning"}>{rotuloStatus(a.status)}</Badge>,
          },
        ]}
        dados={linhas}
        chaveLinha={(a) => a.id}
        aoClicar={(a) => navigate({ to: "/atas/$id", params: { id: a.id } })}
        colunaAcao="condoNome"
        rotuloAcao={(a) => `Abrir ata de ${a.condoNome}, ${formatData(a.data)}`}
        vazio={
          condominios.length === 0
            ? "Cadastre um condomínio antes de criar atas."
            : condo !== TODOS || status !== TODOS
              ? "Nenhuma ata com esses filtros."
              : "Nenhuma ata cadastrada."
        }
      />
      <DialogoNovaAta
        aberto={novoAberto}
        aoMudar={abrirNovo}
        condominios={condominios}
        assembleias={assembleias}
        atas={normalizadas}
        condoInicial={busca.novo ?? ""}
      />
    </>
  );
}
