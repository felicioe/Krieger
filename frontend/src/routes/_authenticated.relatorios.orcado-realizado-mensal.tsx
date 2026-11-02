import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { listaQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { normalizarExercicio } from "@/domain/exercicio";
import { compararPrevistoRealizadoMensal, type CelulaMensal } from "@/domain/previstoRealizadoMensal";
import type { Condominio, Exercicio, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/relatorios/orcado-realizado-mensal")({
  head: () => cabecalho("Orçado × Realizado mensal", "Conferência mensal do orçamento e do realizado."),
  loader: ({ context: { queryClient } }) => Promise.all([queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")), queryClient.ensureQueryData(listaQuery<Condominio>("condominios")), queryClient.ensureQueryData(listaQuery<Mensal>("mensais"))]),
  component: Pagina,
});

function Pagina() {
  const { data: raw } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const exercicios = useMemo(() => raw.map(normalizarExercicio).sort((a, b) => Number(b.ano) - Number(a.ano)), [raw]);
  const [exercicioId, setExercicioId] = useState(exercicios[0]?.id ?? "");
  const [inicio, setInicio] = useState(1); const [fim, setFim] = useState(12);
  const [orcado, setOrcado] = useState(true); const [horizontal, setHorizontal] = useState(true); const [vertical, setVertical] = useState(false);
  const e = exercicios.find((x) => x.id === exercicioId) ?? exercicios[0];
  const condo = e ? condominios.find((c) => c.id === e.condoId) : null;
  const r = e ? compararPrevistoRealizadoMensal(e, mensais, { condominio: condo, inicio, fim }) : null;
  const opEx = exercicios.map((x) => ({ valor: x.id, rotulo: `${x.condoNome || condominios.find((c) => c.id === x.condoId)?.nome || "Condomínio"} · previsão ${x.ano}` }));
  const opMes = Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), rotulo: `Mês ${i + 1}` }));
  if (!r || !e) return <SectionCard titulo="Nenhuma previsão disponível"><p className="text-sm text-muted-foreground">Crie uma previsão orçamentária para gerar este relatório.</p></SectionCard>;
  const qtd = (orcado ? 2 : 1) + (horizontal ? 1 : 0) + (vertical ? 2 : 0);
  const celulas = (c: CelulaMensal, i: number) => <>{orcado && <><td className="num border-l px-3 py-2 text-right">{formatBRL(c.previsto)}</td><td className="num px-3 py-2 text-right">{formatBRL(c.realizado)}</td></>}{!orcado && <td className="num border-l px-3 py-2 text-right">{formatBRL(c.realizado)}</td>}{horizontal && <td className="num px-3 py-2 text-right text-muted-foreground">{c.horizontal == null ? "—" : `${c.horizontal.toFixed(2)}%`}</td>}{vertical && <><td className="num px-3 py-2 text-right text-muted-foreground">{c.verticalPrevisto == null ? "—" : `${c.verticalPrevisto.toFixed(2)}%`}</td><td className="num px-3 py-2 text-right text-muted-foreground">{c.verticalRealizado == null ? "—" : `${c.verticalRealizado.toFixed(2)}%`}</td></>}</>;
  return <><PageHeader titulo="Orçado × Realizado mensal" descricao="Conferência mês a mês, com totais por linha e por coluna." /><SectionCard titulo="Parâmetros" descricao="Todas as análises respeitam exclusivamente o período selecionado."><div className="grid gap-4 sm:grid-cols-4"><Field rotulo="Previsão"><Selecao value={e.id} onChange={setExercicioId} opcoes={opEx} /></Field><Field rotulo="De"><Selecao value={String(inicio)} onChange={(v) => setInicio(Math.min(Number(v), fim))} opcoes={opMes} /></Field><Field rotulo="Até"><Selecao value={String(fim)} onChange={(v) => setFim(Math.max(Number(v), inicio))} opcoes={opMes} /></Field><div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-2"><Op id="mr-orcado" checked={orcado} onChange={setOrcado}>Mostrar orçado</Op><Op id="mr-h" checked={horizontal} onChange={setHorizontal}>Análise horizontal</Op><Op id="mr-v" checked={vertical} onChange={setVertical}>Análise vertical</Op></div></div></SectionCard>{r.avisos.length > 0 && <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{r.avisos.join(" ")}</div>}<SectionCard className="mt-6" titulo="Conferência mensal" descricao={`${r.meses[0]?.rotulo} a ${r.meses.at(-1)?.rotulo} · ${r.relatoriosUsados} relatório(s) mensal(is) considerado(s).`}><div className="max-h-[70vh] overflow-auto rounded-md border"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-10 bg-card"><tr className="border-b"><th rowSpan={2} className="sticky left-0 z-20 min-w-64 bg-card px-3 py-2 text-left">Grupo</th>{r.meses.map((m) => <th key={m.posicao} colSpan={qtd} className="border-l px-3 py-2 text-center">{m.rotulo}</th>)}<th colSpan={orcado ? 2 : 1} className="border-l px-3 py-2 text-center">Total do período</th></tr><tr className="border-b text-xs text-muted-foreground">{r.meses.map((m) => <HeaderMes key={m.posicao} pos={m.posicao} orcado={orcado} horizontal={horizontal} vertical={vertical} />)}{orcado ? <><th className="border-l px-3 py-1 text-right">Orçado</th><th className="px-3 py-1 text-right">Realizado</th></> : <th className="border-l px-3 py-1 text-right">Realizado</th>}</tr></thead><tbody>{r.linhas.map((l) => <tr key={l.grupo} className="border-b last:border-0"><th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">{l.grupo}</th>{l.mensal.map((c, i) => <>{celulas(c, i)}</>)}{orcado ? <><td className="num border-l px-3 py-2 text-right font-medium">{formatBRL(l.total.previsto)}</td><td className="num px-3 py-2 text-right font-medium">{formatBRL(l.total.realizado)}</td></> : <td className="num border-l px-3 py-2 text-right font-medium">{formatBRL(l.total.realizado)}</td>}</tr>)}<tr className="border-t-2 bg-muted/60 font-semibold"><th className="sticky left-0 bg-muted/60 px-3 py-2 text-left">Total</th>{r.meses.map((m, i) => { const p = r.linhas.reduce((s, l) => s + l.mensal[i]!.previsto, 0); const real = r.linhas.reduce((s, l) => s + l.mensal[i]!.realizado, 0); return <>{orcado && <><td className="num border-l px-3 py-2 text-right">{formatBRL(p)}</td><td className="num px-3 py-2 text-right">{formatBRL(real)}</td></>}{!orcado && <td className="num border-l px-3 py-2 text-right">{formatBRL(real)}</td>}{horizontal && <td className="num px-3 py-2 text-right">{p ? `${(((real - p) / Math.abs(p)) * 100).toFixed(2)}%` : "—"}</td>}{vertical && <><td /><td /></>}</>; })}{orcado ? <><td className="num border-l px-3 py-2 text-right">{formatBRL(r.total.previsto)}</td><td className="num px-3 py-2 text-right">{formatBRL(r.total.realizado)}</td></> : <td className="num border-l px-3 py-2 text-right">{formatBRL(r.total.realizado)}</td>}</tr></tbody></table></div></SectionCard></>;
}
function HeaderMes({ pos, orcado, horizontal, vertical }: { pos: number; orcado: boolean; horizontal: boolean; vertical: boolean }) { return <>{orcado ? <><th className="border-l px-3 py-1 text-right">Orçado</th><th className="px-3 py-1 text-right">Realizado</th></> : <th className="border-l px-3 py-1 text-right">Realizado</th>}{horizontal && <th className="px-3 py-1 text-right">H %</th>}{vertical && <><th className="px-3 py-1 text-right">V orç.</th><th className="px-3 py-1 text-right">V real.</th></>}</>; }
function Op({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: string }) { return <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} /><Label htmlFor={id}>{children}</Label></label>; }
