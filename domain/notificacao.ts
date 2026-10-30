import { formatBRL, parseData } from "../lib/format";
import type { Condominio, ConfigEscritorio, TipoDocumentoConsulta } from "./types";

export type ModalidadeNotificacao = "notificacao" | "notificacao_multa" | "reincidencia_multa";

export const MODALIDADES_NOTIFICACAO: { valor: ModalidadeNotificacao; rotulo: string; tituloPadrao: string }[] = [
  { valor: "notificacao", rotulo: "Apenas Notificação (Advertência)", tituloPadrao: "NOTIFICAÇÃO" },
  { valor: "notificacao_multa", rotulo: "Notificação e Multa", tituloPadrao: "NOTIFICAÇÃO E MULTA" },
  { valor: "reincidencia_multa", rotulo: "2ª Notificação e Multa (Reincidência)", tituloPadrao: "2ª NOTIFICAÇÃO E MULTA" },
];

export const CATEGORIAS_DOCUMENTO: { valor: TipoDocumentoConsulta; rotulo: string }[] = [
  { valor: "convencao", rotulo: "Convenção" },
  { valor: "regimento", rotulo: "Regimento Interno" },
  { valor: "ata", rotulo: "Ata de Assembleia" },
  { valor: "seguro", rotulo: "Seguro / Apólice" },
  { valor: "contrato", rotulo: "Contrato" },
  { valor: "laudo", rotulo: "Laudo / Vistoria" },
  { valor: "notificacao", rotulo: "Notificação / Multa" },
  { valor: "outro", rotulo: "Outros Documentos" },
];

export const ROTULO_CATEGORIA_DOCUMENTO: Record<TipoDocumentoConsulta, string> = {
  convencao: "Convenção",
  regimento: "Regimento Interno",
  ata: "Ata",
  seguro: "Seguro",
  contrato: "Contrato",
  laudo: "Laudo / Vistoria",
  notificacao: "Notificação / Multa",
  outro: "Outros",
};

export function rotuloCategoriaDocumento(tipo: TipoDocumentoConsulta): string {
  return ROTULO_CATEGORIA_DOCUMENTO[tipo] ?? "Outros";
}

/** Classifica automaticamente a categoria sugerida pelo nome do arquivo, caindo em "outro" se não reconhecer. */
export function classificarDocumentoPorNome(nomeArquivo: string): TipoDocumentoConsulta {
  const n = nomeArquivo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/convenc/.test(n)) return "convencao";
  if (/regiment|regulament/.test(n)) return "regimento";
  if (/\batas?\b|assemble/.test(n)) return "ata";
  if (/apolice|segur/.test(n)) return "seguro";
  if (/contrat/.test(n)) return "contrato";
  if (/laudo|vistori|extintor|bomba/.test(n)) return "laudo";
  if (/notificac|multa|advertenc/.test(n)) return "notificacao";
  return "outro";
}

export interface DadosNotificacao {
  modalidade: ModalidadeNotificacao;
  titulo: string;
  cidade: string;
  /** dd/mm/aaaa */
  dataEmissao: string;
  condomino: string;
  unidade: string;
  inquilino: string;
  paragrafoFato: string;
  paragrafoBaseLegal: string;
  paragrafoProvidencia: string;
  enquadramentoMulta: string;
  valorMulta: number | null;
  assinanteCargo: "sindico_condominio" | "apenas_condominio";
}

const MESES_EXTENSO = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Converte "08/07/2026" em "08 de julho de 2026". */
export function dataPorExtenso(dataBR: string): string {
  const d = parseData(dataBR);
  if (!d) return dataBR.trim() || "___ de __________ de 2026";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = MESES_EXTENSO[d.getMonth()] ?? "";
  const ano = d.getFullYear();
  return `${dia} de ${mes} de ${ano}`;
}

/** Extrai a cidade de um endereço no padrão "RUA ..., BAIRRO - CAMBORIÚ/SC - CEP ...". */
export function extrairCidadeDoEndereco(endereco: string, padrao = "Camboriú"): string {
  if (!endereco || !endereco.trim()) return padrao;
  const m = endereco.match(/(?:[-–,]\s*)([A-Za-zÀ-ÿ\s]+?)\s*\/\s*[A-Z]{2}\b/);
  if (m && m[1]) {
    const bruto = m[1].trim();
    return bruto
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (l) => l.toUpperCase())
      .replace(/\b(De|Da|Do|Das|Dos)\b/g, (p) => p.toLowerCase());
  }
  return padrao;
}

const UNIDADES_EXT = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS_EXT = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS_EXT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function inteiroAte999PorExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS_EXT[c]!);
  if (resto >= 10 && resto <= 19) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]!);
  } else {
    if (d >= 2) partes.push(DEZENAS_EXT[d]!);
    if (u > 0) partes.push(UNIDADES_EXT[u]!);
  }
  return partes.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (milhares === 1) {
    partes.push("mil");
  } else if (milhares > 1) {
    partes.push(`${inteiroAte999PorExtenso(milhares)} mil`);
  }
  if (resto > 0) {
    const conector = milhares > 0 && (resto < 100 || resto % 100 === 0) ? " e " : milhares > 0 ? " " : "";
    partes.push(conector + inteiroAte999PorExtenso(resto));
  }
  return partes.join("");
}

/**
 * Converte um valor monetário (ex.: 486.30) para extenso em reais
 * ("quatrocentos e oitenta e seis reais e trinta centavos").
 */
export function valorPorExtensoBRL(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor) || valor <= 0) return "";
  const totalCentavos = Math.round(valor * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;
  const partes: string[] = [];
  if (reais > 0) {
    partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroAte999PorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return partes.join(" e ");
}

/** Monta o 1º parágrafo (relato do fato) sugerido conforme a modalidade. */
export function montarParagrafoFatoPadrao(modalidade: ModalidadeNotificacao, descricaoCurta = ""): string {
  const desc = descricaoCurta.trim() || "[descrever a ocorrência, data e horário]";
  if (modalidade === "reincidencia_multa") {
    return `A presente tem por finalidade NOTIFICAR V. Sa. pela segunda vez, acerca de ${desc}. Ressaltamos que esta não é a primeira notificação encaminhada sobre o referido assunto, tendo em vista a reincidência da conduta.`;
  }
  if (modalidade === "notificacao_multa") {
    return `A presente tem por finalidade NOTIFICAR V. Sa. acerca de ${desc}.`;
  }
  return `Por meio desta, notificamos V. Sa. acerca de ${desc}.`;
}

/** Monta o 3º parágrafo (providência/multa) no padrão exato dos documentos da Krieger. */
export function montarParagrafoProvidencia(opcoes: {
  modalidade: ModalidadeNotificacao;
  enquadramentoMulta: string;
  valorMulta: number | null;
}): string {
  const { modalidade, enquadramentoMulta, valorMulta } = opcoes;
  if (modalidade === "notificacao") {
    return "Diante do exposto, fica V. Sa. NOTIFICADA para que situações dessa natureza não voltem a ocorrer. Informamos que, em caso de reincidência, poderá ser aplicada a multa prevista no Regimento Interno e na Convenção Condominial.";
  }
  const enq = enquadramentoMulta.trim() || "30% (trinta por cento) do valor do salário mínimo nacional, nos termos da Convenção Condominial";
  const valorFormatado = valorMulta && valorMulta > 0 ? formatBRL(valorMulta) : "R$ [valor]";
  const extenso = valorPorExtensoBRL(valorMulta);
  const trechoValor = extenso ? `${valorFormatado} (${extenso})` : valorFormatado;

  if (modalidade === "reincidencia_multa") {
    return `Diante do exposto, considerando a reincidência da infração, não resta outra alternativa senão aplicar a multa correspondente a ${enq}, no valor de ${trechoValor}. A referida multa será lançada no boleto da taxa condominial com vencimento subsequente à data desta notificação.`;
  }
  return `Diante do exposto, V. Sa. fica formalmente NOTIFICADA de que será aplicada multa no valor correspondente a ${enq}, totalizando o montante de ${trechoValor}, a qual será lançada no boleto de sua taxa condominial.`;
}

/** Monta o rodapé completo do documento (endereço do condomínio + telefone do escritório). */
export function montarRodapeNotificacao(condominio?: Condominio | null, escritorio?: ConfigEscritorio | null): string {
  const end = condominio?.enderecoEdital?.trim() || "";
  const rodapeEsc = escritorio?.rodape?.trim() || "";
  const telMatch = rodapeEsc.match(/(?:fone|telefone|tel\.?|whatsapp)[:\s]*(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})/i) || rodapeEsc.match(/(\(\d{2}\)\s*\d{4,5}[-\s]?\d{4})/);
  const telefone = telMatch?.[1] || "(47) 3367-4955";
  if (end && !/telefone/i.test(end)) {
    return `${end} – Telefone: ${telefone}`;
  }
  return end || rodapeEsc || `Telefone: ${telefone}`;
}
