import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { normalizarExercicio } from "@/domain/exercicio";
import type { Exercicio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorio-final/")({
  head: () =>
    cabecalho(
      "Relatório final",
      "Escolha a prestação de contas para montar e emitir o relatório final.",
    ),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
  component: ListaRelatoriosFinais,
});

function ListaRelatoriosFinais() {
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));

  const linhas = useMemo(
    () =>
      exercicios
        .map(normalizarExercicio)
        .sort(
          (a, b) =>
            Number(b.ano) - Number(a.ano) ||
            (a.condoNome ?? "").localeCompare(b.condoNome ?? "", "pt-BR"),
        ),
    [exercicios],
  );

  return (
    <>
      <PageHeader
        titulo="Relatório final"
        descricao="Escolha a prestação de contas para montar, conferir e emitir o relatório final."
      />
      <SectionCard>
        {linhas.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma prestação de contas cadastrada ainda.
            </p>
            <Button variant="link" asChild>
              <Link to="/prestacao-contas">Ir para Prestação de contas</Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercício</TableHead>
                <TableHead>Condomínio</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ação</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="num">{e.ano}</TableCell>
                  <TableCell>{e.condoNome}</TableCell>
                  <TableCell>
                    <Badge variant={e.fechado ? "success" : "warning"}>
                      {e.fechado ? "Exercício fechado" : "Exercício aberto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/relatorio-final/$id" params={{ id: e.id }}>
                        <FileCheck2 /> Abrir relatório final
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}
