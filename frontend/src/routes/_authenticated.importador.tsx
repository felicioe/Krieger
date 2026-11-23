import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarRange,
  CircleHelp,
  FileClock,
  FileSpreadsheet,
  FileUp,
  GitCompareArrows,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { AvisoImportacoesPendentes } from "@/components/importacao/AvisoImportacoesPendentes";
import { AnexarComparativo } from "@/components/importacao/AnexarComparativo";
import { ImportarFracao } from "@/components/importacao/ImportarFracao";
import { ImportarApolice } from "@/components/importacao/ImportarApolice";
import { ImportarListagemCondominios } from "@/components/importacao/ImportarListagemCondominios";
import { listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import type { Condominio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/importador")({
  head: () =>
    cabecalho(
      "Importador",
      "Ponto único para importar os PDFs do Systemar: relatório mensal, prestação de contas e comparativo financeiro.",
    ),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
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
    <section className="flex min-w-0 flex-col rounded-md border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <Icone className="size-5 shrink-0 text-primary" aria-hidden />
        <h2 className="min-w-0 break-words text-base font-semibold text-primary">{titulo}</h2>
      </div>
      <div className="mt-2 flex-1 space-y-2 text-sm text-muted-foreground">{children}</div>
      <div className="mt-4">{acao}</div>
    </section>
  );
}

function Importador() {
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const [listagemAberta, setListagemAberta] = useState(false);

  return (
    <>
      <PageHeader
        titulo="Importador"
        descricao="Escolha o tipo de documento em PDF (relatório do Systemar ou apólice de seguro). Você confere o que foi lido antes de gravar."
        acoes={
          <>
            <Button variant="ghost" size="icon" asChild title="Ajuda sobre esta tela">
              <Link
                to="/ajuda"
                search={{ secao: "importador" }}
                aria-label="Ajuda sobre o importador"
              >
                <CircleHelp />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/importacoes">
                <FileClock /> Importações de PDF
              </Link>
            </Button>
          </>
        }
      />
      <AvisoImportacoesPendentes />
      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoImportacao
          icone={CalendarRange}
          titulo="Relatório mensal"
          acao={
            <ImportarPdf
              modo="novo"
              destino="mensais"
              condominios={condominios}
              rotulo="Importar relatório mensal"
            />
          }
        >
          <p>
            Demonstrativo do mês e contas a receber. Cria um relatório mensal novo no condomínio do
            PDF.
          </p>
          <p>Para preencher um relatório mensal que já existe, use “Importar PDF” dentro dele.</p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={FileSpreadsheet}
          titulo="Unidades e frações"
          acao={<ImportarFracao condominios={condominios} />}
        >
          <p>Importa a relação de unidades e frações ideais para o cadastro do condomínio.</p>
          <p>Os nomes de proprietários ou inquilinos não são armazenados.</p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={FileUp}
          titulo="Apólice de seguro"
          acao={<ImportarApolice condominios={condominios} />}
        >
          <p>
            Reconhece a apólice original da seguradora e aplica seguradora, vigência, risco absoluto
            e coberturas ao cadastro escolhido.
          </p>
          <p>
            O PDF é apenas lido no navegador; nada é alterado até você clicar em “Aplicar ao
            cadastro”.
          </p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={FileSpreadsheet}
          titulo="Prestação de contas"
          acao={
            <ImportarPdf
              modo="novo"
              destino="exercicios"
              condominios={condominios}
              rotulo="Importar prestação de contas"
            />
          }
        >
          <p>
            Demonstrativo do exercício, Considerações finais e Previsão orçamentária sugerida,
            quando o PDF trouxer essas folhas. Cria uma prestação de contas nova.
          </p>
          <p>
            Para preencher uma prestação de contas que já existe, use “Importar PDF” dentro dela.
          </p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={GitCompareArrows}
          titulo="Comparativo Financeiro"
          acao={<AnexarComparativo condominios={condominios} />}
        >
          <p>
            Guarda o PDF do Comparativo Financeiro na prestação de contas e importa os meses
            selecionados como relatórios mensais, criando os novos ou atualizando os existentes após
            sua revisão. Esses meses alimentam os relatórios do sistema. O demonstrativo da
            prestação escolhida é preservado.
          </p>
          <p>PDF de até 10 MB. Os anexos aparecem no fim da tela da prestação de contas.</p>
        </CartaoImportacao>
        <CartaoImportacao
          icone={Building2}
          titulo="Listagem de Condomínios"
          acao={
            <Button variant="outline" onClick={() => setListagemAberta(true)}>
              <FileUp /> Importar listagem de condomínios
            </Button>
          }
        >
          <p>
            Relatório único com todos os condomínios do escritório: código, nome, CNPJ, endereço,
            área total e administração (síndico, subsíndico, conselheiros). Cadastra os novos e
            atualiza só os campos que mudaram nos já existentes — com prévia antes de confirmar.
          </p>
        </CartaoImportacao>
      </div>
      <Dialog open={listagemAberta} onOpenChange={setListagemAberta}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Importar listagem de condomínios</DialogTitle>
            <DialogDescription>
              Selecione o PDF de listagem de condomínios do Systemar para conferir as alterações
              antes de gravar.
            </DialogDescription>
          </DialogHeader>
          <ImportarListagemCondominios condominios={condominios} />
        </DialogContent>
      </Dialog>
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
