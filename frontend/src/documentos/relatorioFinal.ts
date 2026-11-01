import { dataParaBR, formatBRL, formatData, formatNumeroBR } from "@/lib/format";
import { dataVistoria } from "@/domain/painel";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import { barrasSvg, blocoGrafico, linhaSvg, pizzaSvg } from "@/lib/documento/graficos";
import type { Bloco, Coluna, Documento, LinhaTabela, Texto } from "@/lib/documento/tipos";
import { legendaSituacao, marcaSituacao, pctTexto } from "@/components/previsto-realizado/TabelaComparativo";
import { semRealizado, textoSemRealizado } from "@/components/previsto-realizado/semRealizado";
import { nomeParaRelatorio } from "@/domain/condominio";
import { SECOES, type ConsumoServico, type RelatorioFinal, type SecaoId } from "@/domain/relatorioFinal";
import type { ResultadoComparativo, Totais } from "@/domain/previstoRealizado";
import type { ResultadoPrevisaoSugerida, ResultadoPrevisaoSugeridaPorUnidade } from "@/domain/previsaoSugerida";
import type { Condominio, ConfigEscritorio, Exercicio, PrevisaoSugeridaExercicio } from "@/domain/types";
import { blocosDemonstrativo, localEData, timbreDoEscritorio } from "./comum";
import { contagem } from "@/components/app/textos";

/**
 * Relatório final da prestação de contas: desenha o que `montarRelatorioFinal` já montou,
 * na mesma ordem e com o mesmo conteúdo da prévia na tela (PreviaRelatorio).
 */

const VALOR = { titulo: "Valor", largura: 110, alinhamento: "direita" } as const;
const l = (nome: string, valor: number | null, o: Partial<LinhaTabela> = {}): LinhaTabela => ({ celulas: [nome, formatBRL(valor)], ...o });
const resumo = (linhas: LinhaTabela[]): Bloco => ({
  tipo: "tabela",
  semCabecalho: true,
  fundo: true,
  colunas: [{ titulo: "", largura: "*" }, { ...VALOR, largura: 150 }],
  linhas,
});
const vazio = (texto: string): Bloco => ({ tipo: "paragrafo", texto, suave: true });
const avisoSemRealizado = (c: ResultadoComparativo): Bloco => ({ tipo: "paragrafo", texto: textoSemRealizado(c), negrito: true });

export async function documentoRelatorioFinal(o: {
  rel: RelatorioFinal;
  exercicio: Exercicio;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
}): Promise<Documento> {
  const { rel, exercicio: e, condominio, escritorio } = o;
  const incluidas = SECOES.filter((s) => rel.secoes[s.id]);
  const numeradas = incluidas.filter((s) => s.id !== "capa" && s.id !== "assinatura");
  const titulo = (id: SecaoId, texto: string): Bloco => ({ tipo: "titulo", nivel: 2, texto: `${numeradas.findIndex((s) => s.id === id) + 1}. ${texto}` });
  const nome = condominio ? nomeParaRelatorio(condominio) : e.condoNome;
  const d = rel.demonstrativo;
  const b: Bloco[] = [];

  if (rel.secoes.capa) {
    b.push({ tipo: "espaco", altura: 110 });
    if (escritorio?.logo) {
      const ratio = escritorio.logoRatio || 3;
      b.push({ tipo: "imagem", dataUrl: escritorio.logo, largura: Math.min(220, 64 * ratio), altura: 64 });
      b.push({ tipo: "espaco", altura: 30 });
    }
    b.push(
      { tipo: "paragrafo", texto: "PRESTAÇÃO DE CONTAS", alinhamento: "centro", suave: true, negrito: true, tamanho: "pequeno" },
      { tipo: "titulo", nivel: 1, texto: nome, alinhamento: "centro" },
    );
    if (condominio?.cnpj) b.push({ tipo: "paragrafo", texto: `CNPJ ${condominio.cnpj}`, alinhamento: "centro", suave: true });
    b.push({ tipo: "espaco", altura: 14 }, { tipo: "paragrafo", texto: `Exercício ${e.ano}`, alinhamento: "centro", tamanho: "grande" });
    if (d?.periodo.ini && d.periodo.fim) b.push({ tipo: "paragrafo", texto: `${d.periodo.ini} a ${d.periodo.fim}`, alinhamento: "centro", suave: true });
    b.push({ tipo: "espaco", altura: 140 });
    const ld = [e.cidade, e.dataEmissao].filter((x) => x.trim()).join(", ");
    if (ld) b.push({ tipo: "paragrafo", texto: ld, alinhamento: "centro", suave: true });
    if (escritorio?.nome) b.push({ tipo: "paragrafo", texto: escritorio.nome, alinhamento: "centro", suave: true, tamanho: "pequeno" });
    if (incluidas.length > 1) b.push({ tipo: "quebraPagina" });
  }

  if (rel.secoes.demonstrativo) {
    b.push(titulo("demonstrativo", "Demonstrativo de receitas e despesas"));
    b.push(...(d ? blocosDemonstrativo(d) : [vazio("Sem demonstrativo.")]));
  }

  if (rel.secoes.consideracoes) {
    b.push(titulo("consideracoes", "Considerações finais"), ...consideracoes(e, rel));
  }

  if (rel.secoes.previsao && e.previsaoSugerida && rel.previsaoSugerida && rel.previsaoSugeridaPorUnidade) {
    b.push(titulo("previsao", `Previsão orçamentária — Exercício ${e.ano}`));
    if (d?.periodo.ini && d.periodo.fim) b.push({ tipo: "paragrafo", texto: `Período do exercício: ${d.periodo.ini} a ${d.periodo.fim}.`, suave: true, tamanho: "pequeno" });
    b.push(...blocosPrevisaoSugerida(e, e.previsaoSugerida, rel.previsaoSugerida, rel.previsaoSugeridaPorUnidade));
  } else if (rel.secoes.previsao) {
    const p = rel.previsao;
    b.push(titulo("previsao", `Previsão orçamentária — Exercício ${e.ano}`));
    if (d?.periodo.ini && d.periodo.fim) b.push({ tipo: "paragrafo", texto: `Período do exercício: ${d.periodo.ini} a ${d.periodo.fim}.`, suave: true, tamanho: "pequeno" });
    b.push({
      tipo: "tabela",
      colunas: [
        { titulo: p.modo === "detalhado" ? "Rubrica" : "Grupo", largura: "*" },
        { titulo: `Realizado ${e.ano}`, largura: 100, alinhamento: "direita" },
        { titulo: "Previsto", largura: 100, alinhamento: "direita" },
      ],
      linhas: p.linhas.map((x) => ({
        celulas: [
          [
            { texto: x.nome },
            ...(p.modo === "detalhado" ? [{ texto: ` · ${x.grupo}`, suave: true }] : []),
            ...(x.deduzida ? [{ texto: " (com dedução)", suave: true }] : []),
          ],
          [{ texto: formatBRL(x.realizado), suave: true }],
          formatBRL(x.previsto),
        ],
      })),
    });
    if (p.ajustes.length) {
      b.push({ tipo: "titulo", nivel: 3, texto: "Ajustes" });
      b.push({
        tipo: "tabela",
        semCabecalho: true,
        colunas: [{ titulo: "", largura: "*" }, VALOR],
        linhas: p.ajustes.map((a) => l(`${a.sinal === "-" ? "(−)" : "(+)"} ${a.descricao || "Ajuste"}${a.grupo ? ` · ${a.grupo}` : ""}`, a.valor)),
      });
    }
    const mostrarPorUnidadeTrad = e.mostrarPrevisaoPorUnidade !== false && p.unidades !== null;
    b.push(
      resumo([
        l("Base (despesas realizadas)", p.base),
        l("(−) Dedução", p.deducao),
        l(e.variacaoMetodo === "valor" ? "(+) Variação" : `(+) Variação ${formatNumeroBR(p.variacaoPct)}%`, p.variacaoValor),
        l("(+) Ajustes", p.ajustesMais),
        l("(−) Ajustes", p.ajustesMenos),
        l("Anual ajustado", p.totalAnual, { estilo: "total" }),
        l("Mensal (÷ 12)", p.mensal),
        ...(mostrarPorUnidadeTrad
          ? [
              l(`Cota por unidade (÷ ${p.unidades} unidades)`, p.cotaUnidade),
              l(`(+) Reserva por unidade ${formatNumeroBR(p.fundoReservaPct)}%`, p.reservaUnidade),
              l("Valor por unidade", p.rateioSugerido, { estilo: "total" }),
            ]
          : []),
        l("Rateio atual", p.rateioAtual),
        { celulas: ["Índice de reajuste", pctTexto(p.indice)] },
        ...(e.rateioAprovado != null ? [l("Rateio aprovado", e.rateioAprovado, { estilo: "total" })] : []),
      ]),
    );
  }

  const c = rel.comparativo;
  if (rel.secoes.previstoRealizado) {
    b.push(titulo("previstoRealizado", "Previsto × Realizado"));
    b.push({
      tipo: "paragrafo",
      suave: true,
      tamanho: "pequeno",
      texto: `Previsão ${e.ano} × realizado de ${c.meses[0]?.rotulo ?? "—"} a ${c.mesAte.rotulo} (${contagem(c.relatoriosUsados, "relatório mensal", "relatórios mensais")}).`,
    });
    b.push(
      resumo([
        l("Previsto anual", c.total.previstoAnual),
        l(`Previsto até ${c.mesAte.rotulo}`, c.total.previsto),
        // Sem relatório no período não há realizado nem diferença a mostrar (só a mensagem abaixo).
        ...(semRealizado(c)
          ? []
          : [
              l(`Realizado até ${c.mesAte.rotulo}`, c.total.realizado),
              { celulas: ["Diferença", `${formatBRL(c.total.diferenca)} (${pctTexto(c.total.pct)})`], estilo: "total" as const },
            ]),
      ]),
    );
    if (c.grupos.length === 0) b.push(vazio("A previsão deste exercício não tem despesas lançadas."));
    else if (semRealizado(c)) b.push(avisoSemRealizado(c));
    else b.push(...tabelaComparativo(rel.comparativo, e.mostrarContasAnaliticas !== false));
  }

  if (rel.secoes.analise) {
    b.push(titulo("analise", "Análise gráfica"), { tipo: "titulo", nivel: 3, texto: "Previsto × realizado por grupo" });
    if (c.grupos.length && semRealizado(c)) b.push(avisoSemRealizado(c));
    else if (c.grupos.length) {
      const grafico = barrasSvg(
        c.grupos.map((g) => g.nome || "Sem grupo"),
        [
          { nome: "Previsto", cor: "#8fa3c0", valores: c.grupos.map((g) => g.totais.previsto) },
          { nome: "Realizado", cor: "#0b3a5e", valores: c.grupos.map((g) => g.totais.realizado) },
        ],
      );
      b.push(await blocoGrafico(grafico));
    } else b.push(vazio("Sem dados para o gráfico."));
    if (e.mostrarPizza !== false) {
      b.push({ tipo: "titulo", nivel: 3, texto: `Despesas do exercício ${e.ano} por grupo` });
      if (rel.despesasGrupo.length) {
        b.push(await blocoGrafico(pizzaSvg(rel.despesasGrupo)));
      } else b.push(vazio("Sem despesas no demonstrativo."));
    }
    if (e.mostrarReceitasPorCategoria !== false && rel.receitasPorCategoria.length > 0) {
      b.push({ tipo: "titulo", nivel: 3, texto: "Receitas por categoria" });
      for (const serie of rel.receitasPorCategoria) {
        // Nome da categoria como parágrafo em negrito (quebra linha normalmente), não como
        // legenda dentro do SVG — essa não quebra linha numa largura fixa e cortaria um nome
        // longo sem deixar como recuperar o texto depois de rasterizado (achado do Codex no PR #117).
        b.push({ tipo: "paragrafo", texto: serie.nome, negrito: true });
        const grafico = linhaSvg(
          serie.pontos.map((p) => p.mes),
          [{ nome: serie.nome, cor: "#0b3a5e", valores: serie.pontos.map((p) => p.valor) }],
          480,
          true,
        );
        b.push(await blocoGrafico(grafico));
      }
    }
    if (e.mostrarEvolucaoMensal !== false) {
      b.push({ tipo: "titulo", nivel: 3, texto: "Evolução mensal" });
      if (rel.evolucaoMensal.length) {
        const grafico = linhaSvg(
          rel.evolucaoMensal.map((p) => p.mes),
          [
            { nome: "Receitas", cor: "#0b3a5e", valores: rel.evolucaoMensal.map((p) => p.receitas) },
            { nome: "Despesas", cor: "#c7a55b", valores: rel.evolucaoMensal.map((p) => p.despesas) },
            { nome: "Saldo atual", cor: "#5f8f7a", valores: rel.evolucaoMensal.map((p) => p.saldo) },
          ],
        );
        b.push(await blocoGrafico(grafico));
      } else b.push(vazio("Sem relatórios mensais no período."));
    }
  }

  if (rel.secoes.inadimplencia) {
    const inad = rel.inadimplencia;
    b.push(titulo("inadimplencia", "Inadimplência — contas a receber"));
    if (inad.linhas.length === 0) b.push(vazio("Nenhum relatório mensal no período."));
    else {
      b.push({
        tipo: "tabela",
        colunas: [
          { titulo: "Mês", largura: "*" },
          { titulo: "Unidades", largura: 80, alinhamento: "direita" },
          { titulo: "Valor a receber", largura: 110, alinhamento: "direita" },
        ],
        linhas: inad.linhas.map((x) => ({ celulas: [x.mes, x.unidades === null ? "—" : String(x.unidades), formatBRL(x.valor)] })),
      });
      if (inad.final) {
        b.push({
          tipo: "paragrafo",
          texto: [
            { texto: `Posição em ${inad.final.mes}: ` },
            { texto: formatBRL(inad.final.valor), negrito: true },
            { texto: inad.final.unidades !== null ? ` (${inad.final.unidades} unidades).` : "." },
          ],
        });
      }
    }
  }

  if (rel.secoes.notas) {
    b.push(titulo("notas", "Notas explicativas"));
    if (rel.notas.length === 0) b.push(vazio("Nenhuma nota explicativa nos relatórios mensais do período."));
    for (const n of rel.notas) {
      b.push({
        tipo: "paragrafo",
        texto: [
          { texto: `${n.mes}  ` , suave: true },
          { texto: n.rubrica || "Nota", negrito: true },
          ...(n.valor !== null ? [{ texto: `  ·  ${formatBRL(n.valor)}` }] : []),
        ],
      });
      if (n.texto) b.push({ tipo: "paragrafo", texto: n.texto, recuo: true, suave: true, alinhamento: "justificado" });
    }
  }

  if (rel.secoes.assinatura) {
    b.push({ tipo: "espaco", altura: 24 });
    const ld = localEData(e.cidade, e.dataEmissao);
    if (ld) b.push({ tipo: "paragrafo", texto: ld, alinhamento: "centro" });
    const linhas = (escritorio?.assinatura ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    b.push({ tipo: "assinaturas", itens: [[...(linhas.length ? linhas : [" "]), ...(escritorio?.nome ? [escritorio.nome] : [])]] });
  }

  if (b.length === 0) b.push(vazio("Nenhuma seção incluída."));

  return {
    titulo: `Prestação de contas ${e.ano} — ${nome}`,
    arquivo: nomeDeArquivo("prestacao-de-contas", condominio?.codigo || nome, e.ano),
    timbre: timbreDoEscritorio(escritorio),
    semTimbreNaCapa: rel.secoes.capa,
    rodape: `${nome} · Prestação de contas ${e.ano}`,
    blocos: b,
  };
}

export function valores(t: Totais): Texto[] {
  return [
    formatBRL(t.previstoAnual),
    formatBRL(t.previsto),
    formatBRL(t.realizado),
    `${t.diferenca > 0 ? "+" : ""}${formatBRL(t.diferenca)}`,
    // a situação (fora da tolerância) vira o marcador "*" ao lado do percentual, explicado na legenda
    `${pctTexto(t.pct)}${marcaSituacao(t.situacao)}`,
  ];
}

/**
 * Colunas do comparativo no PDF/Word. Larguras fixas (pt, só o texto) dimensionadas para valores até
 * R$ 9.999.999,99 em fonte 7,5; o resto da página fica para a Rubrica (conferido em src/test/documentosLargura.test.ts).
 */
export function colunasComparativo(ate: string): Coluna[] {
  return [
    { titulo: "Rubrica", largura: "*" },
    { titulo: "Previsto anual", largura: 56, alinhamento: "direita" },
    { titulo: `Previsto até ${ate}`, largura: 56, alinhamento: "direita" },
    { titulo: `Realizado até ${ate}`, largura: 56, alinhamento: "direita" },
    { titulo: "Diferença", largura: 60, alinhamento: "direita" },
    { titulo: "%", largura: 40, alinhamento: "direita" },
  ];
}

/** Tabela por rubrica e grupo + legenda do marcador de situação. `mostrarAnaliticas` false esconde as linhas por rubrica. */
export function tabelaComparativo(c: ResultadoComparativo, mostrarAnaliticas = true): Bloco[] {
  const linhas: LinhaTabela[] = [];
  for (const g of c.grupos) {
    linhas.push({ celulas: [g.nome || "Sem grupo"], estilo: "grupo" });
    if (mostrarAnaliticas) {
      for (const x of g.linhas) {
        const nome: Texto = [
          ...(x.tipo === "ajuste" ? [{ texto: x.sinal === "-" ? "− " : "+ ", negrito: true }] : []),
          { texto: x.nome || "Sem nome" },
          ...(x.tipo === "ajuste" ? [{ texto: " (ajuste)", suave: true }] : []),
          ...(x.tipo === "rubrica" && x.previstoAnual === 0 && x.realizado !== 0 ? [{ texto: " (não prevista)", suave: true }] : []),
        ];
        linhas.push({ celulas: [nome, ...valores(x)], recuo: true });
      }
    }
    linhas.push({ celulas: [`Total ${g.nome || "sem grupo"}`, ...valores(g.totais)], estilo: "subtotal", recuo: true });
  }
  linhas.push({ celulas: ["Total geral", ...valores(c.total)], estilo: "total" });
  return [
    { tipo: "tabela", pequena: true, colunas: colunasComparativo(c.mesAte.rotulo), linhas },
    { tipo: "paragrafo", texto: legendaSituacao(c.tolerancia), suave: true, tamanho: "pequeno" },
  ];
}

/** Linha da tabela "Consumo de serviços": serviço (com a rubrica como legenda), consumido e valor médio (período ÷ 12). */
function linhaServico(nome: string, rubricaRotulo: string, consumo: ConsumoServico, fornecedor?: string): LinhaTabela | null {
  if (consumo.valor <= 0) return null;
  return {
    celulas: [
      [
        { texto: nome },
        { texto: `\n${rubricaRotulo}`, suave: true },
        ...(fornecedor ? [{ texto: `\n${fornecedor}`, suave: true }] : []),
      ],
      formatBRL(consumo.valor),
      [{ texto: formatBRL(consumo.valor / 12), suave: true }],
    ],
  };
}

/** Considerações finais — mesmos itens da prévia na tela. */
function consideracoes(e: Exercicio, rel: RelatorioFinal): Bloco[] {
  const c = e.consid;
  const out: Bloco[] = [];
  const grupo = (titulo: string, itens: { rotulo: string; valor: Texto }[], o: { alinhamento?: "esquerda" | "direita" } = {}) => {
    if (itens.length) out.push({ tipo: "titulo", nivel: 3, texto: titulo }, { tipo: "pares", itens, ...o });
  };

  grupo(
    "Administração",
    c.administracao.map((m) => ({
      rotulo: m.cargo || "—",
      valor: [{ texto: m.nome }, ...(m.mandatoFim ? [{ texto: ` · mandato até ${m.mandatoFim}`, suave: true }] : [])],
    })),
  );
  if (c.seguradora || c.vigenciaSeguro || c.seguro.coberturas.length > 0) {
    grupo(
      "Seguro",
      [
        ...(c.seguradora ? [{ rotulo: "Seguradora", valor: c.seguradora }] : []),
        ...(c.vigenciaSeguro ? [{ rotulo: "Vigência até", valor: formatData(c.vigenciaSeguro) }] : []),
        ...(c.seguro.riscoAbsoluto !== null ? [{ rotulo: "Risco absoluto", valor: formatBRL(c.seguro.riscoAbsoluto) }] : []),
        ...c.seguro.coberturas.map((cb) => ({ rotulo: cb.desc || "Cobertura", valor: formatBRL(cb.valor) })),
      ],
      { alinhamento: "direita" },
    );
  }
  const proxima = dataVistoria(c);
  grupo("Manutenções e vistorias", [
    ...(c.vigenciaExtintores ? [{ rotulo: "Recarga dos extintores até", valor: formatData(c.vigenciaExtintores) }] : []),
    ...(c.ultGordura ? [{ rotulo: "Última limpeza da caixa de gordura", valor: formatData(c.ultGordura) }] : []),
    ...(c.ultDedetizacao ? [{ rotulo: "Última dedetização", valor: formatData(c.ultDedetizacao) }] : []),
    ...(c.ultCaixaDagua ? [{ rotulo: "Última limpeza da caixa d'água", valor: formatData(c.ultCaixaDagua) }] : []),
    ...(c.vistoriaAno
      ? [
          {
            rotulo: "Vistoria técnica",
            valor: [
              { texto: String(c.vistoriaAno) },
              ...(proxima ? [{ texto: ` · próxima em ${dataParaBR(proxima)}`, suave: true }] : []),
              ...(c.vistoriaLei ? [{ texto: ` · ${c.vistoriaLei}`, suave: true }] : []),
            ],
          },
        ]
      : []),
  ]);
  const documentos = c.documentosObrigatorios.filter((d) => d.noRelatorio && d.nome.trim());
  grupo(
    "Documentos obrigatórios",
    documentos.map((d) => ({
      rotulo: d.nome,
      valor: [
        { texto: d.status === "ok" ? "Em dia" : "Pendente" },
        ...(d.informacao ? [{ texto: ` · ${d.informacao}`, suave: true }] : []),
        ...(d.observacao ? [{ texto: ` · ${d.observacao}`, suave: true }] : []),
      ],
    })),
  );
  const servicos = [
    linhaServico("Água", c.aguaRubrica, rel.agua),
    linhaServico("Energia elétrica", c.energiaRubrica, rel.energia),
    linhaServico("Elevadores", c.elevadorRubrica, rel.elevador, c.elevadorFornecedor),
  ].filter((l): l is LinhaTabela => l !== null);
  if (servicos.length) {
    out.push(
      { tipo: "titulo", nivel: 3, texto: "Consumo de serviços" },
      {
        tipo: "tabela",
        pequena: true,
        colunas: [
          { titulo: "Serviço", largura: "*" },
          { titulo: "Consumido no período", largura: 110, alinhamento: "direita" },
          { titulo: "Valor médio (÷ 12)", largura: 110, alinhamento: "direita" },
        ],
        linhas: servicos,
      },
    );
  }
  const receber = typeof c.contasReceber === "number" ? c.contasReceber : null;
  const pagar = typeof c.contasPagar === "number" ? c.contasPagar : null;
  grupo("Valores", [
    ...(receber !== null ? [{ rotulo: "Contas a receber", valor: formatBRL(receber) }] : []),
    ...(pagar !== null ? [{ rotulo: "Contas a pagar", valor: formatBRL(pagar) }] : []),
  ]);
  grupo(
    "Índices de correção aplicados",
    c.indices.filter((i) => i.pct !== null).map((i) => ({ rotulo: String(i.ano ?? "—"), valor: `${formatNumeroBR(i.pct)}%` })),
  );
  for (const x of c.extras.filter((x) => String(x.rotulo).trim() || String(x.valor).trim())) {
    out.push({
      tipo: "paragrafo",
      alinhamento: "justificado",
      texto: [
        ...(String(x.rotulo).trim() ? [{ texto: `${x.rotulo}: `, negrito: true }] : []),
        { texto: typeof x.valor === "number" ? formatBRL(x.valor) : String(x.valor) },
      ],
    });
  }
  if (out.length === 0) out.push(vazio("Sem considerações registradas."));
  return out;
}

/** Previsão orçamentária sugerida pelo Systemar (com as edições do usuário) e o quadro por unidade. */
function blocosPrevisaoSugerida(
  e: Exercicio,
  p: PrevisaoSugeridaExercicio,
  r: ResultadoPrevisaoSugerida,
  u: ResultadoPrevisaoSugeridaPorUnidade,
): Bloco[] {
  const fundo = e.prev?.fundoReservaPct ?? 0;
  const mostrarPorUnidade = e.mostrarPrevisaoPorUnidade !== false && u.unidades !== null;
  const sinal = (s: "+" | "-") => (s === "-" ? "(−)" : "(+)");
  return [
    {
      tipo: "tabela",
      colunas: [
        { titulo: "Categoria de despesa", largura: "*" },
        { titulo: "Anual", largura: 100, alinhamento: "direita" },
        { titulo: "Média mês", largura: 100, alinhamento: "direita" },
      ],
      linhas: [
        ...p.categorias.map((c) => ({ celulas: [c.nome, formatBRL(c.anual), [{ texto: formatBRL(c.media), suave: true }]] })),
        { celulas: ["Total das despesas", formatBRL(r.totalDespesasAno), formatBRL(r.totalDespesasMedia)], estilo: "total" },
      ] as LinhaTabela[],
    },
    resumo([
      l("Total das despesas do ano", r.totalDespesasAno),
      ...p.deducoes.map((x) => l(`${sinal(x.sinal)} ${x.descricao || "Dedução"}`, Math.abs(x.valor))),
      l("Total ordinário", r.totalOrdinario, { estilo: "total" }),
      l(`${sinal(p.variacao.sinal)} Variação de despesas sugeridas`, Math.abs(p.variacao.valor)),
      l("Total final (anual)", r.totalFinal, { estilo: "total" }),
      l("Rateio mensal sugerido (÷ 12)", r.rateioMensalSugerido, { estilo: "total" }),
      l("Rateio mensal atual", r.rateioMensalAtual),
      { celulas: ["Índice sugerido para correção", pctTexto(r.indiceSugerido)] },
      ...(e.rateioAprovado != null ? [l("Rateio aprovado", e.rateioAprovado, { estilo: "total" })] : []),
    ]),
    ...(mostrarPorUnidade
      ? [
          { tipo: "titulo", nivel: 3, texto: "Previsão orçamentária por unidade" } as Bloco,
          resumo([
            { celulas: ["Unidades", String(u.unidades)] },
            l("Cota por unidade", u.cotaUnidade),
            l(`(+) Reserva por unidade ${formatNumeroBR(fundo)}%`, u.reservaUnidade),
            l("Valor por unidade", u.valorUnidade, { estilo: "total" }),
          ]),
        ]
      : []),
  ];
}
