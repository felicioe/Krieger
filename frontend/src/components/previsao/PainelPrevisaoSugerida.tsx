import { useId, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { DinheiroInput, PercentualInput, Selecao } from "@/components/app/inputs";
import { formatBRL, formatNumeroBR } from "@/lib/format";
import { novoId } from "@/lib/id";
import { cn } from "@/lib/utils";
import { calcularPrevisaoSugerida, calcularPrevisaoSugeridaPorUnidade } from "@/domain/previsaoSugerida";
import type { AjustePrevisao, Exercicio, PrevisaoSugeridaExercicio } from "@/domain/types";
import { ARREDONDAMENTO, CaixaUnidades } from "./PainelPrevisao";
import { QuadroAvisos, SemValor, SituacaoResultado } from "./AvisosPrevisao";
import { SinalToggle } from "./SinalToggle";

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${formatNumeroBR(n)}%`);
const comSinal = (n: number) => `${n < 0 ? "−" : ""}${formatBRL(Math.abs(n))}`;

/** Previsão orçamentária sugerida pelo Systemar: categorias (só leitura), deduções e variação editáveis. */
export function PainelPrevisaoSugerida({
  exercicio: e,
  previsao: p,
  unidades,
  condoId,
  onChange,
}: {
  exercicio: Exercicio;
  previsao: PrevisaoSugeridaExercicio;
  unidades: number | null;
  condoId: string;
  onChange: (parcial: Partial<Exercicio>) => void;
}) {
  const r = useMemo(() => calcularPrevisaoSugerida(p), [p]);
  const fundoReservaPct = e.prev?.fundoReservaPct ?? null;
  const u = useMemo(
    () => calcularPrevisaoSugeridaPorUnidade(r.rateioMensalSugerido, unidades, fundoReservaPct ?? 0, e.arredondamento),
    [r.rateioMensalSugerido, unidades, fundoReservaPct, e.arredondamento],
  );
  const setP = (parcial: Partial<PrevisaoSugeridaExercicio>) => onChange({ previsaoSugerida: { ...p, ...parcial } });
  const prev = e.prev ?? { modo: "tradicional" as const, ajustes: [] };
  const idQuadro = `${useId()}-avisos`;
  const parcial = u.valorUnidade === null;
  const itensAviso = parcial
    ? [
        {
          texto: "Informe a quantidade de unidades no cadastro do condomínio para ver o valor por unidade.",
          acao: condoId ? (
            <Link to="/condominios/$id" params={{ id: condoId }} className="text-xs font-medium underline underline-offset-2 hover:no-underline">
              Informar unidades no cadastro
            </Link>
          ) : null,
        },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-6">
        <QuadroAvisos id={idQuadro} itens={itensAviso} parcial={parcial} />
        <SectionCard titulo="Categorias de despesa" descricao="Efetivamente realizado no ano, como veio do PDF do Systemar.">
          {p.categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">O PDF não trouxe categorias de despesa.</p>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary">Categoria</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-primary">Anual</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-primary">Média mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.categorias.map((c, i) => (
                    <TableRow key={`${c.nome}-${i}`}>
                      <TableCell>{c.nome || "Sem nome"}</TableCell>
                      <TableCell className="num whitespace-nowrap text-right">{formatBRL(c.anual)}</TableCell>
                      <TableCell className="num whitespace-nowrap text-right text-muted-foreground">{formatBRL(c.media)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-secondary hover:bg-secondary">
                    <TableCell className="font-semibold text-primary">Total das despesas</TableCell>
                    <TableCell className="num whitespace-nowrap text-right font-semibold text-primary">{formatBRL(r.totalDespesasAno)}</TableCell>
                    <TableCell className="num whitespace-nowrap text-right">{formatBRL(r.totalDespesasMedia)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </SectionCard>

        <SectionCard titulo="Deduções" descricao="Despesas a deduzir (+ soma, − subtrai). Adicione, altere ou remova linhas à vontade.">
          <RepeatableList<AjustePrevisao>
            itens={p.deducoes}
            onChange={(deducoes) => setP({ deducoes })}
            novo={() => ({ id: novoId(), descricao: "", sinal: "-", valor: 0 })}
            colunas="grid-cols-[5.5rem_minmax(0,1fr)] @2xl:grid-cols-[5.5rem_minmax(0,1fr)_9.5rem]"
            cabecalhos={["Sinal", "Descrição", "Valor anual"]}
            reordenavel={false}
            rotuloAdicionar="Adicionar dedução"
            vazio="Nenhuma dedução."
            render={(d, up) => (
              <>
                <SinalToggle valor={d.sinal} onChange={(sinal) => up({ sinal })} rotulo="Sinal da dedução" />
                <Input aria-label="Descrição" placeholder="Descrição da dedução" value={d.descricao} onChange={(ev) => up({ descricao: ev.target.value })} />
                <div className="col-span-2 sm:col-span-1">
                  <DinheiroInput aria-label="Valor anual" value={d.valor} onChange={(v) => up({ valor: Math.abs(v ?? 0) })} />
                </div>
              </>
            )}
          />
        </SectionCard>

        <SectionCard titulo="Variação de despesas sugeridas" descricao="Valor anual somado (+) ou subtraído (−) do total ordinário.">
          <div className="grid max-w-md grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
            <SinalToggle valor={p.variacao.sinal} onChange={(sinal) => setP({ variacao: { ...p.variacao, sinal } })} rotulo="Sinal da variação" />
            <DinheiroInput
              aria-label="Valor da variação"
              value={p.variacao.valor}
              onChange={(v) => setP({ variacao: { ...p.variacao, valor: Math.abs(v ?? 0) } })}
            />
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-md border bg-card" aria-label="Resultado da previsão">
          <header className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Resultado</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Atualiza a cada alteração.</p>
          </header>
          <div className="px-5 py-4">
            <LinhaResumo rotulo="Total das despesas do ano" valor={formatBRL(r.totalDespesasAno)} />
            <LinhaResumo rotulo="(±) Deduções" valor={comSinal(r.deducoesTotal)} negativo={r.deducoesTotal < 0} />
            <LinhaResumo rotulo="Total ordinário" valor={formatBRL(r.totalOrdinario)} forte className="mt-1 border-t pt-2" />
            <LinhaResumo rotulo="(±) Variação" valor={comSinal(r.variacaoValor)} negativo={r.variacaoValor < 0} />
            <LinhaResumo rotulo="Total final (anual)" valor={formatBRL(r.totalFinal)} forte className="mt-1 border-t pt-2" />

            <div className="mt-4 rounded-md bg-sidebar px-4 py-3 text-sidebar-foreground">
              <div className="text-xs uppercase tracking-wide text-sidebar-muted">Rateio mensal sugerido</div>
              <div className="num mt-0.5 text-2xl font-semibold">{formatBRL(r.rateioMensalSugerido)}</div>
              <div className="text-xs text-sidebar-muted">Total final ÷ 12</div>
            </div>

            <div className="mt-3 space-y-2">
              <Field rotulo="Rateio mensal atual" dica="Do ano anterior, lido do PDF.">
                <DinheiroInput value={p.rateioMensalAtual} onChange={(v) => setP({ rateioMensalAtual: v })} />
              </Field>
              <LinhaResumo
                rotulo="Índice sugerido para correção"
                valor={r.indiceSugerido === null ? <SemValor /> : pct(r.indiceSugerido)}
                forte
                negativo={r.indiceSugerido !== null && r.indiceSugerido < 0}
              />
              {r.indiceSugerido === null && (
                <p className="text-xs text-muted-foreground">Sem o rateio mensal atual, o índice não é calculado.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-md border bg-card" aria-label="Previsão orçamentária por unidade">
          <header className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Previsão orçamentária por unidade</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Só para fins de validação.</p>
          </header>
          <div className="space-y-3 px-5 py-4">
            <SituacaoResultado parcial={parcial} avisos={parcial ? 1 : 0} idQuadro={idQuadro} />
            <div className="grid grid-cols-2 gap-3">
              <Field rotulo="Fundo de reserva">
                <PercentualInput
                  value={fundoReservaPct}
                  onChange={(v) => onChange({ prev: { ...prev, fundoReservaPct: v } })}
                />
              </Field>
              <CaixaUnidades unidades={unidades} condoId={condoId} />
            </div>
            <Field rotulo="Arredondamento do valor por unidade">
              <Selecao value={e.arredondamento} onChange={(v) => onChange({ arredondamento: v })} opcoes={ARREDONDAMENTO} />
            </Field>
            <div>
              <LinhaResumo rotulo="Cota por unidade" valor={u.cotaUnidade === null ? <SemValor /> : formatBRL(u.cotaUnidade)} />
              <LinhaResumo
                rotulo={`(+) Reserva por unidade ${formatNumeroBR(fundoReservaPct ?? 0)}%`}
                valor={u.reservaUnidade === null ? <SemValor /> : formatBRL(u.reservaUnidade)}
              />
              <LinhaResumo
                rotulo="Valor por unidade"
                valor={u.valorUnidade === null ? "Não calculado" : formatBRL(u.valorUnidade)}
                forte
                className="mt-1 border-t pt-2"
              />
            </div>
          </div>
        </section>
      </aside>
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
    <div className={cn("flex items-baseline justify-between gap-3 py-1 text-sm", forte && "font-semibold text-primary", className)}>
      <span className={cn(!forte && "text-muted-foreground")}>{rotulo}</span>
      <span className={cn("num whitespace-nowrap", negativo && "text-destructive")}>{valor}</span>
    </div>
  );
}
