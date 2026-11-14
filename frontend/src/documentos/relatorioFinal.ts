import { dataParaBR, formatBRL, formatData, formatNumeroBR } from "@/lib/format";
import { dataVistoria } from "@/domain/painel";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import { barrasSvg, blocoGrafico, linhaSvg, pizzaSvg } from "@/lib/documento/graficos";
import type { Bloco, Coluna, Documento, LinhaTabela, Texto } from "@/lib/documento/tipos";
import {
  legendaSituacao,
  marcaSituacao,
  pctTexto,
} from "@/components/previsto-realizado/TabelaComparativo";
import { semRealizado, textoSemRealizado } from "@/components/previsto-realizado/semRealizado";
import { nomeParaRelatorio } from "@/domain/condominio";
import {
  SECOES,
  type ConsumoServico,
  type RelatorioFinal,
  type SecaoId,
} from "@/domain/relatorioFinal";
import type { ResultadoComparativo, Totais } from "@/domain/previstoRealizado";
import type {
  ResultadoPrevisaoSugerida,
  ResultadoPrevisaoSugeridaPorUnidade,
} from "@/domain/previsaoSugerida";
import { montarFolhaPrevisao } from "@/domain/previsaoFolha";
import type {
  Condominio,
  ConfigEscritorio,
  Exercicio,
  PrevisaoSugeridaExercicio,
} from "@/domain/types";
import { blocosDemonstrativo, localEData, timbreDoEscritorio } from "./comum";
import { contagem } from "@/components/app/textos";

/**
 * Relatório final da prestação de contas: desenha o que `montarRelatorioFinal` já montou,
 * na mesma ordem e com o mesmo conteúdo da prévia na tela (PreviaRelatorio).
 */

const VALOR = { titulo: "Valor", largura: 110, alinhamento: "direita" } as const;
const l = (nome: string, valor: number | null, o: Partial<LinhaTabela> = {}): LinhaTabela => ({
  celulas: [nome, formatBRL(valor)],
  ...o,
});
const resumo = (linhas: LinhaTabela[]): Bloco => ({
  tipo: "tabela",
  semCabecalho: true,
  fundo: true,
  colunas: [
    { titulo: "", largura: "*" },
    { ...VALOR, largura: 150 },
  ],
  linhas,
});
const vazio = (texto: string): Bloco => ({ tipo: "paragrafo", texto, suave: true });
const avisoSemRealizado = (c: ResultadoComparativo): Bloco => ({
  tipo: "paragrafo",
  texto: textoSemRealizado(c),
  negrito: true,
});

export async function documentoRelatorioFinal(o: {
  rel: RelatorioFinal;
  exercicio: Exercicio;
  condominio: Condominio | null;
  escritorio: ConfigEscritorio | null;
}): Promise<Documento> {
  const { rel, exercicio: e, condominio, escritorio } = o;
  const incluidas = SECOES.filter((s) => rel.secoes[s.id]);
  const numeradas = incluidas.filter((s) => s.id !== "capa" && s.id !== "assinatura");
  const titulo = (id: SecaoId, texto: string): Bloco => ({
    tipo: "titulo",
    nivel: 2,
    texto: `${numeradas.findIndex((s) => s.id === id) + 1}. ${texto}`,
  });
  const nome = condominio ? nomeParaRelatorio(condominio) : e.condoNome;
  const d = rel.demonstrativo;
  const b: Bloco[] = [];

  if (rel.secoes.capa) {
    b.push({ tipo: "espaco", altura: 110 });
    if (escritorio?.logo) {
      const ratio = escritorio.logoRatio || 3;
      b.push({
        tipo: "imagem",
        dataUrl: escritorio.logo,
        largura: Math.min(220, 64 * ratio),
        altura: 64,
      });
      b.push({ tipo: "espaco", altura: 30 });
    }
    b.push(
      {
        tipo: "paragrafo",
        texto: "PRESTAÇÃO DE CONTAS",
        alinhamento: "centro",
        suave: true,
        negrito: true,
        tamanho: "pequeno",
      },
      { tipo: "titulo", nivel: 1, texto: nome, alinhamento: "centro" },
    );
    if (condominio?.cnpj)
      b.push({
        tipo: "paragrafo",
        texto: `CNPJ ${condominio.cnpj}`,
        alinhamento: "centro",
        suave: true,
      });
    b.push(
      { tipo: "espaco", altura: 14 },
      { tipo: "paragrafo", texto: `Exercício ${e.ano}`, alinhamento: "centro", tamanho: "grande" },
    );
    if (d?.periodo.ini && d.periodo.fim)
      b.push({
        tipo: "paragrafo",
        texto: `${d.periodo.ini} a ${d.periodo.fim}`,
        alinhamento: "centro",
        suave: true,
      });
    b.push({ tipo: "espaco", altura: 140 });
    const ld = [e.cidade, e.dataEmissao].filter((x) => x.trim()).join(", ");
    if (ld) b.push({ tipo: "paragrafo", texto: ld, alinhamento: "centro", suave: true });
    if (escritorio?.nome)
      b.push({
        tipo: "paragrafo",
        texto: escritorio.nome,
        alinhamento: "centro",
        suave: true,
        tamanho: "pequeno",
      });
    if (incluidas.length > 1) b.push({ tipo: "quebraPagina" });
  }

  if (rel.secoes.demonstrativo) {
    b.push(titulo("demonstrativo", "Demonstrativo de receitas e despesas"));
    b.push(
      ...(d
        ? blocosDemonstrativo(d, e.mostrarContasAnaliticasDemonstrativo !== false)
        : [vazio("Sem demonstrativo.")]),
    );
  }

  if (rel.secoes.consideracoes) {
    b.push(titulo("consideracoes", "Considerações finais"), ...consideracoes(e, rel));
  }

  if (rel.secoes.previsao) {
    // A seção é a folha do Systemar, como o escritório a entrega (decisão de 13/11/2026): rateio
    // atual → histórico por categoria → dedução → total ordinário → variação → rateio anual e
    // mensal → índice. O cálculo do Krieger continua nos menus de manutenção e não é impresso
    // aqui, para não haver dois demonstrativos concorrentes no mesmo relatório.
    const temPrevisaoCompleta =
      e.previsaoSugerida != null &&
      rel.previsaoSugerida != null &&
      Array.isArray(e.previsaoSugerida.categorias) &&
      e.previsaoSugerida.categorias.length > 0;
    if (temPrevisaoCompleta) {
      b.push(
        ...folhaPrevisao(
          e,
          e.previsaoSugerida!,
          rel.previsaoSugerida!,
          titulo("previsao", "Previsão orçamentária"),
        ),
      );
    } else {
      b.push(titulo("previsao", "Previsão orçamentária"));
      b.push({
        tipo: "paragrafo",
        texto:
          "Este exercício não tem a previsão orçamentária sugerida importada do Systemar. Importe o PDF do balanço na prestação de contas para que a folha da previsão seja impressa aqui.",
        suave: true,
      });
    }
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
              {
                celulas: [
                  "Diferença",
                  `${formatBRL(c.total.diferenca)} (${pctTexto(c.total.pct)})`,
                ],
                estilo: "total" as const,
              },
            ]),
      ]),
    );
    if (c.grupos.length === 0)
      b.push(vazio("A previsão deste exercício não tem despesas lançadas."));
    else if (semRealizado(c)) b.push(avisoSemRealizado(c));
    else b.push(...tabelaComparativo(rel.comparativo, e.mostrarContasAnaliticas !== false));
  }

  if (rel.secoes.analise) {
    b.push(titulo("analise", "Análise gráfica"), {
      tipo: "titulo",
      nivel: 3,
      texto: "Previsto × realizado por grupo",
    });
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
            {
              nome: "Receitas",
              cor: "#0b3a5e",
              valores: rel.evolucaoMensal.map((p) => p.receitas),
            },
            {
              nome: "Despesas",
              cor: "#c7a55b",
              valores: rel.evolucaoMensal.map((p) => p.despesas),
            },
            {
              nome: "Saldo atual",
              cor: "#5f8f7a",
              valores: rel.evolucaoMensal.map((p) => p.saldo),
            },
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
        linhas: inad.linhas.map((x) => ({
          celulas: [x.mes, x.unidades === null ? "—" : String(x.unidades), formatBRL(x.valor)],
        })),
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
    if (rel.notas.length === 0)
      b.push(vazio("Nenhuma nota explicativa nos relatórios mensais do período."));
    for (const n of rel.notas) {
      b.push({
        tipo: "paragrafo",
        texto: [
          { texto: `${n.mes}  `, suave: true },
          { texto: n.rubrica || "Nota", negrito: true },
          ...(n.valor !== null ? [{ texto: `  ·  ${formatBRL(n.valor)}` }] : []),
        ],
      });
      if (n.texto)
        b.push({
          tipo: "paragrafo",
          texto: n.texto,
          recuo: true,
          suave: true,
          alinhamento: "justificado",
        });
    }
  }

  if (rel.secoes.assinatura) {
    b.push({ tipo: "espaco", altura: 24 });
    const ld = localEData(e.cidade, e.dataEmissao);
    const linhas = (escritorio?.assinatura ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    b.push({
      tipo: "assinaturas",
      itens: [
        [...(linhas.length ? linhas : [" "]), ...(escritorio?.nome ? [escritorio.nome] : [])],
      ],
      ...(ld ? { localData: ld } : {}),
    });
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
 * Colunas do comparativo no PDF/Word. A largura fixa é só a do texto (a margem da célula soma por
 * fora), calculada para o pior caso de cada coluna em Source Sans 3 a 7,5 pt: um total de
 * R$ 9.999.999,99 com sinal e o marcador de situação, mais folga. O que sobra da página fica com a
 * Rubrica, que é a coluna flexível — a conferência mede o texto real em
 * `src/test/documentosLargura.test.ts`.
 */
export function colunasComparativo(ate: string): Coluna[] {
  return [
    { titulo: "Rubrica", largura: "*" },
    { titulo: "Previsto anual", largura: 54, alinhamento: "direita" },
    { titulo: `Previsto até ${ate}`, largura: 54, alinhamento: "direita" },
    { titulo: `Realizado até ${ate}`, largura: 54, alinhamento: "direita" },
    { titulo: "Diferença", largura: 58, alinhamento: "direita" },
    { titulo: "%", largura: 44, alinhamento: "direita" },
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
          ...(x.tipo === "rubrica" && x.previstoAnual === 0 && x.realizado !== 0
            ? [{ texto: " (não prevista)", suave: true }]
            : []),
        ];
        linhas.push({ celulas: [nome, ...valores(x)], recuo: true });
      }
    }
    linhas.push({
      celulas: [`Total ${g.nome || "sem grupo"}`, ...valores(g.totais)],
      estilo: "subtotal",
      recuo: true,
    });
  }
  linhas.push({ celulas: ["Total geral", ...valores(c.total)], estilo: "total" });
  return [
    { tipo: "tabela", pequena: true, colunas: colunasComparativo(c.mesAte.rotulo), linhas },
    { tipo: "paragrafo", texto: legendaSituacao(c.tolerancia), suave: true, tamanho: "pequeno" },
  ];
}

/**
 * Linha da tabela "Consumo de serviços": serviço (com as despesas do demonstrativo que bateram
 * como legenda — nunca a expressão técnica da rubrica, que é regex e não serve pra leitura),
 * consumido e valor médio (período ÷ 12).
 */
function linhaServico(
  nome: string,
  consumo: ConsumoServico,
  fornecedor?: string,
): LinhaTabela | null {
  if (consumo.valor <= 0) return null;
  const legenda = consumo.rubricas.join(", ");
  return {
    celulas: [
      [
        { texto: nome },
        ...(legenda ? [{ texto: `\n${legenda}`, suave: true }] : []),
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
  const grupo = (
    titulo: string,
    itens: { rotulo: string; valor: Texto }[],
    o: { alinhamento?: "esquerda" | "direita" } = {},
  ) => {
    if (itens.length)
      out.push({ tipo: "titulo", nivel: 3, texto: titulo }, { tipo: "pares", itens, ...o });
  };

  const administracao = c.administracao.filter((m) => m.noRelatorio !== false);
  const coberturas = c.seguro.coberturas.filter((cb) => cb.noRelatorio !== false);
  grupo(
    "Administração",
    administracao.map((m) => ({
      rotulo: m.cargo || "—",
      valor: [
        { texto: m.nome },
        ...(m.mandatoFim ? [{ texto: ` · mandato até ${m.mandatoFim}`, suave: true }] : []),
      ],
    })),
  );
  if (c.seguradora || c.vigenciaSeguro || coberturas.length > 0) {
    grupo(
      "Seguro",
      [
        ...(c.seguradora ? [{ rotulo: "Seguradora", valor: c.seguradora }] : []),
        ...(c.vigenciaSeguro
          ? [{ rotulo: "Vigência até", valor: formatData(c.vigenciaSeguro) }]
          : []),
        ...(c.seguro.riscoAbsoluto !== null
          ? [{ rotulo: "Risco absoluto", valor: formatBRL(c.seguro.riscoAbsoluto) }]
          : []),
        ...coberturas.map((cb) => ({ rotulo: cb.desc || "Cobertura", valor: formatBRL(cb.valor) })),
      ],
      { alinhamento: "direita" },
    );
  }
  const proxima = dataVistoria(c);
  grupo("Manutenções e vistorias", [
    ...(c.vigenciaExtintores
      ? [{ rotulo: "Recarga dos extintores até", valor: formatData(c.vigenciaExtintores) }]
      : []),
    ...(c.ultGordura
      ? [{ rotulo: "Última limpeza da caixa de gordura", valor: formatData(c.ultGordura) }]
      : []),
    ...(c.ultDedetizacao
      ? [{ rotulo: "Última dedetização", valor: formatData(c.ultDedetizacao) }]
      : []),
    ...(c.ultCaixaDagua
      ? [{ rotulo: "Última limpeza da caixa d'água", valor: formatData(c.ultCaixaDagua) }]
      : []),
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
    linhaServico("Água", rel.agua),
    linhaServico("Energia elétrica", rel.energia),
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
    c.indices
      .filter((i) => i.pct !== null && i.noRelatorio !== false)
      .map((i) => ({ rotulo: String(i.ano ?? "—"), valor: `${formatNumeroBR(i.pct)}%` })),
  );
  for (const x of c.extras.filter((x) => String(x.rotulo).trim() || String(x.valor).trim())) {
    // Ignora observações de Alvará estrutural e elevadores
    const rotuloLower = String(x.rotulo).toLowerCase();
    if (rotuloLower.includes("alvará") || rotuloLower.includes("alvara") || rotuloLower.includes("elevador")) {
      continue;
    }
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

/**
 * A folha da previsão orçamentária no padrão do Systemar: título em duas linhas centralizado,
 * rateio atual, histórico de despesas por categoria, dedução, total ordinário, variação e os
 * rateios sugeridos com o índice. Rótulo e valor são ligados por pontilhado condutor
 * (`linhaGuiada`), como no documento do escritório.
 */
function folhaPrevisao(
  e: Exercicio,
  p: PrevisaoSugeridaExercicio,
  r: ResultadoPrevisaoSugerida,
  tituloSecao: Bloco,
): Bloco[] {
  const f = montarFolhaPrevisao(e, p, r);
  const out: Bloco[] = [tituloSecao];
  for (const linha of f.titulo) {
    out.push({
      tipo: "paragrafo",
      texto: linha,
      alinhamento: "centro",
      negrito: true,
      tamanho: "pequeno",
    });
  }
  if (f.rateioAtual) {
    out.push({
      tipo: "linhaGuiada",
      itens: [{ ...f.rateioAtual, espacoAntes: 10 }],
      larguraValor: 110,
    });
  }
  out.push(
    {
      tipo: "paragrafo",
      texto: f.aberturaHistorico.join("\n"),
      tamanho: "pequeno",
      suave: false,
    },
    {
      tipo: "tabela",
      semCabecalho: false,
      pequena: true,
      colunas: [
        { titulo: f.colunas[0], largura: "*" },
        { titulo: f.colunas[1], largura: 95, alinhamento: "direita" },
        { titulo: f.colunas[2], largura: 95, alinhamento: "direita" },
      ],
      linhas: [
        ...f.categorias.map((c) => ({ celulas: [c.nome, c.anual, c.media] })),
        {
          celulas: [f.totalCategorias.nome, f.totalCategorias.anual, f.totalCategorias.media],
          estilo: "total",
        },
      ] as LinhaTabela[],
    },
    {
      tipo: "linhaGuiada",
      itens: f.fechamento,
      larguraValor: 110,
    },
  );
  return out;
}
