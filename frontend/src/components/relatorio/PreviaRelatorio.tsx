import { Fragment, type ReactNode } from "react";
import { GraficoComparativo } from "@/components/previsto-realizado/GraficoComparativo";
import { TabelaComparativo, pctTexto } from "@/components/previsto-realizado/TabelaComparativo";
import { AvisoSemRealizado } from "@/components/previsto-realizado/AvisoSemRealizado";
import { semRealizado } from "@/components/previsto-realizado/semRealizado";
import { GraficoPizza } from "@/components/relatorio/GraficoPizza";
import { GraficoEvolucaoMensal } from "@/components/relatorio/GraficoEvolucaoMensal";
import { GraficoReceitasCategoria } from "@/components/relatorio/GraficoReceitasCategoria";
import { dataParaBR, formatBRL, formatData, formatNumeroBR } from "@/lib/format";
import { dataVistoria } from "@/domain/painel";
import { cn } from "@/lib/utils";
import { RolagemTabela } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { nomeParaRelatorio } from "@/domain/condominio";
import { SECOES, type RelatorioFinal, type SecaoId } from "@/domain/relatorioFinal";
import type {
  ResultadoPrevisaoSugerida,
  ResultadoPrevisaoSugeridaPorUnidade,
} from "@/domain/previsaoSugerida";
import { exercicioPorExtenso, montarFolhaPrevisao } from "@/domain/previsaoFolha";
import type {
  Condominio,
  ConfigEscritorio,
  Exercicio,
  LinhaValor,
  PrevisaoSugeridaExercicio,
} from "@/domain/types";
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
  const numero = (id: SecaoId) =>
    incluidas
      .filter((s) => s.id !== "capa" && s.id !== "assinatura")
      .findIndex((s) => s.id === id) + 1;
  const nomeCondo = condominio ? nomeParaRelatorio(condominio) : e.condoNome;
  const d = rel.demonstrativo;

  if (incluidas.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        Nenhuma seção incluída.
      </p>
    );
  }

  return (
    <article
      className="@container mx-auto max-w-[52rem] break-words rounded-sm border bg-card px-6 py-8 text-sm shadow-sm sm:px-12 sm:py-12"
      aria-label="Prévia do relatório final"
    >
      {rel.secoes.capa && (
        <section className="flex min-h-[28rem] flex-col items-center justify-center border-b pb-12 text-center [&>*]:max-w-full">
          {escritorio?.logo && (
            <img
              src={escritorio.logo}
              alt={escritorio.nome || "Logo do escritório"}
              className="mb-10 max-h-20 w-auto"
            />
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Prestação de contas
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-primary">{nomeCondo}</h1>
          {condominio?.cnpj && (
            <p className="num mt-1 text-muted-foreground">CNPJ {condominio.cnpj}</p>
          )}
          <p className="mt-6 text-lg">Exercício {e.ano}</p>
          {d?.periodo.ini && d.periodo.fim && (
            <p className="num text-muted-foreground">
              {d.periodo.ini} a {d.periodo.fim}
            </p>
          )}
          <p className="mt-10 text-muted-foreground">
            {[e.cidade, e.dataEmissao].filter(Boolean).join(", ") ||
              "Cidade e data de emissão não informadas"}
          </p>
          {escritorio?.nome && (
            <p className="mt-1 text-xs text-muted-foreground">{escritorio.nome}</p>
          )}
        </section>
      )}

      {rel.secoes.demonstrativo && (
        <Secao n={numero("demonstrativo")} titulo="Demonstrativo de receitas e despesas">
          {!d ? (
            <Vazio>Sem demonstrativo.</Vazio>
          ) : (
            <div className="space-y-5">
              <Bloco
                titulo="Saldo anterior"
                linhas={d.saldoAnterior.contas}
                total={d.totais.saldoAnterior}
              />
              <Bloco titulo="Receitas" linhas={d.receitas.itens} total={d.totais.receitas} />
              <div>
                <h4 className="mb-1 font-semibold">Despesas</h4>
                <RolagemTabela className="">
                  <table className="w-full">
                    <tbody>
                      {d.despesas.grupos.map((g) => {
                        const sub = g.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
                        return (
                          <Fragment key={g.nome}>
                            {e.mostrarContasAnaliticasDemonstrativo === false ? (
                              <Linha nome={g.nome || "Sem grupo"} valor={sub} forte />
                            ) : (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="pt-2 text-xs font-semibold uppercase tracking-wide text-primary"
                                >
                                  {g.nome || "Sem grupo"}
                                </td>
                              </tr>
                            )}
                            {e.mostrarContasAnaliticasDemonstrativo !== false &&
                              g.itens.map((i, k) => (
                                <Linha key={k} nome={i.nome} valor={i.valor} recuo />
                              ))}
                            {e.mostrarContasAnaliticasDemonstrativo !== false && (
                              <Linha nome={`Subtotal ${g.nome}`} valor={sub} sutil />
                            )}
                          </Fragment>
                        );
                      })}
                      <Linha nome="Total das despesas" valor={d.totais.despesas} forte />
                    </tbody>
                  </table>
                </RolagemTabela>
              </div>
              <Bloco
                titulo="Saldo atual"
                linhas={d.saldoAtual.contas}
                total={d.totais.saldoAtual}
              />
              <RolagemTabela className="">
                <table className="w-full rounded-sm bg-muted/50">
                  <tbody>
                    <Linha nome="Saldo anterior" valor={d.totais.saldoAnterior} />
                    <Linha nome="(+) Receitas" valor={d.totais.receitas} />
                    <Linha nome="(−) Despesas" valor={d.totais.despesas} />
                    <Linha nome="(=) Saldo atual" valor={d.totais.saldoAtual} forte />
                  </tbody>
                </table>
              </RolagemTabela>
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
          titulo={`Previsão orçamentária — Exercício ${exercicioPorExtenso(e)}`}
        >
          {/* Mesma folha que sai no PDF/Word (decisão de 13/11/2026): rateio atual → histórico →
              dedução → total ordinário → variação → rateio anual e mensal → índice. O cálculo do
              Krieger não é repetido aqui, para não haver dois demonstrativos concorrentes. */}
          {rel.avisoRateioAprovado && (
            <Alert variant="warning" className="mb-3">
              <AlertDescription>{rel.avisoRateioAprovado}</AlertDescription>
            </Alert>
          )}
          {e.previsaoSugerida && rel.previsaoSugerida ? (
            <FolhaPrevisaoPrevia e={e} previsao={e.previsaoSugerida} r={rel.previsaoSugerida} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este exercício não tem a previsão orçamentária sugerida importada do Systemar. Importe
              o PDF do balanço na prestação de contas para que a folha da previsão apareça aqui.
            </p>
          )}
        </Secao>
      )}

      {rel.secoes.previstoRealizado && (
        <Secao
          n={numero("previstoRealizado")}
          titulo="Previsto × Realizado"
          sub={`Previsão ${e.ano} × realizado de ${rel.comparativo.meses[0]?.rotulo} a ${rel.comparativo.mesAte.rotulo} (${contagem(rel.comparativo.relatoriosUsados, "relatório mensal", "relatórios mensais")}).`}
        >
          <RolagemTabela className="mb-4">
            <table className="w-full rounded-sm bg-muted/50">
              <tbody>
                <Linha nome="Previsto anual" valor={rel.comparativo.total.previstoAnual} />
                <Linha
                  nome={`Previsto até ${rel.comparativo.mesAte.rotulo}`}
                  valor={rel.comparativo.total.previsto}
                />
                {!semRealizado(rel.comparativo) && (
                  <>
                    <Linha
                      nome={`Realizado até ${rel.comparativo.mesAte.rotulo}`}
                      valor={rel.comparativo.total.realizado}
                    />
                    <tr className="font-semibold">
                      <td className="px-3 py-1">Diferença</td>
                      <td className="num px-3 py-1 text-right">
                        {formatBRL(rel.comparativo.total.diferenca)} (
                        {pctTexto(rel.comparativo.total.pct)})
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </RolagemTabela>
          {rel.comparativo.grupos.length > 0 && semRealizado(rel.comparativo) ? (
            <AvisoSemRealizado r={rel.comparativo} />
          ) : (
            <TabelaComparativo
              r={rel.comparativo}
              compacta
              mostrarAnaliticas={e.mostrarContasAnaliticas !== false}
            />
          )}
        </Secao>
      )}

      {rel.secoes.analise && (
        <Secao n={numero("analise")} titulo="Análise gráfica">
          <h4 className="mb-2 font-semibold">Previsto × realizado por grupo</h4>
          {!rel.comparativo.grupos.length ? (
            <Vazio>Sem dados para o gráfico.</Vazio>
          ) : semRealizado(rel.comparativo) ? (
            <AvisoSemRealizado r={rel.comparativo} />
          ) : (
            <GraficoComparativo r={rel.comparativo} />
          )}
          {e.mostrarPizza !== false && (
            <>
              <h4 className="mb-2 mt-6 font-semibold">Despesas do exercício {e.ano} por grupo</h4>
              {rel.despesasGrupo.length ? (
                <GraficoPizza dados={rel.despesasGrupo} />
              ) : (
                <Vazio>Sem despesas no demonstrativo.</Vazio>
              )}
            </>
          )}
          {e.mostrarReceitasPorCategoria !== false && rel.receitasPorCategoria.length > 0 && (
            <>
              <h4 className="mb-2 mt-6 font-semibold">Receitas por categoria</h4>
              <GraficoReceitasCategoria series={rel.receitasPorCategoria} />
            </>
          )}
          {e.mostrarEvolucaoMensal !== false && (
            <>
              <h4 className="mb-2 mt-6 font-semibold">Evolução mensal</h4>
              {rel.evolucaoMensal.length ? (
                <GraficoEvolucaoMensal pontos={rel.evolucaoMensal} />
              ) : (
                <Vazio>Sem relatórios mensais no período.</Vazio>
              )}
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
              <RolagemTabela className="">
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
              </RolagemTabela>
              {rel.inadimplencia.final && (
                <p className="mt-3 rounded-sm bg-muted/50 px-3 py-2">
                  Posição em <span className="num">{rel.inadimplencia.final.mes}</span>:{" "}
                  <strong className="num">{formatBRL(rel.inadimplencia.final.valor)}</strong>
                  {rel.inadimplencia.final.unidades !== null &&
                    ` (${rel.inadimplencia.final.unidades} unidades)`}
                  .
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
            <ol className="@container space-y-3">
              {rel.notas.map((n, i) => (
                <li
                  key={i}
                  className="grid grid-cols-1 gap-x-2 gap-y-0.5 @min-[16rem]:grid-cols-[3.5rem_minmax(0,1fr)]"
                >
                  <span className="num text-muted-foreground">{n.mes}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="min-w-0 break-words font-medium">{n.rubrica || "Nota"}</span>
                      {n.valor !== null && <span className="num">{formatBRL(n.valor)}</span>}
                    </div>
                    {n.texto && (
                      <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{n.texto}</p>
                    )}
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
            {escritorio?.nome && (
              <p className="mt-1 text-xs text-muted-foreground">{escritorio.nome}</p>
            )}
          </div>
          {escritorio?.rodape && (
            <p className="mt-10 whitespace-pre-line text-xs text-muted-foreground">
              {escritorio.rodape}
            </p>
          )}
        </section>
      )}
    </article>
  );
}

function Secao({
  n,
  titulo,
  sub,
  children,
}: {
  n: number;
  titulo: string;
  sub?: string;
  children: ReactNode;
}) {
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

const Vazio = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground">{children}</p>
);

function Linha({
  nome,
  valor,
  forte,
  sutil,
  recuo,
}: {
  nome: string;
  valor: number | null;
  forte?: boolean;
  sutil?: boolean;
  recuo?: boolean;
}) {
  return (
    <tr className={cn(forte && "font-semibold", sutil && "text-xs text-muted-foreground")}>
      <td className={cn("px-3 py-1", recuo && "pl-6")}>{nome}</td>
      <td className="num whitespace-nowrap px-3 py-1 text-right">{formatBRL(valor)}</td>
    </tr>
  );
}

function Bloco({
  titulo,
  linhas,
  total,
  mostrarAnaliticas = true,
}: {
  titulo: string;
  linhas: LinhaValor[];
  total: number;
  mostrarAnaliticas?: boolean;
}) {
  return (
    <div>
      <h4 className="mb-1 font-semibold">{titulo}</h4>
      <RolagemTabela className="">
        <table className="w-full">
          <tbody>
            {mostrarAnaliticas &&
              linhas.map((l, i) => <Linha key={i} nome={l.nome} valor={l.valor} recuo />)}
            <Linha nome={`Total ${titulo.toLowerCase()}`} valor={total} forte />
          </tbody>
        </table>
      </RolagemTabela>
    </div>
  );
}

function Item({
  rotulo,
  children,
  alinhar,
}: {
  rotulo: string;
  children: ReactNode;
  alinhar?: "esquerda" | "direita";
}) {
  return (
    // minmax(min-content,…) no valor: em 320 px o rótulo (até 14rem) é que quebra, e o valor
    // (R$ 8.500.000,00, datas) fica inteiro sem passar da página. Com texto ampliado (prévia
    // estreita), rótulo e valor ficam um embaixo do outro.
    <div className="grid grid-cols-1 gap-x-3 py-0.5 @min-[12rem]:grid-cols-[minmax(0,14rem)_minmax(min-content,1fr)]">
      <dt className="break-words text-muted-foreground">{rotulo}</dt>
      <dd className={cn(alinhar === "direita" && "text-right")}>{children}</dd>
    </div>
  );
}

function Consideracoes({ e, rel }: { e: Exercicio; rel: RelatorioFinal }) {
  const c = e.consid;
  const proximaVistoria = dataVistoria(c);
  const receber = typeof c.contasReceber === "number" ? c.contasReceber : null;
  const pagar = typeof c.contasPagar === "number" ? c.contasPagar : null;
  const extras = c.extras.filter((x) => String(x.rotulo).trim() || String(x.valor).trim());
  const administracao = c.administracao.filter((m) => m.noRelatorio !== false);
  const coberturas = c.seguro.coberturas.filter((cb) => cb.noRelatorio !== false);
  const indices = c.indices.filter((i) => i.pct !== null && i.noRelatorio !== false);
  const documentos = c.documentosObrigatorios.filter((d) => d.noRelatorio && d.nome.trim());
  const servicos = [
    { nome: "Água", consumo: rel.agua },
    { nome: "Energia elétrica", consumo: rel.energia },
    { nome: "Elevadores", consumo: rel.elevador, fornecedor: c.elevadorFornecedor },
  ].filter((s) => s.consumo.valor > 0);
  return (
    <div className="space-y-5">
      {administracao.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Administração</h4>
          <dl>
            {administracao.map((m, i) => (
              <Item key={i} rotulo={m.cargo || "—"}>
                {m.nome}
                {m.mandatoFim && (
                  <span className="text-muted-foreground"> · mandato até {m.mandatoFim}</span>
                )}
              </Item>
            ))}
          </dl>
        </div>
      )}
      {(c.seguradora || c.vigenciaSeguro || coberturas.length > 0) && (
        <div>
          <h4 className="mb-1 font-semibold">Seguro</h4>
          <dl>
            {c.seguradora && (
              <Item rotulo="Seguradora" alinhar="direita">
                {c.seguradora}
              </Item>
            )}
            {c.vigenciaSeguro && (
              <Item rotulo="Vigência até" alinhar="direita">
                <span className="num">{formatData(c.vigenciaSeguro)}</span>
              </Item>
            )}
            {c.seguro.riscoAbsoluto !== null && (
              <Item rotulo="Risco absoluto" alinhar="direita">
                <span className="num">{formatBRL(c.seguro.riscoAbsoluto)}</span>
              </Item>
            )}
            {coberturas.map((cb, i) => (
              <Item key={i} rotulo={cb.desc || "Cobertura"} alinhar="direita">
                <span className="num">{formatBRL(cb.valor)}</span>
              </Item>
            ))}
          </dl>
        </div>
      )}
      {(c.vigenciaExtintores ||
        c.ultGordura ||
        c.ultDedetizacao ||
        c.ultCaixaDagua ||
        c.vistoriaAno) && (
        <div>
          <h4 className="mb-1 font-semibold">Manutenções e vistorias</h4>
          <dl>
            {c.vigenciaExtintores && (
              <Item rotulo="Recarga dos extintores até">
                <span className="num">{formatData(c.vigenciaExtintores)}</span>
              </Item>
            )}
            {c.ultGordura && (
              <Item rotulo="Última limpeza da caixa de gordura">
                <span className="num">{formatData(c.ultGordura)}</span>
              </Item>
            )}
            {c.ultDedetizacao && (
              <Item rotulo="Última dedetização">
                <span className="num">{formatData(c.ultDedetizacao)}</span>
              </Item>
            )}
            {c.ultCaixaDagua && (
              <Item rotulo="Última limpeza da caixa d'água">
                <span className="num">{formatData(c.ultCaixaDagua)}</span>
              </Item>
            )}
            {c.vistoriaAno && (
              <Item rotulo="Vistoria técnica">
                <span className="num">{c.vistoriaAno}</span>
                {proximaVistoria && (
                  <span className="text-muted-foreground">
                    {" "}
                    · próxima em {dataParaBR(proximaVistoria)}
                  </span>
                )}
                {c.vistoriaLei && <span className="text-muted-foreground"> · {c.vistoriaLei}</span>}
              </Item>
            )}
          </dl>
        </div>
      )}
      {documentos.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Documentos obrigatórios</h4>
          <dl>
            {documentos.map((d, i) => (
              <Item key={i} rotulo={d.nome}>
                {d.status === "ok" ? "Em dia" : "Pendente"}
                {d.informacao && <span className="text-muted-foreground"> · {d.informacao}</span>}
                {d.observacao && <span className="text-muted-foreground"> · {d.observacao}</span>}
              </Item>
            ))}
          </dl>
        </div>
      )}
      {servicos.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Consumo de serviços</h4>
          <RolagemTabela className="">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 text-left font-semibold">Serviço</th>
                  <th className="py-1 text-right font-semibold">Consumido no período</th>
                  <th className="py-1 text-right font-semibold">Valor médio (÷ 12)</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s, i) => (
                  <tr key={i} className="border-b border-dashed last:border-0">
                    <td className="py-1">
                      {s.nome}
                      {s.consumo.rubricas.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {s.consumo.rubricas.join(", ")}
                        </span>
                      )}
                      {s.fornecedor && (
                        <span className="block text-xs text-muted-foreground">{s.fornecedor}</span>
                      )}
                    </td>
                    <td className="num py-1 text-right">{formatBRL(s.consumo.valor)}</td>
                    <td className="num py-1 text-right text-muted-foreground">
                      {formatBRL(s.consumo.valor / 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RolagemTabela>
        </div>
      )}
      {(receber !== null || pagar !== null) && (
        <div>
          <h4 className="mb-1 font-semibold">Valores</h4>
          <dl>
            {receber !== null && (
              <Item rotulo="Contas a receber">
                <span className="num">{formatBRL(receber)}</span>
              </Item>
            )}
            {pagar !== null && (
              <Item rotulo="Contas a pagar">
                <span className="num">{formatBRL(pagar)}</span>
              </Item>
            )}
          </dl>
        </div>
      )}
      {indices.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Índices de correção aplicados</h4>
          <dl>
            {indices.map((i, k) => (
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

/**
 * A folha da previsão no padrão do Systemar, espelhando o PDF/Word: título em duas linhas, rateio
 * atual, histórico por categoria, dedução, total ordinário, variação e rateios sugeridos, com o
 * pontilhado condutor entre rótulo e valor.
 */
function FolhaPrevisaoPrevia({
  e,
  previsao: p,
  r,
}: {
  e: Exercicio;
  previsao: PrevisaoSugeridaExercicio;
  r: ResultadoPrevisaoSugerida;
}) {
  const f = montarFolhaPrevisao(e, p, r);
  return (
    <div className="text-sm">
      <div className="mb-4 text-center font-semibold uppercase tracking-wide">
        {f.titulo.map((linha, i) => (
          <p key={i}>{linha}</p>
        ))}
      </div>
      {f.rateioAtual && (
        <p className="mb-4 flex items-baseline gap-2">
          <span>{f.rateioAtual.rotulo}</span>
          <span className="min-w-8 flex-1 border-b border-dotted border-muted-foreground/60" />
          <span className="num font-semibold">{f.rateioAtual.valor}</span>
        </p>
      )}
      <p className="mb-2 whitespace-pre-line">{f.aberturaHistorico.join("\n")}</p>
      <RolagemTabela className="">
        <table className="w-full">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1 text-left font-semibold">{f.colunas[0]}</th>
              <th className="py-1 text-right font-semibold">{f.colunas[1]}</th>
              <th className="py-1 text-right font-semibold">{f.colunas[2]}</th>
            </tr>
          </thead>
          <tbody>
            {f.categorias.map((c, i) => (
              <tr key={i} className="border-b border-dashed last:border-0">
                <td className="py-1">{c.nome}</td>
                <td className="num py-1 text-right">{c.anual}</td>
                <td className="num py-1 text-right text-muted-foreground">{c.media}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1">{f.totalCategorias.nome}</td>
              <td className="num py-1 text-right">{f.totalCategorias.anual}</td>
              <td className="num py-1 text-right">{f.totalCategorias.media}</td>
            </tr>
          </tbody>
        </table>
      </RolagemTabela>
      <dl className="mt-4 space-y-1">
        {f.fechamento.map((linha, i) => (
          <div key={i} className={`flex items-baseline gap-2 ${linha.espacoAntes ? "pt-2" : ""}`}>
            <dt className={linha.forte ? "font-semibold" : undefined}>{linha.rotulo}</dt>
            <span className="min-w-8 flex-1 border-b border-dotted border-muted-foreground/60" />
            <dd className={`num ${linha.forte ? "font-semibold" : ""}`}>{linha.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
