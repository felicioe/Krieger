import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { listaQuery } from "@/lib/queries";
import { formatDataHora } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { ROTULO_STATUS } from "@/components/importacao/status";
import type { Importacao } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/importacoes/")({
  head: () => cabecalho("Importações de PDF", "PDFs do Systemar de condomínios ainda não cadastrados, aguardando conferência."),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Importacao>("importacoes")),
  component: ListaImportacoes,
});

const ordem: Record<Importacao["status"], number> = { pendente: 0, confirmado: 1, descartado: 2 };

function ListaImportacoes() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(listaQuery<Importacao>("importacoes"));
  const linhas = useMemo(
    () =>
      [...data].sort(
        (a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || String(b.importadoEm).localeCompare(String(a.importadoEm)),
      ),
    [data],
  );

  return (
    <>
      <PageHeader
        titulo="Importações de PDF"
        descricao="Relatórios de condomínios que ainda não estavam cadastrados. Confira o cadastro básico para gravar o relatório."
      />
      <DataTable<Importacao>
        colunas={[
          { chave: "importadoEm", titulo: "Importado em", className: "num whitespace-nowrap w-40", render: (i) => formatDataHora(i.importadoEm) },
          { chave: "arquivo", titulo: "Arquivo", render: (i) => <span className="font-medium text-foreground break-all">{i.arquivo}</span> },
          { chave: "condominio", titulo: "Condomínio no PDF", render: (i) => i.cadastro?.nome || "—" },
          { chave: "destino", titulo: "Destino", render: (i) => (i.destino === "exercicios" ? "Prestação de contas" : "Relatório mensal") },
          {
            chave: "status",
            titulo: "Situação",
            render: (i) => {
              const s = ROTULO_STATUS[i.status] ?? ROTULO_STATUS.pendente;
              return <Badge variant={s.variante}>{s.rotulo}</Badge>;
            },
          },
        ]}
        dados={linhas}
        chaveLinha={(i) => i.id}
        aoClicar={(i) => navigate({ to: "/importacoes/$id", params: { id: i.id } })}
        colunaAcao="arquivo"
        rotuloAcao={(i) => `Abrir importação do arquivo ${i.arquivo}`}
        vazio="Nenhuma importação. Use o Importador para ler um PDF do Systemar."
      />
    </>
  );
}
