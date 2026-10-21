import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { COR, PAGINA, type Alinhamento, type Bloco, type Coluna, type Documento, type LinhaTabela, type Texto } from "./tipos";
import { carregarPng, paraPng } from "./imagens";

/** Desenha o documento em PDF (pdfmake, carregado sob demanda). */
export async function gerarPdf(doc: Documento): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(vfs);
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

function texto(t: Texto, tamanho = 10): string | Content[] {
  if (typeof t === "string") return t;
  return t.map((x) => ({
    text: x.texto,
    ...(x.negrito ? { bold: true } : {}),
    ...(x.italico ? { italics: true } : {}),
    ...(x.suave ? { color: c(COR.suave) } : {}),
    ...(x.pequeno ? { fontSize: tamanho - 1 } : {}),
  }));
}

async function montarDefinicao(doc: Documento): Promise<TDocumentDefinitions> {
  const img = doc.timbre?.logo ? await carregarPng(doc.timbre.logo.dataUrl) : null;
  const logo = img?.dataUrl ?? null;
  const ratio = img && img.altura ? img.largura / img.altura : 3;
  const conteudo: Content[] = [];
  for (const b of doc.blocos) conteudo.push(...(await bloco(b)));
  const timbre = doc.timbre;
  const topo = timbre ? 92 : PAGINA.margem;
  const rodapeTexto = [timbre?.rodape?.trim(), doc.rodape?.trim()].filter(Boolean).join("\n");

  return {
    pageSize: "A4",
    pageMargins: [PAGINA.margem, topo, PAGINA.margem, 64],
    info: { title: doc.titulo, creator: "Sistema Krieger" },
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25, color: c(COR.texto) },
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
            canvas: [{ type: "line", x1: 0, y1: 6, x2: PAGINA.util, y2: 6, lineWidth: 0.8, lineColor: c(COR.primaria) }],
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

async function bloco(b: Bloco): Promise<Content[]> {
  switch (b.tipo) {
    case "titulo": {
      const estilo =
        b.nivel === 1
          ? { fontSize: 15, margin: [0, 0, 0, 8] as [number, number, number, number] }
          : b.nivel === 2
            ? { fontSize: 12, margin: [0, 16, 0, 6] as [number, number, number, number] }
            : { fontSize: 10.5, margin: [0, 10, 0, 3] as [number, number, number, number] };
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
    case "paragrafo":
      return [
        {
          text: texto(b.texto, b.tamanho === "pequeno" ? 8.5 : b.tamanho === "grande" ? 13 : 10),
          alignment: ALINHA[b.alinhamento ?? "esquerda"],
          fontSize: b.tamanho === "pequeno" ? 8.5 : b.tamanho === "grande" ? 13 : 10,
          margin: [b.recuo ? 16 : 0, 0, 0, 6],
          ...(b.suave ? { color: c(COR.suave) } : {}),
          ...(b.negrito ? { bold: true } : {}),
        } as Content,
      ];
    case "lista": {
      const itens = b.itens.map((i) => ({ text: texto(i), margin: [0, 0, 0, 3] }) as Content);
      return [b.numerada ? ({ ol: itens, margin: [12, 0, 0, 8] } as Content) : ({ ul: itens, margin: [12, 0, 0, 8] } as Content)];
    }
    case "pares":
      return [
        {
          table: {
            widths: [150, "*"],
            body: b.itens.map((p) => [
              { text: p.rotulo, color: c(COR.suave) },
              { text: texto(p.valor) },
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
      const largura = Math.min(220, (PAGINA.util - (n - 1) * 32) / n);
      return [
        {
          columns: [
            { text: "", width: "*" },
            ...b.itens.flatMap((linhas, i) => [
              ...(i > 0 ? [{ text: "", width: 32 }] : []),
              {
                width: largura,
                stack: [
                  { canvas: [{ type: "line", x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: 0.7, lineColor: c(COR.texto) }] },
                  ...linhas.map((l, k) => ({ text: l, alignment: "center", margin: [0, k === 0 ? 4 : 0, 0, 0], ...(k > 0 ? { fontSize: 9, color: c(COR.suave) } : {}) })),
                ],
              },
            ]),
            { text: "", width: "*" },
          ],
          margin: [0, 36, 0, 8],
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
  const tam = o.pequena ? 7.5 : 9.5;
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
        ...(i === 0 && l.recuo ? { margin: [10, 0, 0, 0] } : {}),
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
      paddingLeft: () => (o.pequena ? 4 : 5),
      paddingRight: () => (o.pequena ? 4 : 5),
      paddingTop: () => 2.5,
      paddingBottom: () => 2.5,
    },
    margin: [0, 0, 0, 10],
  } as Content;
}
