import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { ROTULO_LAYOUT, colunasDoRelatorio, resumoConferencia } from "@/domain/importacao";
import type { ConsideracoesFinaisLidas, PrevisaoSugeridaLida, RelatorioLido } from "@/domain/pdfParser";
import type { Demonstrativo, DestinoImportacao } from "@/domain/types";

/** O que foi lido do PDF: origem, período, totais e conferência — para o usuário revisar antes de usar. */
export function ResumoImportacao({
  arquivo,
  relatorio,
  demonstrativo,
  coluna,
  aoMudarColuna,
  destino,
  consideracoes = null,
  previsaoSugerida = null,
}: {
  arquivo: string;
  relatorio: RelatorioLido;
  demonstrativo: Demonstrativo;
  coluna: string | null;
  aoMudarColuna: (c: string) => void;
  destino?: DestinoImportacao | undefined;
  consideracoes?: ConsideracoesFinaisLidas | null;
  previsaoSugerida?: PrevisaoSugeridaLida | null;
}) {
  const colunas = colunasDoRelatorio(relatorio);
  const conf = resumoConferencia(relatorio);
  const c = relatorio.condominio;
  const d = demonstrativo;
  const nDespesas = d.despesas.grupos.reduce((s, g) => s + g.itens.length, 0);
  const periodo = d.periodo.ini || d.periodo.fim ? `${d.periodo.ini || "—"} a ${d.periodo.fim || "—"}` : "não encontrado";

  return (
    <div className="grid gap-4 text-sm">
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Arquivo</dt>
        <dd className="break-all">{arquivo}</dd>
        <dt className="text-muted-foreground">Formato</dt>
        <dd>{ROTULO_LAYOUT[relatorio.layout]}</dd>
        <dt className="text-muted-foreground">Condomínio no PDF</dt>
        <dd>
          {[c.codigo && `(${c.codigo})`, c.nome].filter(Boolean).join(" ") || "não informado"}
          {c.cnpj && <span className="ml-1 text-muted-foreground">· CNPJ {c.cnpj}</span>}
        </dd>
        <dt className="text-muted-foreground">Período</dt>
        <dd className="num">{periodo}</dd>
      </dl>

      {colunas.length > 0 && (
        <Field rotulo="Coluna do comparativo a usar" className="max-w-xs" dica="O PDF traz um valor por mês; escolha o mês ou o total do período.">
          <Selecao value={coluna} onChange={aoMudarColuna} opcoes={colunas} />
        </Field>
      )}

      <div className="rounded-md border bg-muted/30 p-3">
        <dl className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-6">
          {(
            [
              ["Saldo anterior", d.totais.saldoAnterior, `${d.saldoAnterior.contas.length} conta(s)`],
              ["Receitas", d.totais.receitas, `${d.receitas.itens.length} item(ns)`],
              ["Despesas", d.totais.despesas, `${nDespesas} item(ns) em ${d.despesas.grupos.length} grupo(s)`],
              ["Saldo atual", d.totais.saldoAtual, `${d.saldoAtual.contas.length} conta(s)`],
            ] as const
          ).map(([rotulo, valor, detalhe]) => (
            <div key={rotulo} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">
                {rotulo} <span className="text-xs">({detalhe})</span>
              </dt>
              <dd className="num whitespace-nowrap font-medium">{formatBRL(valor)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {conf.ok ? (
        <p className="flex items-center gap-2 text-success">
          <CircleCheck className="size-4" /> Os totais do PDF conferem com a soma dos itens lidos.
        </p>
      ) : (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            <p className="font-medium">A conferência do PDF encontrou diferenças:</p>
            <ul className="mt-1 list-disc pl-4">
              {conf.mensagens.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <PaginasExtras destino={destino} consideracoes={consideracoes} previsaoSugerida={previsaoSugerida} />
      {d.avisos.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{d.avisos.join(" ")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Aviso do que foi lido das páginas "Considerações finais" e "Previsão orçamentária sugerida". */
function PaginasExtras({
  destino,
  consideracoes: cf,
  previsaoSugerida: pv,
}: {
  destino?: DestinoImportacao | undefined;
  consideracoes: ConsideracoesFinaisLidas | null;
  previsaoSugerida: PrevisaoSugeridaLida | null;
}) {
  if (!cf && !pv) return null;
  const naPrestacao = destino !== "mensais";
  const detalhes = cf
    ? [
        cf.administracao.length > 0 && `${cf.administracao.length} membro(s) da administração`,
        (cf.seguro.riscoAbsoluto != null || cf.seguro.coberturas.length > 0) && "seguro",
        cf.seguradora && `seguradora ${cf.seguradora}`,
        (cf.ultCaixaDagua || cf.ultDedetizacao || cf.ultGordura) && "datas de manutenção",
        cf.indices.length > 0 && `${cf.indices.length} índice(s) de correção`,
      ].filter(Boolean)
    : [];

  return (
    <Alert>
      <Info />
      <AlertDescription>
        <ul className="grid gap-1.5">
          {cf && (
            <li>
              <span className="font-medium">Considerações finais lidas</span>
              {detalhes.length > 0 && <> ({detalhes.join(", ")})</>}.{" "}
              {naPrestacao
                ? "Esses dados preenchem as Considerações finais da prestação de contas (tela Relatório final) e continuam editáveis."
                : "Elas só são usadas na prestação de contas; o relatório mensal não as utiliza."}
            </li>
          )}
          {pv && (
            <li>
              <span className="font-medium">Previsão orçamentária sugerida lida</span>
              {pv.categorias.length > 0 && <> ({pv.categorias.length} categoria(s) de despesa</>}
              {pv.categorias.length > 0 && pv.rateioMensalSugerido != null && <>, rateio mensal sugerido no PDF {formatBRL(pv.rateioMensalSugerido)}</>}
              {pv.categorias.length > 0 && <>)</>}.{" "}
              {naPrestacao
                ? "Ela preenche o menu Previsão orçamentária, onde as deduções e a variação continuam editáveis."
                : "Ela só é usada na prestação de contas."}
            </li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
