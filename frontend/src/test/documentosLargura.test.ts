import { beforeAll, describe, expect, it, vi } from "vitest";
import { openSync } from "fontkit";
import { resolve } from "node:path";
import {
  FOLGA_COLUNA,
  MARGEM_CELULA,
  PAGINA,
  RECUO_CELULA,
  areaPagina,
  TAMANHO_TABELA,
  textoPlano,
  type Bloco,
  type Documento,
  type LinhaTabela,
  type Texto,
} from "@/lib/documento/tipos";
import { mockApi } from "@/lib/mockApi";
import { normalizarCondominio } from "@/domain/condominio";
import { normalizarExercicio } from "@/domain/exercicio";
import { normalizarMensal } from "@/domain/mensal";
import { normalizarAssembleia } from "@/domain/edital";
import { normalizarAta } from "@/domain/ata";
import { normalizarModelo } from "@/domain/modelo";
import { montarRelatorioFinal } from "@/domain/relatorioFinal";
import { compararPrevistoRealizado } from "@/domain/previstoRealizado";
import { colunasComparativo } from "@/documentos/relatorioFinal";
import type {
  Assembleia,
  Ata,
  Condominio,
  ConfigEscritorio,
  Exercicio,
  Mensal,
  Modelo,
} from "@/domain/types";

// Os gráficos viram PNG no navegador (canvas); aqui basta uma imagem qualquer.
vi.mock("@/lib/documento/imagens", async (original) => ({
  ...(await original<typeof import("@/lib/documento/imagens")>()),
  svgParaPng: async () => "data:image/png;base64,AAAA",
}));

/**
 * Conferência automática do motor de documentos (PDF e Word). Duas garantias:
 *
 * 1. nenhuma tabela pede mais largura do que a página tem — colunas fixas + a margem de cada
 *    célula + a largura mínima das colunas flexíveis ("*") precisam caber em PAGINA.util;
 * 2. o texto de cada célula cabe na sua coluna, **medido na fonte embutida** e não em números
 *    fixos (a conferência antiga usava larguras medidas em Roboto e por isso deixou de valer
 *    quando o PDF passou a usar Source Sans 3).
 *
 * A segunda é a que importa: o pdfmake não quebra um valor monetário, que é um token só; quando
 * não cabe, ele vaza para a coluna vizinha em vez de empurrar a página. Por isso cada célula é
 * medida inteira nas colunas numéricas (alinhadas à direita, onde um valor nunca deve quebrar)
 * e pela maior palavra nas demais (onde quebrar linha é normal).
 */
const MIN_COLUNA_TEXTO = 140;

/** Faces da fonte embutida, as mesmas que `pdf.ts` registra no pdfmake. */
const faces = {
  normal: openSync(resolve(process.cwd(), "src/assets/fontes/SourceSans3-Regular.ttf")),
  bold: openSync(resolve(process.cwd(), "src/assets/fontes/SourceSans3-SemiBold.ttf")),
};

/** Largura do texto em pontos, na face e no corpo usados pelo renderizador. */
function larguraTexto(texto: string, tamanho: number, negrito = false): number {
  const face = faces[negrito ? "bold" : "normal"];
  return (face.layout(texto).advanceWidth * tamanho) / face.unitsPerEm;
}

/** Largura do maior trecho de uma célula, com o corpo e o peso de cada trecho. */
function medidas(t: Texto, tamanho: number, negrito: boolean): { inteiro: number; palavra: number } {
  const trechos = typeof t === "string" ? [{ texto: t }] : t;
  let inteiro = 0;
  let palavra = 0;
  for (const trecho of trechos) {
    const corpo = trecho.pequeno ? tamanho - 1 : tamanho;
    const forte = negrito || !!trecho.negrito;
    for (const parte of trecho.texto.split("\n")) {
      inteiro += larguraTexto(parte, corpo, forte);
      for (const p of parte.split(/\s+/)) {
        if (p) palavra = Math.max(palavra, larguraTexto(p, corpo, forte));
      }
    }
  }
  return { inteiro, palavra };
}

/** Corpo e negrito com que cada estilo de linha é desenhado (ver `tabela` em pdf.ts). */
function estiloDaLinha(l: LinhaTabela, tam: number): { tamanho: number; negrito: boolean } {
  if (l.estilo === "subtotal") return { tamanho: tam - 0.5, negrito: true };
  if (l.estilo === "total") return { tamanho: tam, negrito: true };
  return { tamanho: tam, negrito: false };
}

type Tabela = Extract<Bloco, { tipo: "tabela" }>;

function larguraFlexivel(
  t: Pick<Tabela, "colunas" | "pequena" | "grade">,
  util: number = PAGINA.util,
): {
  livres: number;
  porColuna: number;
} {
  const margem = 2 * (t.pequena ? MARGEM_CELULA.pequena : MARGEM_CELULA.normal);
  const grade = t.grade ? (t.colunas.length + 1) * 0.6 : 0;
  const fixas = t.colunas.reduce((s, c) => s + (typeof c.largura === "number" ? c.largura : 0), 0);
  const livres = t.colunas.filter((c) => typeof c.largura !== "number").length;
  const sobra = util - fixas - margem * t.colunas.length - grade;
  return { livres, porColuna: livres ? sobra / livres : sobra };
}

function conferirDocumento(nome: string, doc: Documento) {
  const util = areaPagina(doc.orientacao).util;
  const tabelas = doc.blocos.filter((b): b is Tabela => b.tipo === "tabela");
  tabelas.forEach((t, i) => {
    const { livres, porColuna } = larguraFlexivel(t, util);
    const rotulo = `${nome}, tabela ${i + 1} (${t.colunas.map((c) => c.titulo || "—").join(" | ")})`;
    if (livres)
      expect(
        porColuna,
        `${rotulo}: coluna de texto com menos de ${MIN_COLUNA_TEXTO} pt`,
      ).toBeGreaterThanOrEqual(MIN_COLUNA_TEXTO);
    else expect(porColuna, `${rotulo}: passa da largura da página`).toBeGreaterThanOrEqual(0);

    const tam = t.pequena ? TAMANHO_TABELA.pequena : TAMANHO_TABELA.normal;

    t.linhas.forEach((linha, n) => {
      if (linha.estilo === "grupo") return; // ocupa a linha toda (colSpan): não tem coluna
      const { tamanho, negrito } = estiloDaLinha(linha, tam);
      linha.celulas.forEach((celula, col) => {
        const coluna = t.colunas[col];
        if (!coluna || typeof coluna.largura !== "number") return; // flexível: conferida acima
        const recuo = col === 0 && linha.recuo ? RECUO_CELULA : 0;
        const { inteiro, palavra } = medidas(celula, tamanho, negrito);
        // À direita, o valor não deve quebrar (dinheiro e percentual são um token).
        const pedaco = coluna.alinhamento === "direita" ? inteiro : palavra;
        const texto = textoPlano(celula).replace(/\n/g, " / ");
        expect(
          pedaco + recuo + FOLGA_COLUNA,
          `${rotulo}: linha ${n + 1}, coluna "${coluna.titulo}", "${texto}" mede ` +
            `${pedaco.toFixed(1)} pt e não cabe em ${coluna.largura} pt`,
        ).toBeLessThanOrEqual(coluna.largura);
      });
    });

    // Cabeçalho pode quebrar entre palavras; o que não pode é uma palavra passar da coluna.
    t.colunas.forEach((coluna) => {
      if (typeof coluna.largura !== "number") return;
      const { palavra } = medidas(coluna.titulo, tam - 0.5, true);
      expect(
        palavra + FOLGA_COLUNA,
        `${rotulo}: cabeçalho "${coluna.titulo}" tem palavra de ${palavra.toFixed(1)} pt ` +
          `para ${coluna.largura} pt`,
      ).toBeLessThanOrEqual(coluna.largura);
    });
  });
  for (const b of doc.blocos) {
    if (b.tipo === "imagem")
      expect(b.largura, `${nome}: imagem mais larga que a página`).toBeLessThanOrEqual(util);
  }
  return tabelas.length;
}

const docs: { nome: string; doc: () => Promise<Documento> | Documento }[] = [];
let dados: {
  condo: Condominio;
  exercicio: Exercicio;
  mensais: Mensal[];
  escritorio: ConfigEscritorio | null;
  assembleia: Assembleia;
  ata: Ata;
  modelo: Modelo;
};

beforeAll(async () => {
  localStorage.clear();
  await mockApi.auth.entrar("admin", "admin123");
  const condo = normalizarCondominio(
    (await mockApi.listar<Condominio>("condominios")).find((c) => c.id === "condo-acacias")!,
  );
  const exercicio = normalizarExercicio(
    (await mockApi.listar<Exercicio>("exercicios")).find((e) => e.condoId === condo.id)!,
  );
  const mensais = (await mockApi.listar<Mensal>("mensais")).map((m) => normalizarMensal(m));
  const escritorio = await mockApi.obter<ConfigEscritorio>("config", "escritorio");
  const assembleia = normalizarAssembleia((await mockApi.listar<Assembleia>("assembleias"))[0]!);
  const ata = normalizarAta((await mockApi.listar<Ata>("atas"))[0]!);
  const modelo = normalizarModelo((await mockApi.listar<Modelo>("modelos"))[0]!);
  dados = { condo, exercicio, mensais, escritorio, assembleia, ata, modelo };
});

describe("todas as tabelas dos documentos cabem na página (PDF e Word)", () => {
  it("Relatório final (todas as seções), Previsto × Realizado, Relatório mensal, Edital, Lista de presença, Procuração e Ata", async () => {
    const { documentoRelatorioFinal } = await import("@/documentos/relatorioFinal");
    const { documentoPrevistoRealizado } = await import("@/documentos/previstoRealizado");
    const { documentoMensal } = await import("@/documentos/mensal");
    const { documentoEdital } = await import("@/documentos/edital");
    const { documentoListaPresenca, documentoProcuracao } = await import("@/documentos/presenca");
    const { documentoAta } = await import("@/documentos/ata");
    const { condo, exercicio, mensais, escritorio, assembleia, ata, modelo } = dados;
    const todas = {
      ...exercicio,
      mostrarAnalise: true,
      relatorioFinal: { ...exercicio.relatorioFinal, secoes: {} },
    } as Exercicio;
    const rel = montarRelatorioFinal({ exercicio: todas, condominio: condo, escritorio, mensais });
    const comparativo = compararPrevistoRealizado(exercicio, mensais, { condominio: condo });
    docs.push(
      {
        nome: "Relatório final",
        doc: () =>
          documentoRelatorioFinal({ rel, exercicio: todas, condominio: condo, escritorio }),
      },
      {
        nome: "Previsto × Realizado",
        doc: () =>
          documentoPrevistoRealizado({ comparativo, exercicio, condominio: condo, escritorio }),
      },
      {
        nome: "Relatório mensal",
        doc: () => documentoMensal({ mensal: mensais[0]!, condominio: condo, escritorio }),
      },
      {
        nome: "Edital",
        doc: () => documentoEdital({ assembleia, condominio: condo, modelo, escritorio }),
      },
      {
        nome: "Lista de presença",
        doc: () => documentoListaPresenca({ assembleia, condominio: condo, escritorio }),
      },
      {
        nome: "Procuração",
        doc: () => documentoProcuracao({ assembleia, condominio: condo, escritorio }),
      },
      {
        nome: "Ata",
        doc: () => documentoAta({ ata, condominio: condo, cidade: "Florianópolis", escritorio }),
      },
    );
    let total = 0;
    for (const d of docs) total += conferirDocumento(d.nome, await d.doc());
    // Garante que a conferência olhou tabelas de verdade (o comparativo inclusive).
    expect(total).toBeGreaterThanOrEqual(8);
  });
});

describe("tabela Previsto × Realizado sem campos apertados", () => {
  const t = { colunas: colunasComparativo("09/2026"), pequena: true };
  const tam = TAMANHO_TABELA.pequena;
  const NOME_MAIS_LONGO = "Serviços terceirizados zeladoria (não prevista)";

  it("a Rubrica cabe o nome mais longo já visto, numa linha, mesmo recuada", () => {
    const { porColuna } = larguraFlexivel(t);
    expect(porColuna - RECUO_CELULA).toBeGreaterThanOrEqual(larguraTexto(NOME_MAIS_LONGO, tam));
  });

  it("valores até R$ 9.999.999,99 cabem nas colunas numéricas sem quebrar", () => {
    const largura = (titulo: string) =>
      t.colunas.find((c) => c.titulo.startsWith(titulo))!.largura as number;
    // Pior caso: linha de total, em negrito, com sinal e marcador de situação.
    const casos: [string, string][] = [
      ["Previsto anual", "R$ 9.999.999,99"],
      ["Previsto até", "R$ 9.999.999,99"],
      ["Realizado até", "R$ 9.999.999,99"],
      ["Diferença", "+R$ 9.999.999,99"],
      ["%", "+1.234,56%*"],
    ];
    for (const [titulo, valor] of casos) {
      const medida = larguraTexto(valor, tam, true);
      expect(
        medida + FOLGA_COLUNA,
        `"${valor}" mede ${medida.toFixed(1)} pt e não cabe na coluna "${titulo}" (${largura(titulo)} pt)`,
      ).toBeLessThanOrEqual(largura(titulo));
    }
  });
});
