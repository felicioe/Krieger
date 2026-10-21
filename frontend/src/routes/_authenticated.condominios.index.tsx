import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { listaQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import type { Condominio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/condominios/")({
  head: () => cabecalho("Condomínios", "Cadastro dos condomínios atendidos."),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
  component: ListaCondominios,
});

function ListaCondominios() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ordenados = [...data].sort((a, b) =>
      String(a.codigo || "").localeCompare(String(b.codigo || ""), "pt-BR", { numeric: true }) || a.nome.localeCompare(b.nome, "pt-BR"),
    );
    if (!q) return ordenados;
    return ordenados.filter((c) =>
      [c.codigo, c.nome, c.nomeRelatorio, c.cnpj].some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [data, busca]);

  return (
    <>
      <PageHeader
        titulo="Condomínios"
        descricao={`${data.length} condomínio(s) cadastrado(s)`}
        acoes={
          <Button asChild>
            <Link to="/condominios/$id" params={{ id: "novo" }}>
              <Plus /> Novo condomínio
            </Link>
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, nome ou CNPJ"
          className="bg-card pl-9"
          aria-label="Buscar condomínios"
        />
      </div>
      <DataTable
        colunas={[
          { chave: "codigo", titulo: "Código", className: "w-24 num" },
          {
            chave: "nome",
            titulo: "Nome",
            render: (c: Condominio) => <span className="font-medium text-foreground">{c.nome}</span>,
          },
          { chave: "cnpj", titulo: "CNPJ", className: "num whitespace-nowrap" },
          {
            chave: "rateio",
            titulo: "Rateio mensal",
            alinhar: "direita",
            className: "num whitespace-nowrap",
            render: (c) => formatBRL(c.rateioAtual),
          },
        ]}
        dados={filtrados}
        chaveLinha={(c) => c.id}
        aoClicar={(c) => navigate({ to: "/condominios/$id", params: { id: c.id } })}
        colunaAcao="nome"
        rotuloAcao={(c) => `Abrir condomínio ${c.nome}`}
        vazio={busca ? "Nenhum condomínio corresponde à busca." : "Nenhum condomínio cadastrado."}
      />
    </>
  );
}
