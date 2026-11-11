import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { DialogoNovoModeloAta } from "@/components/modelos-ata/DialogoNovoModeloAta";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { normalizarModeloAta } from "@/domain/modeloAta";
import type { ModeloAta } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/modelos-ata/")({
  head: () => cabecalho("Modelos de ata", "Layouts de ata por cartório/cidade para geração de PDF/Word."),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(listaQuery<ModeloAta>("modelos_ata")),
  component: PaginaModelosAta,
});

function PaginaModelosAta() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(listaQuery<ModeloAta>("modelos_ata"));
  const [novo, setNovo] = useState(false);

  const modelos = useMemo(() => data.map(normalizarModeloAta), [data]);

  return (
    <>
      <PageHeader
        titulo="Modelos de ata"
        descricao="Layouts prontos por cidade/cartório. A escolha automática usa a cidade do condomínio e o tipo da assembleia."
        acoes={
          <Button onClick={() => setNovo(true)} permissao="modelos_ata.editar">
            <Plus /> Novo modelo
          </Button>
        }
      />
      <DataTable<ModeloAta>
        dados={modelos}
        chaveLinha={(m) => m.id}
        colunas={[
          { chave: "nome", titulo: "Nome" },
          { chave: "cidade", titulo: "Cidade", render: (m) => m.cidade?.trim() || "—" },
          { chave: "cartorio", titulo: "Cartório", render: (m) => m.cartorio?.trim() || "—" },
          {
            chave: "tipo",
            titulo: "Tipo",
            render: (m) =>
              m.tipo === "ordinaria" ? "Ordinária" : m.tipo === "extraordinaria" ? "Extraordinária" : "Os dois",
          },
          {
            chave: "ativo",
            titulo: "Status",
            render: (m) => (m.ativo ? "Ativo" : "Inativo"),
          },
        ]}
        aoClicar={(m) => navigate({ to: "/modelos-ata/$id", params: { id: m.id } })}
        colunaAcao="nome"
        rotuloAcao={(m) => `Abrir modelo ${m.nome || "(sem nome)"}`}
        vazio="Nenhum modelo de ata cadastrado."
      />
      <DialogoNovoModeloAta aberto={novo} aoMudar={setNovo} />
    </>
  );
}