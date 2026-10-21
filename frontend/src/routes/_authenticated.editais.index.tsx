import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { Selecao } from "@/components/app/inputs";
import { DialogoNovoEdital } from "@/components/editais/DialogoNovoEdital";
import { itemQuery, listaQuery } from "@/lib/queries";
import { dataParaISO, formatData } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { normalizarAssembleia, rotuloModalidade, rotuloTipo } from "@/domain/edital";
import { normalizarModelo } from "@/domain/modelo";
import type { Assembleia, Condominio, ConfigEscritorio, Exercicio, Modelo } from "@/domain/types";

type Busca = { condo?: string; novo?: string };

export const Route = createFileRoute("/_authenticated/editais/")({
  head: () => cabecalho("Editais", "Editais de convocação de assembleias dos condomínios."),
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
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Modelo>("modelos")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]),
  component: ListaEditais,
});

const TODOS = "__todos";

type Linha = Assembleia & { condoNome: string; modeloNome: string; futura: boolean };

function ListaEditais() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/editais/" });
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: modelos } = useSuspenseQuery(listaQuery<Modelo>("modelos"));
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [condo, setCondo] = useState(busca.condo ?? TODOS);
  const novoAberto = busca.novo !== undefined;

  const linhas = useMemo<Linha[]>(() => {
    const hoje = dataParaISO(new Date());
    const nomeCondo = new Map(condominios.map((c) => [c.id, c.nome]));
    const nomeModelo = new Map(modelos.map((m) => [m.id, m.nome]));
    return assembleias
      .map((raw) => {
        const a = normalizarAssembleia(raw);
        return {
          ...a,
          condoNome: nomeCondo.get(a.condoId) ?? "—",
          modeloNome: a.modeloId ? (nomeModelo.get(a.modeloId) ?? "(modelo excluído)") : "—",
          futura: a.data >= hoje,
        };
      })
      .filter((a) => condo === TODOS || a.condoId === condo)
      .sort((a, b) => b.data.localeCompare(a.data) || a.condoNome.localeCompare(b.condoNome, "pt-BR"));
  }, [assembleias, condominios, modelos, condo]);

  const opcoesCondo = [
    { valor: TODOS, rotulo: "Todos os condomínios" },
    ...[...condominios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => ({ valor: c.id, rotulo: c.nome })),
  ];

  const abrirNovo = (v: boolean) =>
    navigate({ search: (s) => (v ? { ...s, novo: condo === TODOS ? "" : condo } : { ...(s.condo ? { condo: s.condo } : {}) }), replace: true });

  return (
    <>
      <PageHeader
        titulo="Editais"
        descricao="Editais de convocação das assembleias ordinárias e extraordinárias."
        acoes={
          <Button onClick={() => abrirNovo(true)} disabled={condominios.length === 0}>
            <Plus /> Novo edital
          </Button>
        }
      />
      <div className="mb-4 max-w-sm">
        <Selecao
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
          {
            chave: "data",
            titulo: "Data",
            className: "w-36 whitespace-nowrap",
            render: (a) => (
              <span className="num">
                {formatData(a.data)}
                {a.hora1 && <span className="block text-xs text-muted-foreground">{a.hora1}{a.hora2 ? ` / ${a.hora2}` : ""}</span>}
              </span>
            ),
          },
          {
            chave: "condoNome",
            titulo: "Condomínio",
            render: (a) => (
              <span className="font-medium text-foreground">
                {a.condoNome}
                {a.futura && (
                  <Badge variant="success" className="ml-2 align-middle text-[10px]">
                    agendada
                  </Badge>
                )}
              </span>
            ),
          },
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
          { chave: "pauta", titulo: "Pauta", alinhar: "direita", className: "num w-20", render: (a) => (a.pauta.length ? `${a.pauta.length} itens` : "—") },
          { chave: "modeloNome", titulo: "Modelo", className: "text-muted-foreground" },
        ]}
        dados={linhas}
        chaveLinha={(a) => a.id}
        aoClicar={(a) => navigate({ to: "/editais/$id", params: { id: a.id } })}
        colunaAcao="condoNome"
        rotuloAcao={(a) => `Abrir edital de ${a.condoNome}${a.futura ? " (agendada)" : ""}, ${formatData(a.data)}`}
        vazio={
          condominios.length === 0
            ? "Cadastre um condomínio antes de criar editais."
            : condo !== TODOS
              ? "Nenhum edital deste condomínio."
              : "Nenhum edital cadastrado."
        }
      />
      <DialogoNovoEdital
        aberto={novoAberto}
        aoMudar={abrirNovo}
        condominios={condominios}
        modelos={modelos.map((m) => normalizarModelo(m))}
        exercicios={exercicios}
        escritorio={escritorio}
        condoInicial={busca.novo ?? ""}
      />
    </>
  );
}
