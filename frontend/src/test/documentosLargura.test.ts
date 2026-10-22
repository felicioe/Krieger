import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  MARGEM_CELULA,
  PAGINA,
  RECUO_CELULA,
  type Bloco,
  type Documento,
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
 * Conferência automática do motor de documentos (PDF e Word): nenhuma tabela pode pedir mais
 * largura do que a página tem. Colunas fixas (só o texto) + margem de cada célula + a largura
 * mínima das colunas flexíveis ("*") precisam caber em PAGINA.util (483,28 pt).
 */
const MIN_COLUNA_TEXTO = 140;

// Larguras medidas na fonte do PDF (Roboto, 7,5 pt, a da tabela pequena):
const RUBRICA_MAIS_LONGA = 155.3; // "Serviços terceirizados zeladoria (não prevista)"
const VALOR_MAIS_LARGO = 55.1; // "R$ 1.234.567,89"
const DIFERENCA_MAIS_LARGA = 58.4; // "+R$ 1.234.567,89"
const PERCENTUAL_MAIS_LARGO = 36; // "−100,00%*"

type Tabela = Extract<Bloco, { tipo: "tabela" }>;

function larguraFlexivel(t: Pick<Tabela, "colunas" | "pequena" | "grade">): {
  livres: number;
  porColuna: number;
} {
  const margem = 2 * (t.pequena ? MARGEM_CELULA.pequena : MARGEM_CELULA.normal);
  const grade = t.grade ? (t.colunas.length + 1) * 0.6 : 0;
  const fixas = t.colunas.reduce((s, c) => s + (typeof c.largura === "number" ? c.largura : 0), 0);
  const livres = t.colunas.filter((c) => typeof c.largura !== "number").length;
  const sobra = PAGINA.util - fixas - margem * t.colunas.length - grade;
  return { livres, porColuna: livres ? sobra / livres : sobra };
}

function conferirDocumento(nome: string, doc: Documento) {
  const tabelas = doc.blocos.filter((b): b is Tabela => b.tipo === "tabela");
  tabelas.forEach((t, i) => {
    const { livres, porColuna } = larguraFlexivel(t);
    const rotulo = `${nome}, tabela ${i + 1} (${t.colunas.map((c) => c.titulo || "—").join(" | ")})`;
    if (livres)
      expect(
        porColuna,
        `${rotulo}: coluna de texto com menos de ${MIN_COLUNA_TEXTO} pt`,
      ).toBeGreaterThanOrEqual(MIN_COLUNA_TEXTO);
    else expect(porColuna, `${rotulo}: passa da largura da página`).toBeGreaterThanOrEqual(0);
  });
  for (const b of doc.blocos) {
    if (b.tipo === "imagem")
      expect(b.largura, `${nome}: imagem mais larga que a página`).toBeLessThanOrEqual(PAGINA.util);
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

  it("a Rubrica cabe o nome mais longo já visto, numa linha, mesmo recuada", () => {
    const { porColuna } = larguraFlexivel(t);
    expect(porColuna - RECUO_CELULA).toBeGreaterThanOrEqual(RUBRICA_MAIS_LONGA);
  });

  it("valores até R$ 9.999.999,99 cabem nas colunas numéricas sem quebrar", () => {
    const largura = (titulo: string) =>
      t.colunas.find((c) => c.titulo.startsWith(titulo))!.largura as number;
    for (const titulo of ["Previsto anual", "Previsto até", "Realizado até"])
      expect(largura(titulo)).toBeGreaterThanOrEqual(VALOR_MAIS_LARGO);
    expect(largura("Diferença")).toBeGreaterThanOrEqual(DIFERENCA_MAIS_LARGA);
    expect(largura("%")).toBeGreaterThanOrEqual(PERCENTUAL_MAIS_LARGO);
  });
});
