import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { DialogoNovoModelo } from "@/components/modelos/DialogoNovoModelo";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { normalizarModelo } from "@/domain/modelo";
import { rotuloTipo } from "@/domain/edital";
import type { Assembleia, Condominio, Modelo } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/modelos/")({
  head: () =>
    cabecalho("Modelos de edital", "Modelos de texto e pauta padrão dos editais de convocação."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Modelo>("modelos")),
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
    ]),
  component: ListaModelos,
});

const TODOS = "__todos";

type Linha = Modelo & { usos: number; condoNome: string };

function ListaModelos() {
  const navigate = useNavigate();
  const { data: modelos } = useSuspenseQuery(listaQuery<Modelo>("modelos"));
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const [novo, setNovo] = useState(false);
  const [condo, setCondo] = useState(TODOS);

  const normalizados = useMemo(() => modelos.map((m) => normalizarModelo(m)), [modelos]);
  const linhas = useMemo<Linha[]>(() => {
    const nomeCondo = new Map(condominios.map((c) => [c.id, c.nome]));
    return (
      normalizados
        .map((m) => ({
          ...m,
          usos: assembleias.filter((a) => a.modeloId === m.id).length,
          condoNome: m.condoId ? (nomeCondo.get(m.condoId) ?? "(condomínio excluído)") : "Geral",
        }))
        // O filtro mostra o que serve ao condomínio escolhido: o modelo dele e os gerais.
        .filter((m) => condo === TODOS || !m.condoId || m.condoId === condo)
        .sort(
          (a, b) =>
            a.condoNome.localeCompare(b.condoNome, "pt-BR") ||
            a.nome.localeCompare(b.nome, "pt-BR"),
        )
    );
  }, [normalizados, assembleias, condominios, condo]);

  const opcoesCondo = [
    { valor: TODOS, rotulo: "Todos os condomínios", busca: "todos" },
    ...opcoesCondominio(condominios),
  ];

  return (
    <>
      <PageHeader
        titulo="Modelos de edital"
        descricao="Blocos de texto do edital e pauta padrão da assembleia ordinária, por condomínio ou gerais."
        acoes={
          <Button permissao="modelos.editar" onClick={() => setNovo(true)}>
            <Plus /> Novo modelo
          </Button>
        }
      />
      <div className="mb-4 max-w-sm">
        <SelecaoBusca
          aria-label="Filtrar por condomínio"
          value={condo}
          onChange={setCondo}
          opcoes={opcoesCondo}
          placeholderBusca="Pesquisar condomínio por nome, código ou CNPJ..."
          className="bg-card"
        />
      </div>
      <DataTable<Linha>
        colunas={[
          {
            chave: "nome",
            titulo: "Nome",
            render: (m) => (
              <span className="font-medium text-foreground">{m.nome || "(sem nome)"}</span>
            ),
          },
          {
            chave: "condoNome",
            titulo: "Condomínio",
            render: (m) => (
              <span className={m.condoId ? "" : "text-muted-foreground"}>{m.condoNome}</span>
            ),
          },
          {
            chave: "cidade",
            titulo: "Cidade",
            render: (m) => (m.cidade ? m.cidade : <span className="text-muted-foreground">—</span>),
          },
          {
            chave: "tipo",
            titulo: "Tipo",
            render: (m) =>
              m.tipo ? rotuloTipo(m.tipo) : <span className="text-muted-foreground">Ambos</span>,
          },
          {
            chave: "versao",
            titulo: "Versão",
            className: "num w-24",
            render: (m) => String(m.versao),
          },
          {
            chave: "blocos",
            titulo: "Blocos",
            alinhar: "direita",
            className: "num w-24",
            render: (m) => m.blocos.length,
          },
          {
            chave: "pauta",
            titulo: "Itens da pauta",
            alinhar: "direita",
            className: "num w-32",
            render: (m) => m.pautaOrdinaria.length,
          },
          {
            chave: "usos",
            titulo: "Editais",
            alinhar: "direita",
            className: "num w-24",
            render: (m) => m.usos || "—",
          },
        ]}
        dados={linhas}
        chaveLinha={(m) => m.id}
        aoClicar={(m) => navigate({ to: "/modelos/$id", params: { id: m.id } })}
        colunaAcao="nome"
        rotuloAcao={(m) => `Abrir modelo ${m.nome || "(sem nome)"}`}
        vazio={
          modelos.length === 0
            ? "Nenhum modelo de edital cadastrado."
            : "Nenhum modelo deste condomínio. Crie um modelo para ele ou use um modelo geral."
        }
      />
      <DialogoNovoModelo
        aberto={novo}
        aoMudar={setNovo}
        modelos={normalizados}
        condominios={condominios}
      />
    </>
  );
}
