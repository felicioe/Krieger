import type { Bloco, Coluna, Documento, LinhaTabela, Texto, Alinhamento } from "./tipos";
import { COR, MARGEM_CELULA, PAGINA, RECUO_CELULA } from "./tipos";
import { bytesDe, carregarPng } from "./imagens";

/** Desenha o documento em Word (.docx, biblioteca docx carregada sob demanda). */
export async function gerarWord(doc: Documento): Promise<Blob> {
  const d = await import("docx");
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    ImageRun,
    LevelFormat,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    HeightRule,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = d;

  const tw = (pt: number) => Math.round(pt * 20);
  const meio = (pt: number) => Math.round(pt * 2);
  const px = (pt: number) => Math.round((pt * 96) / 72);
  const UTIL = tw(PAGINA.util);
  const ALINHA = {
    esquerda: AlignmentType.LEFT,
    centro: AlignmentType.CENTER,
    direita: AlignmentType.RIGHT,
    justificado: AlignmentType.JUSTIFIED,
  } as const;
  const al = (a?: Alinhamento | undefined) => ALINHA[a ?? "esquerda"];
  const SEM = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const LINHA = { style: BorderStyle.SINGLE, size: 4, color: COR.linha };
  const semBordas = { top: SEM, bottom: SEM, left: SEM, right: SEM, insideHorizontal: SEM, insideVertical: SEM };

  type Base = { tamanho?: number; cor?: string; negrito?: boolean };
  /** Trechos → runs; "\n" vira quebra de linha. */
  function runs(t: Texto, base: Base = {}) {
    const trechos = typeof t === "string" ? [{ texto: t }] : t;
    const out: InstanceType<typeof TextRun>[] = [];
    for (const x of trechos) {
      const partes = x.texto.split("\n");
      partes.forEach((p, i) =>
        out.push(
          new TextRun({
            text: p,
            ...(i > 0 ? { break: 1 } : {}),
            bold: ("negrito" in x && x.negrito) || base.negrito || false,
            italics: ("italico" in x && x.italico) || false,
            color: "suave" in x && x.suave ? COR.suave : (base.cor ?? COR.texto),
            ...("pequeno" in x && x.pequeno
              ? { size: meio((base.tamanho ?? 10) - 1) }
              : base.tamanho
                ? { size: meio(base.tamanho) }
                : {}),
          }),
        ),
      );
    }
    return out;
  }

  let instancia = 0;
  const filhos: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  function celula(
    t: Texto,
    o: { largura: number; alinhamento?: Alinhamento | undefined; fill?: string; span?: number; recuo?: boolean | undefined; lado?: number } & Base,
  ) {
    return new TableCell({
      width: { size: o.largura, type: WidthType.DXA },
      ...(o.span ? { columnSpan: o.span } : {}),
      ...(o.fill ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: o.fill } } : {}),
      margins: { top: 40, bottom: 40, left: o.lado ?? 100, right: o.lado ?? 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: al(o.alinhamento),
          spacing: { after: 0, line: 252 },
          ...(o.recuo ? { indent: { left: RECUO_CELULA * 20 } } : {}),
          children: runs(t, o),
        }),
      ],
    });
  }

  /** `extra` (twips) soma às colunas de largura fixa: no PDF a largura é só do texto, sem a margem da célula. */
  function larguras(colunas: Coluna[], extra = 0): number[] {
    const fixas = colunas.reduce((s, c) => s + (typeof c.largura === "number" ? tw(c.largura) + extra : 0), 0);
    const livres = colunas.filter((c) => typeof c.largura !== "number").length;
    const resto = livres ? Math.max(600, Math.floor((UTIL - fixas) / livres)) : 0;
    return colunas.map((c) => (typeof c.largura === "number" ? tw(c.largura) + extra : resto));
  }

  function tabela(
    colunas: Coluna[],
    linhas: LinhaTabela[],
    o: { semCabecalho?: boolean; fundo?: boolean; pequena?: boolean; alturaLinha?: number; grade?: boolean },
  ) {
    const altura = o.alturaLinha ? { height: { value: Math.round(o.alturaLinha * 20), rule: HeightRule.ATLEAST } } : {};
    // tabela pequena (comparativo): mesma margem lateral e mesma largura de texto por coluna que o PDF
    const lado = (o.pequena ? MARGEM_CELULA.pequena : MARGEM_CELULA.normal) * 20;
    const ws = larguras(colunas, o.pequena ? 2 * lado : 0);
    const tam = o.pequena ? 7.5 : 9.5;
    const total = ws.reduce((s, w) => s + w, 0);
    const rows: InstanceType<typeof TableRow>[] = [];
    if (!o.semCabecalho) {
      rows.push(
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: colunas.map((c, i) =>
            celula(c.titulo, { largura: ws[i]!, lado, alinhamento: c.alinhamento, fill: COR.fundo, negrito: true, cor: COR.primaria, tamanho: tam - 0.5 }),
          ),
        }),
      );
    }
    for (const l of linhas) {
      const estilo = l.estilo ?? "normal";
      if (estilo === "grupo") {
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [celula(l.celulas[0] ?? "", { largura: total, lado, span: colunas.length, fill: COR.grupo, negrito: true, cor: COR.primaria, tamanho: tam - 1 })],
          }),
        );
        continue;
      }
      rows.push(
        new TableRow({
          cantSplit: true,
          ...altura,
          children: colunas.map((c, i) =>
            celula(l.celulas[i] ?? "", {
              largura: ws[i]!,
              lado,
              alinhamento: c.alinhamento,
              recuo: i === 0 && l.recuo,
              tamanho: estilo === "subtotal" ? tam - 0.5 : tam,
              negrito: estilo === "total" || estilo === "subtotal",
              cor: estilo === "subtotal" ? COR.suave : COR.texto,
              ...(o.fundo ? { fill: COR.fundo } : {}),
            }),
          ),
        }),
      );
    }
    return new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: ws,
      layout: TableLayoutType.FIXED,
      borders: o.fundo
        ? semBordas
        : o.grade
          ? { top: LINHA, bottom: LINHA, left: LINHA, right: LINHA, insideHorizontal: LINHA, insideVertical: LINHA }
          : { top: LINHA, bottom: LINHA, left: SEM, right: SEM, insideHorizontal: LINHA, insideVertical: SEM },
      rows,
    });
  }

  const espacoDepois = () => new Paragraph({ spacing: { after: 120 }, children: [] });

  for (const b of doc.blocos) await bloco(b);

  async function bloco(b: Bloco) {
    switch (b.tipo) {
      case "titulo": {
        const t = b.nivel === 1 ? 15 : b.nivel === 2 ? 12 : 10.5;
        filhos.push(
          new Paragraph({
            alignment: al(b.alinhamento),
            keepNext: true,
            spacing: { before: tw(b.nivel === 1 ? 0 : b.nivel === 2 ? 16 : 10), after: tw(b.nivel === 1 ? 8 : b.nivel === 2 ? 6 : 3) },
            children: runs(b.texto, { tamanho: t, negrito: true, cor: b.nivel === 3 ? COR.texto : COR.primaria }),
          }),
        );
        return;
      }
      case "paragrafo":
        filhos.push(
          new Paragraph({
            alignment: al(b.alinhamento),
            spacing: { after: tw(6) },
            ...(b.recuo ? { indent: { left: tw(16) } } : {}),
            children: runs(b.texto, {
              tamanho: b.tamanho === "pequeno" ? 8.5 : b.tamanho === "grande" ? 13 : 10,
              ...(b.suave ? { cor: COR.suave } : {}),
              ...(b.negrito ? { negrito: true } : {}),
            }),
          }),
        );
        return;
      case "lista": {
        instancia += 1;
        b.itens.forEach((i) =>
          filhos.push(
            new Paragraph({
              numbering: { reference: b.numerada ? "numerada" : "marcadores", level: 0, instance: instancia },
              spacing: { after: tw(3) },
              children: runs(i),
            }),
          ),
        );
        filhos.push(new Paragraph({ spacing: { after: tw(4) }, children: [] }));
        return;
      }
      case "pares": {
        const ws = [tw(150), UTIL - tw(150)];
        filhos.push(
          new Table({
            width: { size: UTIL, type: WidthType.DXA },
            columnWidths: ws,
            layout: TableLayoutType.FIXED,
            borders: semBordas,
            rows: b.itens.map(
              (p) =>
                new TableRow({
                  cantSplit: true,
                  children: [
                    celula(p.rotulo, { largura: ws[0]!, cor: COR.suave }),
                    celula(p.valor, { largura: ws[1]!, alinhamento: b.alinhamento === "direita" ? "direita" : "esquerda" }),
                  ],
                }),
            ),
          }),
          espacoDepois(),
        );
        return;
      }
      case "tabela":
        filhos.push(tabela(b.colunas, b.linhas, b), espacoDepois());
        return;
      case "imagem": {
        const img = await carregarPng(b.dataUrl);
        const escala = Math.min(b.largura / img.largura, b.altura / img.altura);
        filhos.push(
          new Paragraph({
            alignment: al(b.alinhamento ?? "centro"),
            spacing: { before: tw(4), after: tw(10) },
            children: [
              new ImageRun({
                type: "png",
                data: bytesDe(img.dataUrl),
                transformation: { width: px(img.largura * escala), height: px(img.altura * escala) },
              }),
            ],
          }),
        );
        return;
      }
      case "espaco":
        filhos.push(new Paragraph({ spacing: { before: tw(b.altura), after: 0 }, children: [] }));
        return;
      case "quebraPagina":
        filhos.push(new Paragraph({ children: [new PageBreak()] }));
        return;
      case "assinaturas": {
        const n = b.itens.length || 1;
        const vao = 32;
        const larg = Math.min(220, (PAGINA.util - (n - 1) * vao) / n);
        const lado = (PAGINA.util - n * larg - (n - 1) * vao) / 2;
        const ws = [tw(lado), ...b.itens.flatMap((_, i) => (i > 0 ? [tw(vao), tw(larg)] : [tw(larg)])), tw(lado)];
        const assinatura = (linhas: string[], w: number) =>
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 6, color: COR.texto }, bottom: SEM, left: SEM, right: SEM },
            margins: { top: 60, left: 40, right: 40 },
            children: linhas.map(
              (l, k) =>
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: runs(l, k > 0 ? { tamanho: 9, cor: COR.suave } : {}),
                }),
            ),
          });
        const vazia = (w: number) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: SEM, bottom: SEM, left: SEM, right: SEM }, children: [new Paragraph({ children: [] })] });
        filhos.push(
          new Paragraph({ spacing: { before: tw(36) }, keepNext: true, children: [] }),
          new Table({
            width: { size: ws.reduce((s, w) => s + w, 0), type: WidthType.DXA },
            columnWidths: ws,
            layout: TableLayoutType.FIXED,
            borders: semBordas,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  vazia(ws[0]!),
                  ...b.itens.flatMap((linhas, i) => [...(i > 0 ? [vazia(tw(vao))] : []), assinatura(linhas, tw(larg))]),
                  vazia(ws[ws.length - 1]!),
                ],
              }),
            ],
          }),
          espacoDepois(),
        );
        return;
      }
    }
  }

  // Cabeçalho timbrado, marca d'água (como aviso no topo) e rodapé com número de página.
  const timbre = doc.timbre;
  const logo = timbre?.logo ? await carregarPng(timbre.logo.dataUrl) : null;
  const aviso = doc.marcaDagua
    ? [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: runs(doc.marcaDagua, { negrito: true, cor: COR.suave, tamanho: 8 }) })]
    : [];
  const cabecalho = () => {
    if (!timbre) return new Header({ children: aviso });
    const altura = 34;
    const largura = logo ? Math.min(160, altura * (logo.largura / logo.altura || 3)) : 0;
    const ws = [tw(largura || 1) + 200, UTIL - tw(largura || 1) - 200];
    const linhaBase = { style: BorderStyle.SINGLE, size: 8, color: COR.primaria };
    return new Header({
      children: [
        ...aviso,
        new Table({
          width: { size: UTIL, type: WidthType.DXA },
          columnWidths: ws,
          layout: TableLayoutType.FIXED,
          borders: { ...semBordas, bottom: linhaBase },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: ws[0]!, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.BOTTOM,
                  margins: { bottom: 80, left: 0 },
                  children: [
                    new Paragraph({
                      spacing: { after: 0 },
                      children: logo
                        ? [new ImageRun({ type: "png", data: bytesDe(logo.dataUrl), transformation: { width: px(largura), height: px(altura) } })]
                        : [],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: ws[1]!, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.BOTTOM,
                  margins: { bottom: 80, right: 0 },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: runs(timbre.nome, { negrito: true, cor: COR.primaria, tamanho: 9 }) })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };
  const rodapeTexto = [timbre?.rodape?.trim(), doc.rodape?.trim()].filter(Boolean).join("\n");
  const rodape = () =>
    new Footer({
      children: [
        ...(rodapeTexto ? [new Paragraph({ spacing: { after: 40 }, children: runs(rodapeTexto, { tamanho: 7.5, cor: COR.suave }) })] : []),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: [new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: meio(7.5), color: COR.suave })],
        }),
      ],
    });

  const capaSemTimbre = !!(timbre && doc.semTimbreNaCapa);
  const documento = new Document({
    creator: "Sistema Krieger",
    title: doc.titulo,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: meio(10), color: COR.texto }, paragraph: { spacing: { line: 276 } } },
      },
    },
    numbering: {
      config: [
        {
          reference: "numerada",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 520, hanging: 300 } } } }],
        },
        {
          reference: "marcadores",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: capaSemTimbre,
          page: {
            size: { width: tw(PAGINA.largura), height: tw(PAGINA.altura) },
            margin: { top: tw(timbre ? 92 : PAGINA.margem), bottom: tw(64), left: tw(PAGINA.margem), right: tw(PAGINA.margem), header: tw(28), footer: tw(24) },
          },
        },
        headers: { default: cabecalho(), ...(capaSemTimbre ? { first: new Header({ children: aviso }) } : {}) },
        footers: { default: rodape(), ...(capaSemTimbre ? { first: rodape() } : {}) },
        children: filhos,
      },
    ],
  });
  return Packer.toBlob(documento);
}
