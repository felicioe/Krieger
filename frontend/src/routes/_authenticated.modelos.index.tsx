import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { DialogoNovoModelo } from "@/components/modelos/DialogoNovoModelo";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { normalizarModelo } from "@/domain/modelo";
import type { Assembleia, Modelo } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/modelos/")({
  head: () => cabecalho("Modelos de edital", "Modelos de texto e pauta padrão dos editais de convocação."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Modelo>("modelos")),
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
    ]),
  component: ListaModelos,
});

type Linha = Modelo & { usos: number };

function ListaModelos() {
  const navigate = useNavigate();
  const { data: modelos } = useSuspenseQuery(listaQuery<Modelo>("modelos"));
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const [novo, setNovo] = useState(false);

  const normalizados = useMemo(() => modelos.map((m) => normalizarModelo(m)), [modelos]);
  const linhas = useMemo<Linha[]>(
    () =>
      normalizados
        .map((m) => ({ ...m, usos: assembleias.filter((a) => a.modeloId === m.id).length }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [normalizados, assembleias],
  );

  return (
    <>
      <PageHeader
        titulo="Modelos de edital"
        descricao="Blocos de texto do edital e pauta padrão da assembleia ordinária."
        acoes={
          <Button onClick={() => setNovo(true)}>
            <Plus /> Novo modelo
          </Button>
        }
      />
      <DataTable<Linha>
        colunas={[
          { chave: "nome", titulo: "Nome", render: (m) => <span className="font-medium text-foreground">{m.nome || "(sem nome)"}</span> },
          { chave: "versao", titulo: "Versão", className: "num w-24", render: (m) => String(m.versao) },
          { chave: "blocos", titulo: "Blocos", alinhar: "direita", className: "num w-24", render: (m) => m.blocos.length },
          { chave: "pauta", titulo: "Itens da pauta", alinhar: "direita", className: "num w-32", render: (m) => m.pautaOrdinaria.length },
          { chave: "usos", titulo: "Editais", alinhar: "direita", className: "num w-24", render: (m) => m.usos || "—" },
        ]}
        dados={linhas}
        chaveLinha={(m) => m.id}
        aoClicar={(m) => navigate({ to: "/modelos/$id", params: { id: m.id } })}
        colunaAcao="nome"
        rotuloAcao={(m) => `Abrir modelo ${m.nome || "(sem nome)"}`}
        vazio="Nenhum modelo de edital cadastrado."
      />
      <DialogoNovoModelo aberto={novo} aoMudar={setNovo} modelos={normalizados} />
    </>
  );
}
