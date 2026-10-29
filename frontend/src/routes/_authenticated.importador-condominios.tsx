import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { ImportarListagemCondominios } from "@/components/importacao/ImportarListagemCondominios";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import type { Condominio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/importador-condominios")({
  head: () =>
    cabecalho(
      "Listagem de Condomínios",
      "Importa a Listagem Completa de Condomínios do Systemar: cadastra os novos e atualiza os campos que mudaram nos já existentes.",
    ),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
  component: PaginaImportadorCondominios,
});

function PaginaImportadorCondominios() {
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto min-h-0 p-0 text-muted-foreground" asChild>
            <Link to="/importador">
              <ArrowLeft /> Importador
            </Link>
          </Button>
        }
        titulo="Listagem de Condomínios"
        descricao="Relatório único do Systemar com todos os condomínios: código, nome, CNPJ, endereço, área total e administração."
      />
      <ImportarListagemCondominios condominios={condominios} />
    </>
  );
}
