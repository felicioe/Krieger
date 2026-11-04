import { Fragment, useId, useRef, type ReactNode } from "react";
import { Link } from "@/components/app/LinkPermitido";
import { SinalToggle } from "./SinalToggle";
import { AcaoAviso, QuadroAvisos, SemValor, SituacaoResultado, tipoAviso, type ItemAviso } from "./AvisosPrevisao";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { DinheiroInput, InteiroInput, PercentualInput, Selecao } from "@/components/app/inputs";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { novoId } from "@/lib/id";
import { cn, irPara } from "@/lib/utils";
import type { ResultadoPrevisao } from "@/domain/previsao";
import type { AjustePrevisao, Arredondamento, Exercicio, VariacaoMetodo } from "@/domain/types";

const MODOS = [
  { valor: "tradicional" as const, rotulo: "Tradicional (por grupo)" },
  { valor: "detalhado" as const, rotulo: "Detalhado (por despesa)" },
];
export const ARREDONDAMENTO: { valor: Arredondamento; rotulo: string }[] = [
  { valor: "truncar", rotulo: "Truncar (sem centavos, para baixo)" },
  { valor: "arredondar", rotulo: "Arredondar (sem centavos)" },
  { valor: "centavos", rotulo: "Manter centavos" },
];

const pct = (n: number | null | undefined, sinal = false) =>
  n === null || n === undefined ? "—" : `${sinal && n > 0 ? "+" : ""}${formatNumeroBR(n)}%`;

type Prev = NonNullable<Exercicio["prev"]>;

export function PainelPrevisao({
  exercicio: e,
  resultado: r,
  unidades,
  condoId,
  onChange,
}: {
  exercicio: Exercicio;
  resultado: ResultadoPrevisao;
  unidades: number | null;
  condoId: string;
  onChange: (parcial: Partial<Exercicio>) => void;
}) {
  const prev: Prev = e.prev ?? { modo: "tradicional", ajustes: [] };
  const setPrev = (p: Partial<Prev>) => onChange({ prev: { ...prev, ...p } });
  const ajustes = prev.ajustes ?? [];
  const variacaoDespesas = prev.variacaoDespesas ?? { sinal: "+" as const, valor: 0 };

  // Avisos do cálculo: no topo (com o que fazer) e junto do campo a que se referem.
  const idBase = useId();
  const idQuadro = `${idBase}-avisos`;
  const idIndices = `${idBase}-indices`;
  const refVariacao = useRef<HTMLInputElement>(null);
  const parcial = r.rateioSugerido === null;
  const tipos = r.avisos.map((texto) => ({ texto, tipo: tipoAviso(texto) }));
  const textoDe = (...t: string[]) => tipos.filter((a) => t.includes(a.tipo)).map((a) => a.texto).join(" ") || null;
  const avisoVariacao = textoDe("variacao");
  const semUnidades = !unidades;
  const itensAviso: ItemAviso[] = tipos.map(({ texto, tipo }) => {
    let acao: ReactNode = null;
    if (tipo === "unidades")
      acao = (
        <Link to="/condominios/$id" params={{ id: condoId }} className="text-xs font-medium underline underline-offset-2 hover:no-underline">
          Informar unidades no cadastro
        </Link>
      );
    else if (tipo === "variacao")
      acao = <AcaoAviso onClick={() => refVariacao.current?.focus()}>Ir para a variação</AcaoAviso>;
    else if (tipo === "indices")
      acao = <AcaoAviso onClick={() => irPara(idIndices)}>Ir para os índices</AcaoAviso>;
    return { texto, acao };
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
      <div className="min-w-0 space-y-6">
        <QuadroAvisos id={idQuadro} itens={itensAviso} parcial={parcial} />
        <SectionCard titulo="Parâmetros da previsão">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field rotulo="Modo" className="sm:col-span-3">
              <Selecao value={prev.modo} onChange={(v) => setPrev({ modo: v })} opcoes={MODOS} />
            </Field>
            <Field rotulo="Arredondamento do valor por unidade" className="sm:col-span-3">
              <Selecao value={e.arredondamento} onChange={(v) => onChange({ arredondamento: v })} opcoes={ARREDONDAMENTO} />
            </Field>
            <Field rotulo="Percentual fixo" dica="Reajuste aplicado sobre a base realizada deste exercício." aviso={avisoVariacao} className="sm:col-span-2">
              <PercentualInput ref={refVariacao} value={e.variacaoMetodo === "percentual" ? e.variacaoParam : e.variacao} onChange={(v) => onChange({ variacao: v, variacaoMetodo: "percentual", variacaoParam: v })} />
            </Field>
            <Field rotulo="Fundo de reserva" dica="Sobre o valor por unidade." className="sm:col-span-2">
              <PercentualInput value={prev.fundoReservaPct} onChange={(v) => setPrev({ fundoReservaPct: v })} />
            </Field>
            <Field
              rotulo="Dedução (retirar da base)"
              dica="Despesas cujo nome ou grupo contém este texto saem da base. Aceita expressão regular."
              className="sm:col-span-4"
            >
              <Input value={e.deducaoRegex} onChange={(ev) => onChange({ deducaoRegex: ev.target.value })} />
            </Field>
            <CaixaUnidades unidades={unidades} condoId={condoId} className="sm:col-span-2" />
          </div>
        </SectionCard>

        {e.variacaoMetodo === "mediaIndices" && (
          <SectionCard
            id={idIndices}
            titulo="Índices de correção"
            descricao="Usados para a média da variação. Os mais recentes entram primeiro."
          >
            <RepeatableList
              itens={e.consid.indices}
              onChange={(indices) => onChange({ consid: { ...e.consid, indices } })}
              novo={() => ({ ano: null, pct: null, noRelatorio: true })}
              colunas="grid-cols-1 @xs:grid-cols-[7rem_9rem_9rem]"
              cabecalhos={["Ano", "Índice", "No relatório"]}
              rotuloAdicionar="Adicionar índice"
              vazio="Nenhum índice informado."
              reordenavel={false}
              render={(i, up) => (
                <>
                  <InteiroInput aria-label="Ano" value={i.ano} onChange={(v) => up({ ano: v })} maxLength={4} />
                  <PercentualInput aria-label="Índice" value={i.pct} onChange={(v) => up({ pct: v })} />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground @xs:justify-self-center">
                    <Switch checked={i.noRelatorio !== false} onCheckedChange={(v) => up({ noRelatorio: v })} aria-label="Incluir no relatório" />
                    <span className="@xs:hidden">Incluir nas Considerações finais</span>
                  </label>
                </>
              )}
            />
          </SectionCard>
        )}

        <SectionCard
          titulo="Ajustes da previsão"
          descricao="Acréscimos (+) e reduções (−) somados ao anual: obras programadas, contratos novos ou encerrados etc."
        >
          <RepeatableList<AjustePrevisao>
            itens={ajustes}
            onChange={(v) => setPrev({ ajustes: v })}
            novo={() => ({ id: novoId(), descricao: "", sinal: "+", valor: 0 })}
            colunas="grid-cols-1 @min-[12rem]:grid-cols-[5.75rem_minmax(0,1fr)] @xl:grid-cols-[5.75rem_minmax(0,1fr)_9.5rem]"
            cabecalhos={["Sinal", "Descrição", "Valor anual"]}
            reordenavel={false}
            rotuloAdicionar="Adicionar ajuste"
            vazio="Nenhum ajuste. A previsão usa só a base com a variação."
            render={(a, up) => (
              <>
                <SinalToggle valor={a.sinal} onChange={(sinal) => up({ sinal })} rotulo="Sinal do ajuste" />
                <Input aria-label="Descrição" placeholder="Descrição do ajuste" value={a.descricao} onChange={(ev) => up({ descricao: ev.target.value })} />
                <div className="col-span-full @min-[12rem]:col-span-1 @min-[12rem]:col-start-2 @xl:col-start-auto">
                  <DinheiroInput aria-label="Valor anual" value={a.valor} onChange={(v) => up({ valor: Math.abs(v ?? 0) })} />
                </div>
              </>
            )}
          />
        </SectionCard>

        <SectionCard titulo="(+/−) Variação de despesas sugeridas" descricao="Valor anual somado (+) ou subtraído (−) do total ordinário, sem vínculo com grupo de despesas.">
          <div className="@container max-w-md">
            <div className="grid grid-cols-1 gap-2 @min-[12rem]:grid-cols-[5.75rem_minmax(0,1fr)]">
              <SinalToggle valor={variacaoDespesas.sinal} onChange={(sinal) => setPrev({ variacaoDespesas: { ...variacaoDespesas, sinal } })} rotulo="Sinal da variação" />
              <DinheiroInput aria-label="Valor da variação de despesas sugeridas" value={variacaoDespesas.valor} onChange={(v) => setPrev({ variacaoDespesas: { ...variacaoDespesas, valor: Math.abs(v ?? 0) } })} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          titulo={r.modo === "detalhado" ? "Despesas previstas por item" : "Despesas previstas por grupo"}
          descricao="Baseado exclusivamente no realizado reduzido do período analisado."
        >
          <TabelaLinhas r={r} />
        </SectionCard>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Resumo
          r={r}
          arredondamento={e.arredondamento}
          metodo={e.variacaoMetodo}
          parcial={parcial}
          semUnidades={semUnidades}
          idQuadro={idQuadro}
          aoAprovar={() => onChange({ rateioAprovado: r.rateioSugerido })}
        />
      </aside>
    </div>
  );
}

function TabelaLinhas({ r }: { r: ResultadoPrevisao }) {
  if (r.linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">Lance as despesas no demonstrativo da prestação de contas para ver a previsão.</p>;
  }
  const ajustesPorGrupo = (g: string) => (g ? r.ajustes.filter((a) => a.grupo === g) : []);
  const grupos = [...new Set(r.linhas.map((l) => l.grupo))];
  const gerais = r.ajustes.filter((a) => !a.grupo || !grupos.includes(a.grupo));
  const linhaAjuste = (a: AjustePrevisao) => (
    <TableRow key={a.id} className="text-sm">
      <TableCell className="pl-6 text-muted-foreground">
        <span className={cn("mr-1.5 font-semibold", a.sinal === "-" ? "text-destructive" : "text-primary")}>
          {a.sinal === "-" ? "−" : "+"}
        </span>
        {a.descricao || "Ajuste sem descrição"}
      </TableCell>
      <TableCell className="num text-right text-muted-foreground">—</TableCell>
      <TableCell className={cn("num whitespace-nowrap text-right", a.sinal === "-" && "text-destructive")}>
        {a.sinal === "-" ? "−" : ""}
        {formatBRL(Math.abs(a.valor))}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="-mx-5 -mb-5 overflow-x-auto @max-[14rem]:-mx-3 @max-[14rem]:-mb-3">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary">
              {r.modo === "detalhado" ? "Despesa" : "Grupo"}
            </TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-primary">Realizado</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-primary">Média</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((g) => {
            const linhas = r.linhas.filter((l) => l.grupo === g);
            return (
              <Fragment key={g}>
                {r.modo === "detalhado" && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={3} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g || "Sem grupo"}
                    </TableCell>
                  </TableRow>
                )}
                {linhas.map((l, i) => (
                  <TableRow key={`${g}-${i}`} className={cn(l.deduzida && l.previsto === 0 && "text-muted-foreground")}>
                    <TableCell className={cn(r.modo === "detalhado" && "pl-6")}>
                      <span>{l.nome || "Sem nome"}</span>
                      {l.deduzida && (
                        <Badge variant="warning" className="ml-2 align-middle text-[10px]">
                          {l.previsto === 0 ? "deduzida" : "com dedução"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="num whitespace-nowrap text-right">{formatBRL(l.realizado)}</TableCell>
                    <TableCell className="num whitespace-nowrap text-right font-medium">{formatBRL(l.previsto / r.mesesAnalisados)}</TableCell>
                  </TableRow>
                ))}
                {ajustesPorGrupo(g).map(linhaAjuste)}
              </Fragment>
            );
          })}
          {gerais.length > 0 && (
            <>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={3} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ajustes gerais
                </TableCell>
              </TableRow>
              {gerais.map(linhaAjuste)}
            </>
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-secondary hover:bg-secondary">
            <TableCell className="font-semibold text-primary">Anual ajustado</TableCell>
            <TableCell className="num whitespace-nowrap text-right">{formatBRL(r.base)}</TableCell>
            <TableCell className="num whitespace-nowrap text-right font-semibold text-primary">{formatBRL(r.mensal)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function LinhaResumo({
  rotulo,
  valor,
  forte,
  negativo,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  forte?: boolean;
  negativo?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-nowrap items-baseline justify-between gap-3 py-1 text-sm", forte && "font-semibold text-primary", className)}>
      <span className={cn("min-w-0 flex-1 truncate", !forte && "text-muted-foreground")} title={rotulo}>{rotulo}</span>
      <span className={cn("num whitespace-nowrap", negativo && "text-destructive")}>{valor}</span>
    </div>
  );
}

const ROTULO_ARRED: Record<Arredondamento, string> = {
  truncar: "truncado, sem centavos",
  arredondar: "arredondado, sem centavos",
  centavos: "com centavos",
};

function Resumo({
  r,
  arredondamento,
  metodo,
  parcial,
  semUnidades,
  idQuadro,
  anoAnterior,
  aoAprovar,
}: {
  r: ResultadoPrevisao;
  arredondamento: Arredondamento;
  metodo: VariacaoMetodo;
  parcial: boolean;
  semUnidades: boolean;
  idQuadro: string;
  anoAnterior?: number | string | undefined;
  aoAprovar: () => void;
}) {
  const ausente = (n: number | null, motivo?: string) => (n === null ? <SemValor motivo={motivo} /> : formatBRL(n));
  return (
    <section className="rounded-md border bg-card shadow-sm" aria-label="Resumo da previsão">
      <header className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Resumo da previsão</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Atualiza a cada alteração.</p>
      </header>
      <div className="px-5 py-4">
        <div className="mb-3">
          <SituacaoResultado parcial={parcial} avisos={r.avisos.length} idQuadro={idQuadro} />
        </div>
        <LinhaResumo rotulo={anoAnterior ? `Base (realizado de ${anoAnterior})` : "Base (despesas realizadas)"} valor={formatBRL(r.base)} />
        <LinhaResumo rotulo="(−) Dedução" valor={formatBRL(r.deducao)} negativo={r.deducao > 0} />
        <LinhaResumo
          rotulo={metodo === "valor" ? "(+) Variação" : `(+) Variação ${pct(r.variacaoPct)}`}
          valor={formatBRL(r.variacaoValor)}
        />
        {r.variacaoDespesasValor !== 0 && (
          <LinhaResumo
            rotulo="Histórico de variação de despesas sugeridas"
            valor={`${r.variacaoDespesasValor < 0 ? "−" : "+"}${formatBRL(Math.abs(r.variacaoDespesasValor))}`}
            negativo={r.variacaoDespesasValor < 0}
          />
        )}
        {r.ajustes.filter((a) => Number(a.valor) > 0).map((a) => {
          const valor = a.sinal === "-" ? -Math.abs(a.valor) : Math.abs(a.valor);
          return (
            <LinhaResumo
              key={a.id}
              rotulo={`Histórico: ${a.descricao || "Ajuste sem descrição"}`}
              valor={`${valor < 0 ? "−" : "+"}${formatBRL(Math.abs(valor))}`}
              negativo={valor < 0}
            />
          );
        })}
        <LinhaResumo rotulo="Anual ajustado" valor={formatBRL(r.totalAnual)} forte className="mt-1 border-t pt-2" />

        <div className="mt-4 border-t pt-3">
          <LinhaResumo rotulo={`Média mensal (÷ ${r.mesesAnalisados})`} valor={formatBRL(r.mensal)} />
          <LinhaResumo rotulo="(÷) Unidades" valor={r.unidades ? String(r.unidades) : <SemValor motivo="não informado" />} />
          <LinhaResumo rotulo="Cota por unidade" valor={ausente(r.cotaUnidade)} forte />
          <LinhaResumo rotulo={`(+) Reserva por unidade ${pct(r.fundoReservaPct)}`} valor={ausente(r.reservaUnidade)} />
        </div>

        <ValorPorUnidade valor={r.rateioSugerido} rodape={ROTULO_ARRED[arredondamento]} semUnidades={semUnidades} />

        <div className="mt-3">
          <LinhaResumo rotulo="Rateio atual" valor={formatBRL(r.rateioAtual)} />
          <LinhaResumo
            rotulo="Índice de reajuste"
            valor={r.indice === null ? <SemValor /> : pct(r.indice, true)}
            forte
            negativo={r.indice !== null && r.indice < 0}
          />
        </div>

        {r.rateioSugerido !== null && (
          <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={aoAprovar}>
            Usar como rateio aprovado
          </Button>
        )}

      </div>
    </section>
  );
}

/** Destaque do valor por unidade: escuro quando calculado; tracejado e explicado quando falta dado. */
export function ValorPorUnidade({
  valor,
  rodape,
  semUnidades,
  titulo = "Valor por unidade",
}: {
  valor: number | null;
  rodape: string;
  semUnidades: boolean;
  titulo?: string;
}) {
  if (valor === null) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-warning bg-warning/10 px-4 py-3 text-warning-foreground">
        <div className="text-xs font-semibold uppercase tracking-wide">{titulo}</div>
        <div className="mt-0.5 text-base font-semibold">Não calculado</div>
        <div className="text-xs">
          {semUnidades ? "Falta a quantidade de unidades no cadastro do condomínio." : "Faltam dados para o cálculo; veja os avisos."}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-md bg-sidebar px-4 py-3 text-sidebar-foreground">
      <div className="text-xs uppercase tracking-wide text-sidebar-muted">{titulo}</div>
      <div className="num mt-0.5 break-words text-2xl font-semibold">{formatBRL(valor)}</div>
      <div className="text-xs text-sidebar-muted">{rodape}</div>
    </div>
  );
}

/** Quantidade de unidades (só leitura, vem do cadastro); sem unidades fica em destaque com o atalho. */
export function CaixaUnidades({ unidades, condoId, className }: { unidades: number | null; condoId: string; className?: string }) {
  const falta = !unidades;
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">Unidades</span>
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center justify-between gap-x-2 rounded-md border px-3 py-1 text-sm max-md:min-h-11 pointer-coarse:min-h-11",
          falta ? "border-warning bg-warning/10 text-warning-foreground" : "bg-muted/40",
        )}
      >
        <span className={cn(!falta && "num", falta && "font-medium")}>{falta ? "Não informado" : unidades}</span>
        {condoId && (
          <Link
            to="/condominios/$id"
            params={{ id: condoId }}
            className={cn("alvo-toque text-xs underline underline-offset-2", falta ? "font-medium" : "text-primary")}
            aria-label={falta ? "Informar unidades no cadastro do condomínio" : "Alterar unidades no cadastro do condomínio"}
          >
            {falta ? "informar" : "alterar"}
          </Link>
        )}
      </div>
    </div>
  );
}
