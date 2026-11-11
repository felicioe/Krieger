import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { COR, MARGEM_CELULA, PAGINA, RECUO_CELULA, TAMANHO_TABELA, areaPagina, type Alinhamento, type Bloco, type Coluna, type Documento, type LinhaTabela, type Texto } from "./tipos";
import { carregarPng, paraPng } from "./imagens";
import { FONTES, FONTES_DOCUMENTO, vfsFonte, vfsFonteDocumento } from "./fontes";
import { tipografia, type Tipografia } from "./tipografia";

/** Desenha o documento em PDF (pdfmake, carregado sob demanda). */
export async function gerarPdf(doc: Documento): Promise<Blob> {
  const { default: pdfMake } = await import("pdfmake/build/pdfmake");
  // Fonte embutida no próprio chunk (base64): sem VFS do Roboto e sem requisição de rede.
  pdfMake.addVirtualFileSystem(vfsFonte());
  pdfMake.addFonts(FONTES);
  // A família de documento (Liberation Sans) só entra quando o documento a pede: edital e
  // relatórios não pagam esses bytes. O registro é idempotente (`pack` sobrescreve a chave).
  if (doc.fonte === "documento") {
    pdfMake.addVirtualFileSystem(await vfsFonteDocumento());
    pdfMake.addFonts(FONTES_DOCUMENTO);
  }
  const definicao = await montarDefinicao(doc);
  return pdfMake.createPdf(definicao).getBlob();
}

const c = (hex: string) => `#${hex}`;
const ALINHA: Record<Alinhamento, "left" | "center" | "right" | "justify"> = {
  esquerda: "left",
  centro: "center",
  direita: "right",
  justificado: "justify",
};
const ALINHA_COL = { esquerda: "left", centro: "center", direita: "right" } as const;

function texto(t: Texto, tamanho: number): string | Content[] {
  if (typeof t === "string") return t;
  return t.map((x) => ({
    text: x.texto,
    ...(x.negrito ? { bold: true } : {}),
    ...(x.italico ? { italics: true } : {}),
    ...(x.suave ? { color: c(COR.suave) } : {}),
    ...(x.pequeno ? { fontSize: tamanho - 1 } : {}),
  }));
}

/** Moldura na página inteira, desenhada no fundo (modelos de ata de cartório). */
function moldura(folha: { largura: number; altura: number }): Content {
  const m = PAGINA.margem / 2;
  return {
    canvas: [
      {
        type: "rect",
        x: m,
        y: m,
        w: folha.largura - 2 * m,
        h: folha.altura - 2 * m,
        lineWidth: 0.8,
        lineColor: c(COR.primaria),
      },
    ],
  } as Content;
}

async function montarDefinicao(doc: Documento): Promise<TDocumentDefinitions> {
  const t = tipografia(doc);
  const img = doc.timbre?.logo ? await carregarPng(doc.timbre.logo.dataUrl) : null;
  const logo = img?.dataUrl ?? null;
  const ratio = img && img.altura ? img.largura / img.altura : 3;
  const folha = areaPagina(doc.orientacao);
  const conteudo: Content[] = [];
  for (const b of doc.blocos) conteudo.push(...(await bloco(b, t, folha.util)));
  const timbre = doc.timbre;
  const topo = timbre ? 92 : PAGINA.margem;
  // Decisão: o texto do rodapé identifica o escritório. Ata de modelo sem logo do escritório
  // (`timbre: null`) não o carrega; a numeração "Página X de Y" continua, porque é referência
  // do documento, não do escritório. Ver `rodapeEscritorio` em tipografia.ts.
  const rodapeTexto = t.rodapeEscritorio ? [timbre?.rodape?.trim(), doc.rodape?.trim()].filter(Boolean).join("\n") : "";

  return {
    pageSize: "A4",
    pageOrientation: doc.orientacao === "paisagem" ? "landscape" : "portrait",
    pageMargins: [PAGINA.margem, topo, PAGINA.margem, 64],
    ...(doc.bordaPagina ? { background: () => moldura(folha) } : {}),
    info: { title: doc.titulo, creator: "Sistema Krieger" },
    defaultStyle: { font: t.familiaPdf, fontSize: t.corpo, lineHeight: 1.25, color: c(COR.texto) },
    ...(doc.marcaDagua ? { watermark: { text: doc.marcaDagua, color: c(COR.primaria), opacity: 0.07, bold: true } } : {}),
    header: (pagina: number) => {
      if (!timbre || (doc.semTimbreNaCapa && pagina === 1)) return null;
      const altura = 34;
      const largura = logo ? Math.min(160, altura * ratio) : 0;
      return {
        margin: [PAGINA.margem, 28, PAGINA.margem, 0],
        stack: [
          {
            columns: [
              logo ? { image: logo, fit: [largura, altura], width: largura } : { text: "", width: 0 },
              {
                text: timbre.nome,
                alignment: "right",
                fontSize: 9,
                bold: true,
                color: c(COR.primaria),
                margin: [0, logo ? 12 : 0, 0, 0],
              },
            ],
          },
          {
            canvas: [{ type: "line", x1: 0, y1: 6, x2: folha.util, y2: 6, lineWidth: 0.8, lineColor: c(COR.primaria) }],
          },
        ],
      } as Content;
    },
    footer: (pagina: number, total: number) => ({
      margin: [PAGINA.margem, 18, PAGINA.margem, 0],
      columns: [
        { text: rodapeTexto, fontSize: 7.5, color: c(COR.suave), lineHeight: 1.2 },
        { text: `Página ${pagina} de ${total}`, fontSize: 7.5, color: c(COR.suave), alignment: "right", width: 80 },
      ],
    }),
    content: conteudo,
    // Título nunca fica sozinho no pé da página: se só houver títulos depois dele, vai para a próxima.
    pageBreakBefore: (no, consulta) => {
      if (no.headlineLevel === undefined) return false;
      const limite = no.headlineLevel <= 2 ? 0.8 : 0.87;
      return no.startPosition.verticalRatio > limite || consulta.getFollowingNodesOnPage().every((n) => n.headlineLevel !== undefined);
    },
  };
}

async function bloco(b: Bloco, t: Tipografia, util: number = PAGINA.util): Promise<Content[]> {
  switch (b.tipo) {
    case "titulo": {
      const estilo =
        b.nivel === 1
          ? { fontSize: t.titulo[1], margin: [0, 0, 0, 8] as [number, number, number, number] }
          : b.nivel === 2
            ? { fontSize: t.titulo[2], margin: [0, 16, 0, 6] as [number, number, number, number] }
            : { fontSize: t.titulo[3], margin: [0, 10, 0, 3] as [number, number, number, number] };
      return [
        {
          text: b.texto,
          bold: true,
          color: c(b.nivel === 3 ? COR.texto : COR.primaria),
          alignment: ALINHA[b.alinhamento ?? "esquerda"],
          headlineLevel: b.nivel,
          ...estilo,
        } as Content,
      ];
    }
    case "paragrafo": {
      const corpo = t.paragrafo[b.tamanho ?? "normal"];
      return [
        {
          text: texto(b.texto, corpo),
          alignment: ALINHA[b.alinhamento ?? "esquerda"],
          fontSize: corpo,
          margin: [b.recuo ? 16 : 0, 0, 0, 6],
          ...(b.suave ? { color: c(COR.suave) } : {}),
          ...(b.negrito ? { bold: true } : {}),
        } as Content,
      ];
    }
    case "lista": {
      const itens = b.itens.map((i) => ({ text: texto(i, t.corpo), margin: [0, 0, 0, 3] }) as Content);
      return [b.numerada ? ({ ol: itens, margin: [12, 0, 0, 8] } as Content) : ({ ul: itens, margin: [12, 0, 0, 8] } as Content)];
    }
    case "pares":
      return [
        {
          table: {
            widths: [150, "*"],
            body: b.itens.map((p) => [
              { text: p.rotulo, color: c(COR.suave) },
              { text: texto(p.valor, t.corpo), ...(b.alinhamento === "direita" ? { alignment: "right" } : {}) },
            ]),
          },
          layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 8, paddingTop: () => 1.5, paddingBottom: () => 1.5 },
          margin: [0, 0, 0, 8],
        } as Content,
      ];
    case "tabela":
      return [tabela(b.colunas, b.linhas, b)];
    case "imagem": {
      const png = await paraPng(b.dataUrl);
      return [{ image: png, fit: [b.largura, b.altura], alignment: ALINHA[b.alinhamento ?? "centro"], margin: [0, 4, 0, 10] } as Content];
    }
    case "espaco":
      return [{ text: "", margin: [0, b.altura, 0, 0] }];
    case "quebraPagina":
      return [{ text: "", pageBreak: "after" }];
    case "assinaturas": {
      const n = b.itens.length || 1;
      const largura = Math.min(220, (util - (n - 1) * 32) / n);
      const colunas = {
        columns: [
          { text: "", width: "*" },
          ...b.itens.flatMap((linhas, i) => [
            ...(i > 0 ? [{ text: "", width: 32 }] : []),
            {
              width: largura,
              stack: [
                { canvas: [{ type: "line", x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: 0.7, lineColor: c(COR.texto) }] },
                ...linhas.map((l, k) => ({ text: l, alignment: "center", margin: [0, k === 0 ? 4 : 0, 0, 0], ...(k > 0 ? { fontSize: t.corpo - 1, color: c(COR.suave) } : {}) })),
              ],
            },
          ]),
          { text: "", width: "*" },
        ],
        margin: [0, 36, 0, 8],
      };
      // `localData` entra no mesmo stack e herda o `unbreakable` do bloco inteiro — local/data e
      // assinatura nunca podem cair em páginas diferentes (ver comentário em tipos.ts).
      return [
        {
          stack: [
            ...(b.localData ? [{ text: b.localData, alignment: ALINHA[b.localDataAlinhamento ?? "centro"], margin: [0, 0, 0, 6] }] : []),
            colunas,
          ],
          unbreakable: true,
        } as Content,
      ];
    }
  }
}

function tabela(
  colunas: Coluna[],
  linhas: LinhaTabela[],
  o: { semCabecalho?: boolean; fundo?: boolean; pequena?: boolean; alturaLinha?: number; grade?: boolean },
): Content {
  const tam = o.pequena ? TAMANHO_TABELA.pequena : TAMANHO_TABELA.normal;
  const n = colunas.length;
  const alin = (i: number) => ALINHA_COL[colunas[i]?.alinhamento ?? "esquerda"];
  const corpo: TableCell[][] = [];
  if (!o.semCabecalho) {
    corpo.push(
      colunas.map((col, i) => ({
        text: col.titulo,
        bold: true,
        fontSize: tam - 0.5,
        lineHeight: 1.05,
        color: c(COR.primaria),
        alignment: alin(i),
        fillColor: c(COR.fundo),
      })),
    );
  }
  for (const l of linhas) {
    const estilo = l.estilo ?? "normal";
    if (estilo === "grupo") {
      corpo.push([
        { text: texto(l.celulas[0] ?? "", tam - 1), colSpan: n, bold: true, fontSize: tam - 1, lineHeight: 1.05, color: c(COR.primaria), fillColor: c(COR.grupo), characterSpacing: 0.3 },
        ...Array.from({ length: n - 1 }, () => ({ text: "" })),
      ]);
      continue;
    }
    corpo.push(
      colunas.map((_, i) => ({
        text: texto(l.celulas[i] ?? "", estilo === "subtotal" ? tam - 0.5 : tam),
        alignment: alin(i),
        lineHeight: 1.05,
        fontSize: estilo === "subtotal" ? tam - 0.5 : tam,
        ...(estilo === "total" ? { bold: true } : {}),
        ...(estilo === "subtotal" ? { color: c(COR.suave), bold: true } : {}),
        ...(i === 0 && l.recuo ? { margin: [RECUO_CELULA, 0, 0, 0] } : {}),
        ...(o.fundo ? { fillColor: c(COR.fundo) } : {}),
      })),
    );
  }
  const totais = new Set(linhas.map((l, i) => (l.estilo === "total" ? i + (o.semCabecalho ? 0 : 1) : -1)));
  return {
    table: {
      headerRows: o.semCabecalho ? 0 : 1,
      widths: colunas.map((col) => col.largura ?? "*"),
      ...(o.alturaLinha ? { heights: (i: number) => (i < (o.semCabecalho ? 0 : 1) ? "auto" : o.alturaLinha!) } : {}),
      body: corpo,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === node.table.body.length ? (o.fundo ? 0 : 0.6) : totais.has(i) ? 0.8 : 0.4,
      vLineWidth: (i: number) => (o.grade ? (i === 0 || i === n ? 0.6 : 0.4) : 0),
      vLineColor: () => c(COR.linha),
      hLineColor: (i: number) => (totais.has(i) ? c(COR.suave) : c(COR.linha)),
      // tabela pequena (comparativo com muitas colunas): margem lateral menor para caber mais texto por linha
      paddingLeft: () => (o.pequena ? MARGEM_CELULA.pequena : MARGEM_CELULA.normal),
      paddingRight: () => (o.pequena ? MARGEM_CELULA.pequena : MARGEM_CELULA.normal),
      paddingTop: () => 2.5,
      paddingBottom: () => 2.5,
    },
    margin: [0, 0, 0, 10],
  } as Content;
}
