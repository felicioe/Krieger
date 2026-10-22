import { Fragment, type ReactNode } from "react";
import { GraficoComparativo } from "@/components/previsto-realizado/GraficoComparativo";
import { TabelaComparativo, pctTexto } from "@/components/previsto-realizado/TabelaComparativo";
import { GraficoPizza } from "@/components/relatorio/GraficoPizza";
import { dataParaBR, formatBRL, formatData, formatNumeroBR } from "@/lib/format";
import { dataVistoria } from "@/domain/painel";
import { cn } from "@/lib/utils";
import { nomeParaRelatorio } from "@/domain/condominio";
import { SECOES, type RelatorioFinal, type SecaoId } from "@/domain/relatorioFinal";
import type { ResultadoPrevisaoSugerida, ResultadoPrevisaoSugeridaPorUnidade } from "@/domain/previsaoSugerida";
import type { Condominio, ConfigEscritorio, Exercicio, LinhaValor, PrevisaoSugeridaExercicio } from "@/domain/types";
import { contagem } from "@/components/app/textos";

/** Prévia na tela do documento montado (sem PDF). Só as seções incluídas, numeradas na ordem. */
export function PreviaRelatorio({
  rel,
  exercicio: e,
  condominio,
  escritorio,
}: {
  rel: RelatorioFinal;
  exercicio: Exercicio;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
}) {
  const incluidas = SECOES.filter((s) => rel.secoes[s.id]);
  const numero = (id: SecaoId) => incluidas.filter((s) => s.id !== "capa" && s.id !== "assinatura").findIndex((s) => s.id === id) + 1;
  const nomeCondo = condominio ? nomeParaRelatorio(condominio) : e.condoNome;
  const d = rel.demonstrativo;

  if (incluidas.length === 0) {
    return <p className="rounded-md border border-dashed bg-card px-6 py-16 text-center text-sm text-muted-foreground">Nenhuma seção incluída.</p>;
  }

  return (
    <article className="mx-auto max-w-[52rem] rounded-sm border bg-card px-6 py-8 text-sm shadow-sm sm:px-12 sm:py-12" aria-label="Prévia do relatório final">
      {rel.secoes.capa && (
        <section className="flex min-h-[28rem] flex-col items-center justify-center border-b pb-12 text-center">
          {escritorio?.logo && <img src={escritorio.logo} alt={escritorio.nome || "Logo do escritório"} className="mb-10 max-h-20 w-auto" />}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Prestação de contas</p>
          <h1 className="mt-3 text-2xl font-semibold text-primary">{nomeCondo}</h1>
          {condominio?.cnpj && <p className="num mt-1 text-muted-foreground">CNPJ {condominio.cnpj}</p>}
          <p className="mt-6 text-lg">Exercício {e.ano}</p>
          {d?.periodo.ini && d.periodo.fim && (
            <p className="num text-muted-foreground">
              {d.periodo.ini} a {d.periodo.fim}
            </p>
          )}
          <p className="mt-10 text-muted-foreground">{[e.cidade, e.dataEmissao].filter(Boolean).join(", ") || "Cidade e data de emissão não informadas"}</p>
          {escritorio?.nome && <p className="mt-1 text-xs text-muted-foreground">{escritorio.nome}</p>}
        </section>
      )}

      {rel.secoes.demonstrativo && (
        <Secao n={numero("demonstrativo")} titulo="Demonstrativo de receitas e despesas">
          {!d ? (
            <Vazio>Sem demonstrativo.</Vazio>
          ) : (
            <div className="space-y-5">
              <Bloco titulo="Saldo anterior" linhas={d.saldoAnterior.contas} total={d.totais.saldoAnterior} />
              <Bloco titulo="Receitas" linhas={d.receitas.itens} total={d.totais.receitas} />
              <div>
                <h4 className="mb-1 font-semibold">Despesas</h4>
                <table className="w-full">
                  <tbody>
                    {d.despesas.grupos.map((g) => {
                      const sub = g.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
                      return (
                        <Fragment key={g.nome}>
                          <tr>
                            <td colSpan={2} className="pt-2 text-xs font-semibold uppercase tracking-wide text-primary">
                              {g.nome || "Sem grupo"}
                            </td>
                          </tr>
                          {g.itens.map((i, k) => (
                            <Linha key={k} nome={i.nome} valor={i.valor} recuo />
                          ))}
                          <Linha nome={`Subtotal ${g.nome}`} valor={sub} sutil />
                        </Fragment>
                      );
                    })}
                    <Linha nome="Total das despesas" valor={d.totais.despesas} forte />
                  </tbody>
                </table>
              </div>
              <Bloco titulo="Saldo atual" linhas={d.saldoAtual.contas} total={d.totais.saldoAtual} />
              <table className="w-full rounded-sm bg-muted/50">
                <tbody>
                  <Linha nome="Saldo anterior" valor={d.totais.saldoAnterior} />
                  <Linha nome="(+) Receitas" valor={d.totais.receitas} />
                  <Linha nome="(−) Despesas" valor={d.totais.despesas} />
                  <Linha nome="(=) Saldo atual" valor={d.totais.saldoAtual} forte />
                </tbody>
              </table>
            </div>
          )}
        </Secao>
      )}

      {rel.secoes.consideracoes && (
        <Secao n={numero("consideracoes")} titulo="Considerações finais">
          <Consideracoes e={e} rel={rel} />
        </Secao>
      )}

      {rel.secoes.previsao && (
        <Secao
          n={numero("previsao")}
          titulo={`Previsão orçamentária — Exercício ${e.ano}`}
          {...(d?.periodo.ini && d.periodo.fim ? { sub: `Período do exercício: ${d.periodo.ini} a ${d.periodo.fim}.` } : {})}
        >
          {e.previsaoSugerida && rel.previsaoSugerida && rel.previsaoSugeridaPorUnidade ? (
            <PrevisaoSugeridaPrevia e={e} previsao={e.previsaoSugerida} r={rel.previsaoSugerida} u={rel.previsaoSugeridaPorUnidade} />
          ) : (
            <>
          <table className="w-full">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1 text-left font-semibold">{rel.previsao.modo === "detalhado" ? "Rubrica" : "Grupo"}</th>
                <th className="py-1 text-right font-semibold">Realizado {e.ano}</th>
                <th className="py-1 text-right font-semibold">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {rel.previsao.linhas.map((l, i) => (
                <tr key={i} className="border-b border-dashed last:border-0">
                  <td className="py-1">
                    {l.nome}
                    {rel.previsao.modo === "detalhado" && <span className="text-xs text-muted-foreground"> · {l.grupo}</span>}
                    {l.deduzida && <span className="text-xs text-muted-foreground"> (com dedução)</span>}
                  </td>
                  <td className="num py-1 text-right text-muted-foreground">{formatBRL(l.realizado)}</td>
                  <td className="num py-1 text-right">{formatBRL(l.previsto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rel.previsao.ajustes.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 font-semibold">Ajustes</h4>
              <table className="w-full">
                <tbody>
                  {rel.previsao.ajustes.map((a) => (
                    <Linha
                      key={a.id}
                      nome={`${a.sinal === "-" ? "(−)" : "(+)"} ${a.descricao || "Ajuste"}${a.grupo ? ` · ${a.grupo}` : ""}`}
                      valor={a.valor}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <table className="mt-4 w-full rounded-sm bg-muted/50">
            <tbody>
              <Linha nome="Base (despesas realizadas)" valor={rel.previsao.base} />
              <Linha nome="(−) Dedução" valor={rel.previsao.deducao} />
              <Linha
                nome={e.variacaoMetodo === "valor" ? "(+) Variação" : `(+) Variação ${formatNumeroBR(rel.previsao.variacaoPct)}%`}
                valor={rel.previsao.variacaoValor}
              />
              <Linha nome="(+) Ajustes" valor={rel.previsao.ajustesMais} />
              <Linha nome="(−) Ajustes" valor={rel.previsao.ajustesMenos} />
              <Linha nome="Anual ajustado" valor={rel.previsao.totalAnual} forte />
              <Linha nome="Mensal (÷ 12)" valor={rel.previsao.mensal} />
              <Linha nome={`Cota por unidade (÷ ${rel.previsao.unidades ?? "—"} unidades)`} valor={rel.previsao.cotaUnidade} />
              <Linha nome={`(+) Reserva por unidade ${formatNumeroBR(rel.previsao.fundoReservaPct)}%`} valor={rel.previsao.reservaUnidade} />
              <Linha nome="Valor por unidade" valor={rel.previsao.rateioSugerido} forte />
              <Linha nome="Rateio atual" valor={rel.previsao.rateioAtual} />
              <tr>
                <td className="px-3 py-1">Índice de reajuste</td>
                <td className="num px-3 py-1 text-right">{pctTexto(rel.previsao.indice)}</td>
              </tr>
              {e.rateioAprovado != null && <Linha nome="Rateio aprovado" valor={e.rateioAprovado} forte />}
            </tbody>
          </table>
            </>
          )}
        </Secao>
      )}

      {rel.secoes.previstoRealizado && (
        <Secao
          n={numero("previstoRealizado")}
          titulo="Previsto × Realizado"
          sub={`Previsão ${e.ano} × realizado de ${rel.comparativo.meses[0]?.rotulo} a ${rel.comparativo.mesAte.rotulo} (${contagem(rel.comparativo.relatoriosUsados, "relatório mensal", "relatórios mensais")}).`}
        >
          <table className="mb-4 w-full rounded-sm bg-muted/50">
            <tbody>
              <Linha nome="Previsto anual" valor={rel.comparativo.total.previstoAnual} />
              <Linha nome={`Previsto até ${rel.comparativo.mesAte.rotulo}`} valor={rel.comparativo.total.previsto} />
              <Linha nome={`Realizado até ${rel.comparativo.mesAte.rotulo}`} valor={rel.comparativo.total.realizado} />
              <tr className="font-semibold">
                <td className="px-3 py-1">Diferença</td>
                <td className="num px-3 py-1 text-right">
                  {formatBRL(rel.comparativo.total.diferenca)} ({pctTexto(rel.comparativo.total.pct)})
                </td>
              </tr>
            </tbody>
          </table>
          <TabelaComparativo r={rel.comparativo} compacta />
        </Secao>
      )}

      {rel.secoes.analise && (
        <Secao n={numero("analise")} titulo="Análise gráfica">
          <h4 className="mb-2 font-semibold">Previsto × realizado por grupo</h4>
          {rel.comparativo.grupos.length ? <GraficoComparativo r={rel.comparativo} /> : <Vazio>Sem dados para o gráfico.</Vazio>}
          {e.mostrarPizza !== false && (
            <>
              <h4 className="mb-2 mt-6 font-semibold">Despesas do exercício {e.ano} por grupo</h4>
              {rel.despesasGrupo.length ? <GraficoPizza dados={rel.despesasGrupo} /> : <Vazio>Sem despesas no demonstrativo.</Vazio>}
            </>
          )}
        </Secao>
      )}

      {rel.secoes.inadimplencia && (
        <Secao n={numero("inadimplencia")} titulo="Inadimplência — contas a receber">
          {rel.inadimplencia.linhas.length === 0 ? (
            <Vazio>Nenhum relatório mensal no período.</Vazio>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 text-left font-semibold">Mês</th>
                    <th className="py-1 text-right font-semibold">Unidades</th>
                    <th className="py-1 text-right font-semibold">Valor a receber</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.inadimplencia.linhas.map((l, i) => (
                    <tr key={i} className="border-b border-dashed last:border-0">
                      <td className="num py-1">{l.mes}</td>
                      <td className="num py-1 text-right">{l.unidades ?? "—"}</td>
                      <td className="num py-1 text-right">{formatBRL(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rel.inadimplencia.final && (
                <p className="mt-3 rounded-sm bg-muted/50 px-3 py-2">
                  Posição em <span className="num">{rel.inadimplencia.final.mes}</span>:{" "}
                  <strong className="num">{formatBRL(rel.inadimplencia.final.valor)}</strong>
                  {rel.inadimplencia.final.unidades !== null && ` (${rel.inadimplencia.final.unidades} unidades)`}.
                </p>
              )}
            </>
          )}
        </Secao>
      )}

      {rel.secoes.notas && (
        <Secao n={numero("notas")} titulo="Notas explicativas">
          {rel.notas.length === 0 ? (
            <Vazio>Nenhuma nota explicativa nos relatórios mensais do período.</Vazio>
          ) : (
            <ol className="space-y-3">
              {rel.notas.map((n, i) => (
                <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
                  <span className="num text-muted-foreground">{n.mes}</span>
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{n.rubrica || "Nota"}</span>
                      {n.valor !== null && <span className="num whitespace-nowrap">{formatBRL(n.valor)}</span>}
                    </div>
                    {n.texto && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{n.texto}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Secao>
      )}

      {rel.secoes.assinatura && (
        <section className="mt-12 text-center">
          <p>{[e.cidade, e.dataEmissao].filter(Boolean).join(", ")}</p>
          <div className="mx-auto mt-12 w-72 max-w-full border-t pt-2">
            {escritorio?.assinatura ? (
              <p className="whitespace-pre-line">{escritorio.assinatura}</p>
            ) : (
              <p className="text-muted-foreground">Assinatura não cadastrada no Escritório</p>
            )}
            {escritorio?.nome && <p className="mt-1 text-xs text-muted-foreground">{escritorio.nome}</p>}
          </div>
          {escritorio?.rodape && <p className="mt-10 whitespace-pre-line text-xs text-muted-foreground">{escritorio.rodape}</p>}
        </section>
      )}
    </article>
  );
}

function Secao({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="border-b py-8 last:border-0">
      <h2 className="text-base font-semibold text-primary">
        {n}. {titulo}
      </h2>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Vazio = ({ children }: { children: ReactNode }) => <p className="text-muted-foreground">{children}</p>;

function Linha({ nome, valor, forte, sutil, recuo }: { nome: string; valor: number | null; forte?: boolean; sutil?: boolean; recuo?: boolean }) {
  return (
    <tr className={cn(forte && "font-semibold", sutil && "text-xs text-muted-foreground")}>
      <td className={cn("px-3 py-1", recuo && "pl-6")}>{nome}</td>
      <td className="num whitespace-nowrap px-3 py-1 text-right">{formatBRL(valor)}</td>
    </tr>
  );
}

function Bloco({ titulo, linhas, total }: { titulo: string; linhas: LinhaValor[]; total: number }) {
  return (
    <div>
      <h4 className="mb-1 font-semibold">{titulo}</h4>
      <table className="w-full">
        <tbody>
          {linhas.map((l, i) => (
            <Linha key={i} nome={l.nome} valor={l.valor} recuo />
          ))}
          <Linha nome={`Total ${titulo.toLowerCase()}`} valor={total} forte />
        </tbody>
      </table>
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    // minmax(min-content,…) no valor: em 320 px o rótulo (até 14rem) é que quebra, e o valor
    // (R$ 8.500.000,00, datas) fica inteiro sem passar da página.
    <div className="grid grid-cols-[minmax(0,14rem)_minmax(min-content,1fr)] gap-3 py-0.5">
      <dt className="break-words text-muted-foreground">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Consideracoes({ e, rel }: { e: Exercicio; rel: RelatorioFinal }) {
  const c = e.consid;
  const proximaVistoria = dataVistoria(c);
  const receber = typeof c.contasReceber === "number" ? c.contasReceber : null;
  const pagar = typeof c.contasPagar === "number" ? c.contasPagar : null;
  const extras = c.extras.filter((x) => String(x.rotulo).trim() || String(x.valor).trim());
  return (
    <div className="space-y-5">
      {c.administracao.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Administração</h4>
          <dl>
            {c.administracao.map((m, i) => (
              <Item key={i} rotulo={m.cargo || "—"}>
                {m.nome}
                {m.mandatoFim && <span className="text-muted-foreground"> · mandato até {m.mandatoFim}</span>}
              </Item>
            ))}
          </dl>
        </div>
      )}
      {(c.seguradora || c.vigenciaSeguro || c.seguro.coberturas.length > 0) && (
        <div>
          <h4 className="mb-1 font-semibold">Seguro</h4>
          <dl>
            {c.seguradora && <Item rotulo="Seguradora">{c.seguradora}</Item>}
            {c.vigenciaSeguro && <Item rotulo="Vigência até"><span className="num">{formatData(c.vigenciaSeguro)}</span></Item>}
            {c.seguro.riscoAbsoluto !== null && <Item rotulo="Risco absoluto"><span className="num">{formatBRL(c.seguro.riscoAbsoluto)}</span></Item>}
            {c.seguro.coberturas.map((cb, i) => (
              <Item key={i} rotulo={cb.desc || "Cobertura"}>
                <span className="num">{formatBRL(cb.valor)}</span>
              </Item>
            ))}
          </dl>
        </div>
      )}
      {(c.vigenciaExtintores || c.ultGordura || c.ultDedetizacao || c.ultCaixaDagua || c.vistoriaAno) && (
        <div>
          <h4 className="mb-1 font-semibold">Manutenções e vistorias</h4>
          <dl>
            {c.vigenciaExtintores && <Item rotulo="Recarga dos extintores até"><span className="num">{formatData(c.vigenciaExtintores)}</span></Item>}
            {c.ultGordura && <Item rotulo="Última limpeza da caixa de gordura"><span className="num">{formatData(c.ultGordura)}</span></Item>}
            {c.ultDedetizacao && <Item rotulo="Última dedetização"><span className="num">{formatData(c.ultDedetizacao)}</span></Item>}
            {c.ultCaixaDagua && <Item rotulo="Última limpeza da caixa d'água"><span className="num">{formatData(c.ultCaixaDagua)}</span></Item>}
            {c.vistoriaAno && (
              <Item rotulo="Vistoria técnica">
                <span className="num">{c.vistoriaAno}</span>
                {proximaVistoria && <span className="text-muted-foreground"> · próxima em {dataParaBR(proximaVistoria)}</span>}
                {c.vistoriaLei && <span className="text-muted-foreground"> · {c.vistoriaLei}</span>}
              </Item>
            )}
          </dl>
        </div>
      )}
      {(receber !== null || pagar !== null || rel.agua.valor > 0) && (
        <div>
          <h4 className="mb-1 font-semibold">Valores</h4>
          <dl>
            {receber !== null && <Item rotulo="Contas a receber"><span className="num">{formatBRL(receber)}</span></Item>}
            {pagar !== null && <Item rotulo="Contas a pagar"><span className="num">{formatBRL(pagar)}</span></Item>}
            {rel.agua.valor > 0 && <Item rotulo="Consumo de água no exercício"><span className="num">{formatBRL(rel.agua.valor)}</span></Item>}
          </dl>
        </div>
      )}
      {c.indices.some((i) => i.pct !== null) && (
        <div>
          <h4 className="mb-1 font-semibold">Índices de correção aplicados</h4>
          <dl>
            {c.indices
              .filter((i) => i.pct !== null)
              .map((i, k) => (
                <Item key={k} rotulo={String(i.ano ?? "—")}>
                  <span className="num">{formatNumeroBR(i.pct)}%</span>
                </Item>
              ))}
          </dl>
        </div>
      )}
      {extras.length > 0 && (
        <div className="space-y-2">
          {extras.map((x, i) => (
            <p key={i} className="whitespace-pre-line">
              {String(x.rotulo).trim() && <strong>{x.rotulo}: </strong>}
              {typeof x.valor === "number" ? formatBRL(x.valor) : x.valor}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Previsão orçamentária sugerida pelo Systemar (com as edições do usuário) e o quadro por unidade. */
function PrevisaoSugeridaPrevia({
  e,
  previsao: p,
  r,
  u,
}: {
  e: Exercicio;
  previsao: PrevisaoSugeridaExercicio;
  r: ResultadoPrevisaoSugerida;
  u: ResultadoPrevisaoSugeridaPorUnidade;
}) {
  const fundo = e.prev?.fundoReservaPct ?? 0;
  const sinal = (s: "+" | "-") => (s === "-" ? "(−)" : "(+)");
  return (
    <>
      <table className="w-full">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-1 text-left font-semibold">Categoria de despesa</th>
            <th className="py-1 text-right font-semibold">Anual</th>
            <th className="py-1 text-right font-semibold">Média mês</th>
          </tr>
        </thead>
        <tbody>
          {p.categorias.map((c, i) => (
            <tr key={i} className="border-b border-dashed last:border-0">
              <td className="py-1">{c.nome}</td>
              <td className="num py-1 text-right">{formatBRL(c.anual)}</td>
              <td className="num py-1 text-right text-muted-foreground">{formatBRL(c.media)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-1">Total das despesas</td>
            <td className="num py-1 text-right">{formatBRL(r.totalDespesasAno)}</td>
            <td className="num py-1 text-right">{formatBRL(r.totalDespesasMedia)}</td>
          </tr>
        </tbody>
      </table>
      <table className="mt-4 w-full rounded-sm bg-muted/50">
        <tbody>
          <Linha nome="Total das despesas do ano" valor={r.totalDespesasAno} />
          {p.deducoes.map((x) => (
            <Linha key={x.id} nome={`${sinal(x.sinal)} ${x.descricao || "Dedução"}`} valor={Math.abs(x.valor)} />
          ))}
          <Linha nome="Total ordinário" valor={r.totalOrdinario} forte />
          <Linha nome={`${sinal(p.variacao.sinal)} Variação de despesas sugeridas`} valor={Math.abs(p.variacao.valor)} />
          <Linha nome="Total final (anual)" valor={r.totalFinal} forte />
          <Linha nome="Rateio mensal sugerido (÷ 12)" valor={r.rateioMensalSugerido} forte />
          <Linha nome="Rateio mensal atual" valor={r.rateioMensalAtual} />
          <tr>
            <td className="px-3 py-1">Índice sugerido para correção</td>
            <td className="num px-3 py-1 text-right">{pctTexto(r.indiceSugerido)}</td>
          </tr>
          {e.rateioAprovado != null && <Linha nome="Rateio aprovado" valor={e.rateioAprovado} forte />}
        </tbody>
      </table>
      <h4 className="mb-1 mt-5 font-semibold">Previsão orçamentária por unidade</h4>
      <table className="w-full rounded-sm bg-muted/50">
        <tbody>
          <tr>
            <td className="px-3 py-1">Unidades</td>
            <td className="num px-3 py-1 text-right">{u.unidades ?? "—"}</td>
          </tr>
          <Linha nome="Cota por unidade" valor={u.cotaUnidade} />
          <Linha nome={`(+) Reserva por unidade ${formatNumeroBR(fundo)}%`} valor={u.reservaUnidade} />
          <Linha nome="Valor por unidade" valor={u.valorUnidade} forte />
        </tbody>
      </table>
    </>
  );
}
