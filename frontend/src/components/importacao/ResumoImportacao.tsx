import { CircleCheck, CircleHelp, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { ROTULO_LAYOUT, colunasDoRelatorio, resumoConferencia } from "@/domain/importacao";
import type { ConsideracoesFinaisLidas, PrevisaoSugeridaLida, RelatorioLido } from "@/domain/pdfParser";
import type { Demonstrativo, DestinoImportacao } from "@/domain/types";
import { contagem } from "@/components/app/textos";

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
              ["Saldo anterior", d.totais.saldoAnterior, contagem(d.saldoAnterior.contas.length, "conta", "contas")],
              ["Receitas", d.totais.receitas, contagem(d.receitas.itens.length, "item", "itens")],
              ["Despesas", d.totais.despesas, `${contagem(nDespesas, "item", "itens")} em ${contagem(d.despesas.grupos.length, "grupo", "grupos")}`],
              ["Saldo atual", d.totais.saldoAtual, contagem(d.saldoAtual.contas.length, "conta", "contas")],
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

      <ConferenciaPdf conf={conf} layout={relatorio.layout} />
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

export type EstadoConferencia = "nao_verificado" | "parcial" | "verificado" | "divergente";

/**
 * Resultado de `resumoConferencia`. `estado`, `comparacoes` e `esperadas` são do contrato novo do
 * domínio; enquanto não chegarem, a tela não afirma que os totais conferem.
 */
export type ResultadoConferencia = {
  ok: boolean;
  mensagens: string[];
  estado?: EstadoConferencia;
  comparacoes?: number;
  esperadas?: number;
};

/** Só apresenta o estado da conferência automática do PDF (quem decide é o domínio). */
export function ConferenciaPdf({ conf, layout }: { conf: ResultadoConferencia; layout: RelatorioLido["layout"] }) {
  const [um, varios] = layout === "comparativo" ? ["linha", "linhas"] : ["seção", "seções"];
  const temCobertura = conf.comparacoes != null && conf.esperadas != null;
  const cobertura = temCobertura ? `${conf.comparacoes} de ${contagem(conf.esperadas!, um, varios)}` : null;
  const estado = conf.estado ?? (conf.mensagens.length > 0 ? "divergente" : null);
  const lista =
    conf.mensagens.length > 0 ? (
            <ul className="mt-1 list-disc pl-4">
              {conf.mensagens.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
    ) : null;

  if (estado === "verificado") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-success" data-estado="verificado">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">Conferência completa:</span> {cobertura ? `${cobertura} comparadas` : "totais comparados"} com a
          soma dos itens lidos, sem diferenças.
        </p>
      </div>
    );
  }
  if (estado === "divergente") {
    return (
      <Alert variant="warning" data-estado="divergente">
        <TriangleAlert />
        <AlertDescription>
          <p className="font-semibold">Conferência com diferenças{cobertura ? ` (${cobertura} comparadas)` : ""}:</p>
          {lista}
          </AlertDescription>
        </Alert>
    );
  }
  if (estado === "parcial") {
    return (
      <Alert variant="warning" data-estado="parcial">
        <CircleHelp />
        <AlertDescription>
          <p>
            <span className="font-semibold">Conferência parcial:</span> {cobertura ? `só ${cobertura} puderam ser comparadas` : "só parte dos totais pôde ser comparada"} com a
            soma dos itens. As demais não têm total no PDF para comparar; confira esses valores manualmente.
          </p>
          {lista}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert data-estado="nao_verificado">
      <CircleHelp />
      <AlertDescription>
        <p>
          <span className="font-semibold">Totais não conferidos:</span>{" "}
          {estado === "nao_verificado"
            ? "o PDF não traz totais que permitam comparar com a soma dos itens"
            : "a leitura não informou quantos totais foram comparados"}
          {cobertura ? ` (${cobertura} comparadas)` : ""}. Confira os valores manualmente antes de usar.
        </p>
      </AlertDescription>
        </Alert>
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
        cf.administracao.length > 0 && `${contagem(cf.administracao.length, "membro", "membros")} da administração`,
        (cf.seguro.riscoAbsoluto != null || cf.seguro.coberturas.length > 0) && "seguro",
        cf.seguradora && `seguradora ${cf.seguradora}`,
        (cf.ultCaixaDagua || cf.ultDedetizacao || cf.ultGordura) && "datas de manutenção",
        cf.indices.length > 0 && `${contagem(cf.indices.length, "índice", "índices")} de correção`,
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
