import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange, FileClock, FileSpreadsheet, GitCompareArrows } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { AvisoImportacoesPendentes } from "@/components/importacao/AvisoImportacoesPendentes";
import { AnexarComparativo } from "@/components/importacao/AnexarComparativo";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import type { Condominio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/importador")({
  head: () => cabecalho("Importador", "Ponto único para importar os PDFs do Systemar: relatório mensal, prestação de contas e comparativo financeiro."),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
  component: Importador,
});

function CartaoImportacao({
  icone: Icone,
  titulo,
  children,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  children: ReactNode;
  acao: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-md border bg-card p-5 text-card-foreground">
      <div className="flex items-center gap-2">
        <Icone className="size-5 shrink-0 text-primary" aria-hidden />
        <h2 className="text-base font-semibold text-primary">{titulo}</h2>
      </div>
      <div className="mt-2 flex-1 space-y-2 text-sm text-muted-foreground">{children}</div>
      <div className="mt-4">{acao}</div>
    </section>
  );
}

function Importador() {
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));

  return (
    <>
      <PageHeader
        titulo="Importador"
        descricao="Escolha o tipo de relatório do Systemar e o PDF. Você confere o que foi lido antes de gravar."
        acoes={
          <Button variant="outline" asChild>
            <Link to="/importacoes">
              <FileClock /> Importações de PDF
            </Link>
          </Button>
        }
      />
      <AvisoImportacoesPendentes />
      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoImportacao
          icone={CalendarRange}
          titulo="Relatório mensal"
          acao={<ImportarPdf modo="novo" destino="mensais" condominios={condominios} rotulo="Importar relatório mensal" />}
        >
          <p>Demonstrativo do mês e contas a receber. Cria um relatório mensal novo no condomínio do PDF.</p>
          <p>Para preencher um relatório mensal que já existe, use “Importar PDF” dentro dele.</p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={FileSpreadsheet}
          titulo="Prestação de contas"
          acao={<ImportarPdf modo="novo" destino="exercicios" condominios={condominios} rotulo="Importar prestação de contas" />}
        >
          <p>
            Demonstrativo do exercício, Considerações finais e Previsão orçamentária sugerida, quando o PDF trouxer essas folhas.
            Cria uma prestação de contas nova.
          </p>
          <p>Para preencher uma prestação de contas que já existe, use “Importar PDF” dentro dela.</p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={GitCompareArrows}
          titulo="Comparativo Financeiro"
          acao={<AnexarComparativo condominios={condominios} />}
        >
          <p>
            Anexa o PDF do Comparativo Financeiro a uma prestação de contas que já existe, como referência para consulta e
            download. Não altera o demonstrativo.
          </p>
          <p>Os anexos aparecem no fim da tela da prestação de contas.</p>
        </CartaoImportacao>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Se o condomínio do PDF ainda não estiver cadastrado, o relatório espera em{" "}
        <Link to="/importacoes" className="font-medium text-primary underline">
          Importações de PDF
        </Link>{" "}
        até você conferir o cadastro.
      </p>
    </>
  );
}
