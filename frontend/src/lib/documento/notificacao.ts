import {
  dataPorExtenso,
  montarRodapeNotificacao,
  type DadosNotificacao,
} from "@/domain/notificacao";
import type { Condominio, ConfigEscritorio } from "@/domain/types";
import { nomeDeArquivo, salvarArquivo } from "./baixar";

/**
 * Divide um parágrafo em trechos normais e em negrito, destacando automaticamente
 * termos jurídicos/formais ("NOTIFICAR", "NOTIFICADA", "Art. ...", "Regimento Interno",
 * "Convenção Condominial", valores em R$ e percentuais) como nos modelos reais da Krieger.
 */
function destacarTermos(texto: string): { texto: string; negrito: boolean }[] {
  if (!texto) return [{ texto: "", negrito: false }];
  const padrao =
    /(\bNOTIFICAR\b|\bNOTIFICAD[AO]S?\b|\bnotificamos\b|\besta não é a primeira notificação\b|\bRegimento Interno\b|\bConvenção Condominial\b|\bCapítulo\s+[IVXLCDM]+\b|\b(?:Art\.|artigo)\s*\d+[º°]?(?:,\s*(?:inciso|parágrafo|§)\s*[“"']?[a-z0-9º°]+[”"']?)?|\b\d+(?:[.,]\d+)?%\s*\([^)]+\)|\bno valor de R\$\s*[\d.,]+(?:\s*\([^)]+\))?|\bR\$\s*[\d.,]+(?:\s*\([^)]+\))?)/gi;
  const partes: { texto: string; negrito: boolean }[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(padrao)) {
    const idx = m.index ?? 0;
    if (idx > ultimo) {
      partes.push({ texto: texto.slice(ultimo, idx), negrito: false });
    }
    partes.push({ texto: m[0], negrito: true });
    ultimo = idx + m[0].length;
  }
  if (ultimo < texto.length) {
    partes.push({ texto: texto.slice(ultimo), negrito: false });
  }
  return partes.length > 0 ? partes : [{ texto, negrito: false }];
}

/**
 * Gera o arquivo Word (.docx) fiel ao modelo oficial de Notificação / Multa da Krieger.
 */
export async function gerarNotificacaoWordBlob(opcoes: {
  dados: DadosNotificacao;
  condominio: Condominio;
  escritorio?: ConfigEscritorio | null;
}): Promise<Blob> {
  const { dados, condominio, escritorio } = opcoes;
  const d = await import("docx");
  const {
    AlignmentType,
    Document,
    Footer,
    Packer,
    Paragraph,
    TextRun,
    UnderlineType,
  } = d;

  const nomeCondo = (condominio.nomeRelatorio || condominio.nome || "CONDOMÍNIO").toUpperCase();
  const nomeCondoNormal = condominio.nomeRelatorio || condominio.nome || "Condomínio";
  const cidade = dados.cidade.trim() || "Camboriú";
  const dataExt = dataPorExtenso(dados.dataEmissao);
  const destinatario = (dados.condomino.trim() || "[NOME DO CONDÔMINO / PROPRIETÁRIO]").toUpperCase();
  const unidade = dados.unidade.trim() || "[Unidade / Apto]";
  const inquilino = dados.inquilino.trim();
  const tituloDoc = (dados.titulo.trim() || "NOTIFICAÇÃO").toUpperCase();
  const rodape = montarRodapeNotificacao(condominio, escritorio);

  const runsDestacados = (paragrafo: string) =>
    destacarTermos(paragrafo).map(
      (t) =>
        new TextRun({
          text: t.texto,
          bold: t.negrito,
          font: "Times New Roman",
          size: 24, // 12pt
        }),
    );

  const paragrafosCorpo = [dados.paragrafoFato, dados.paragrafoBaseLegal, dados.paragrafoProvidencia]
    .map((p) => p.trim())
    .filter(Boolean);

  const filhos: InstanceType<typeof Paragraph>[] = [
    // Cabeçalho com o nome do condomínio
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: nomeCondo,
          bold: true,
          font: "Times New Roman",
          size: 32, // 16pt
        }),
      ],
    }),
    // Cidade e data por extenso
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: `${cidade}, ${dataExt}.`,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
    // Bloco "Para"
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Para", font: "Times New Roman", size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: destinatario,
          bold: true,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: inquilino ? 120 : 480 },
      children: [
        new TextRun({
          text: `${unidade} – ${nomeCondoNormal}`,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
  ];

  if (inquilino) {
    filhos.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 480 },
        children: [
          new TextRun({
            text: `Inquilino(a): ${inquilino.toUpperCase()}`,
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
    );
  }

  // Título centralizado (NOTIFICAÇÃO / NOTIFICAÇÃO E MULTA / 2ª NOTIFICAÇÃO E MULTA)
  filhos.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 480 },
      children: [
        new TextRun({
          text: tituloDoc,
          bold: true,
          underline: { type: UnderlineType.SINGLE },
          font: "Times New Roman",
          size: 28, // 14pt
        }),
      ],
    }),
  );

  // Parágrafos do corpo com recuo de 1ª linha e espaçamento 1,5
  for (const textoParagrafo of paragrafosCorpo) {
    for (const linha of textoParagrafo.split(/\n+/)) {
      if (!linha.trim()) continue;
      filhos.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 }, // ~1,27 cm
          spacing: { line: 360, after: 240 },
          children: runsDestacados(linha.trim()),
        }),
      );
    }
  }

  // Fechamento
  filhos.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 720 },
      spacing: { line: 360, before: 120, after: 200 },
      children: [
        new TextRun({
          text: "Contamos com sua compreensão e colaboração.",
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { firstLine: 720 },
      spacing: { after: 720 },
      children: [
        new TextRun({
          text: "Cordialmente.",
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
    // Assinatura
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "_______________________________",
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
  );

  if (dados.assinanteCargo === "sindico_condominio") {
    filhos.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: "SÍNDICO",
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
    );
  }

  filhos.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: nomeCondo,
          bold: true,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
  );

  const documento = new Document({
    creator: "Sistema Krieger",
    title: `${tituloDoc} - ${unidade} - ${nomeCondoNormal}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1200, left: 1440, right: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: rodape,
                    font: "Times New Roman",
                    size: 19, // 9.5pt
                  }),
                ],
              }),
            ],
          }),
        },
        children: filhos,
      },
    ],
  });

  return Packer.toBlob(documento);
}

export async function baixarNotificacaoDocx(opcoes: {
  dados: DadosNotificacao;
  condominio: Condominio;
  escritorio?: ConfigEscritorio | null;
}): Promise<void> {
  const blob = await gerarNotificacaoWordBlob(opcoes);
  const nome = nomeDeArquivo(
    opcoes.dados.titulo || "notificacao",
    opcoes.dados.unidade || "unidade",
    opcoes.condominio.nomeRelatorio || opcoes.condominio.nome,
  );
  salvarArquivo(blob, `${nome}.docx`);
}
