import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable, type Coluna } from "@/components/app/DataTable";
import { listaQuery } from "@/lib/queries";
import { formatBRL, formatDataHora, formatNumeroBR } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import type { DecisaoDivergenciaPrevisao } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/previsao-divergencias")({
  head: () =>
    cabecalho(
      "Divergências da previsão sugerida",
      "Toda vez que a Previsão sugerida divergiu dos totais do PDF e o usuário manteve os valores calculados mesmo assim.",
    ),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<DecisaoDivergenciaPrevisao>("decisoes_previsao")),
  component: PaginaDivergencias,
});

const formatoCampo = (campo: string, valor: number) => (campo === "Índice sugerido para correção" ? `${formatNumeroBR(valor)}%` : formatBRL(valor));

function PaginaDivergencias() {
  const { data } = useSuspenseQuery(listaQuery<DecisaoDivergenciaPrevisao>("decisoes_previsao"));
  const linhas = [...data].sort((a, b) => (a.aceitoEm < b.aceitoEm ? 1 : a.aceitoEm > b.aceitoEm ? -1 : 0));

  const colunas: Coluna<DecisaoDivergenciaPrevisao>[] = [
    { chave: "aceitoEm", titulo: "Data e hora", render: (r) => <span className="num whitespace-nowrap">{formatDataHora(r.aceitoEm)}</span> },
    { chave: "condoNome", titulo: "Condomínio", render: (r) => r.condoNome || "—" },
    { chave: "ano", titulo: "Exercício", render: (r) => <span className="num">{r.ano}</span> },
    {
      chave: "campos",
      titulo: "Campos divergentes (PDF × calculado)",
      render: (r) => (
        <ul className="list-disc space-y-0.5 pl-4 text-sm">
          {r.campos.map((c) => (
            <li key={c.campo}>
              {c.campo}: {formatoCampo(c.campo, c.doPdf)} × {formatoCampo(c.campo, c.calculado)}
            </li>
          ))}
        </ul>
      ),
    },
    { chave: "aceitoPorNome", titulo: "Confirmado por", render: (r) => r.aceitoPorNome || "—" },
  ];

  return (
    <>
      <PageHeader
        titulo="Divergências da previsão sugerida"
        descricao="Registro de quando o sistema apontou uma diferença entre o PDF e o calculado, e o usuário decidiu manter os valores calculados."
      />
      <SectionCard titulo="Divergências aceitas" descricao="Do mais recente para o mais antigo.">
        <DataTable
          colunas={colunas}
          dados={linhas}
          chaveLinha={(r) => r.id}
          vazio="Nenhuma divergência aceita registrada ainda."
        />
      </SectionCard>
    </>
  );
}
