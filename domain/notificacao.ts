import { formatBRL, parseData } from "../lib/format";
import type { CategoriaPastaDrive, Condominio, ConfigEscritorio, TipoDocumentoConsulta } from "./types";

export type ModalidadeNotificacao = "notificacao" | "notificacao_multa" | "reincidencia_multa";

export const MODALIDADES_NOTIFICACAO: { valor: ModalidadeNotificacao; rotulo: string; tituloPadrao: string }[] = [
  { valor: "notificacao", rotulo: "Apenas Notificação (Advertência)", tituloPadrao: "NOTIFICAÇÃO" },
  { valor: "notificacao_multa", rotulo: "Notificação e Multa", tituloPadrao: "NOTIFICAÇÃO E MULTA" },
  { valor: "reincidencia_multa", rotulo: "2ª Notificação e Multa (Reincidência)", tituloPadrao: "2ª NOTIFICAÇÃO E MULTA" },
];

export const CATEGORIAS_DOCUMENTO_PADRAO: CategoriaPastaDrive[] = [
  {
    valor: "convencao",
    rotulo: "Convenção",
    palavrasChave: ["convencao", "convenção", "instituicao", "instituição"],
  },
  {
    valor: "regimento",
    rotulo: "Regimento Interno",
    palavrasChave: ["regimento", "regulamento", "normas"],
  },
  {
    valor: "ata",
    rotulo: "Atas de Assembleia",
    palavrasChave: ["ata", "atas", "assembleia", "ago", "age"],
  },
  {
    valor: "seguro",
    rotulo: "Seguros e Apólices",
    palavrasChave: ["seguro", "apolice", "apólice", "sinistro"],
  },
  {
    valor: "contrato",
    rotulo: "Contratos e Prestadores",
    palavrasChave: ["contrato", "aditivo", "prestador", "terceiriz"],
  },
  {
    valor: "laudo",
    rotulo: "Laudos e Vistorias",
    palavrasChave: ["laudo", "vistoria", "extintor", "bomba", "spda", "art", "rrt"],
  },
  {
    valor: "notificacao",
    rotulo: "Notificações e Multas",
    palavrasChave: ["notificacao", "notificação", "notif", "multa", "advertencia", "advertência"],
  },
  {
    valor: "outro",
    rotulo: "Outros Documentos",
    palavrasChave: [],
    padraoOutros: true,
  },
];

export const CATEGORIAS_DOCUMENTO: { valor: TipoDocumentoConsulta; rotulo: string }[] =
  CATEGORIAS_DOCUMENTO_PADRAO.map((c) => ({ valor: c.valor, rotulo: c.rotulo }));

export const ROTULO_CATEGORIA_DOCUMENTO: Record<string, string> = {
  convencao: "Convenção",
  regimento: "Regimento Interno",
  ata: "Atas de Assembleia",
  seguro: "Seguros e Apólices",
  contrato: "Contratos e Prestadores",
  laudo: "Laudos e Vistorias",
  notificacao: "Notificações e Multas",
  outro: "Outros Documentos",
};

function semAcentoMinusculo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function gerarSlugCategoria(rotulo: string): TipoDocumentoConsulta {
  const base = semAcentoMinusculo(rotulo)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return (base || "outro") as TipoDocumentoConsulta;
}

/** Retorna a lista ativa de categorias/pastas garantindo que "Outros Documentos" esteja sempre presente. */
export function obterCategoriasDrive(customizadas?: CategoriaPastaDrive[] | null): CategoriaPastaDrive[] {
  if (!Array.isArray(customizadas) || customizadas.length === 0) {
    return CATEGORIAS_DOCUMENTO_PADRAO;
  }
  const limpas = customizadas.filter((c) => c && typeof c.rotulo === "string" && c.rotulo.trim() !== "");
  if (limpas.length === 0) return CATEGORIAS_DOCUMENTO_PADRAO;
  const temOutro = limpas.some((c) => c.valor === "outro" || c.padraoOutros);
  if (!temOutro) {
    return [
      ...limpas,
      { valor: "outro", rotulo: "Outros Documentos", palavrasChave: [], padraoOutros: true },
    ];
  }
  return limpas;
}

export function pastaPadraoOutros(categorias?: CategoriaPastaDrive[] | null): CategoriaPastaDrive {
  const lista = obterCategoriasDrive(categorias);
  return (
    lista.find((c) => c.padraoOutros || c.valor === "outro") ?? {
      valor: "outro",
      rotulo: "Outros Documentos",
      palavrasChave: [],
      padraoOutros: true,
    }
  );
}

export function rotuloCategoriaDocumento(
  tipo: TipoDocumentoConsulta | string,
  categorias?: CategoriaPastaDrive[] | null,
): string {
  const lista = obterCategoriasDrive(categorias);
  const achada = lista.find((c) => c.valor === tipo);
  if (achada) return achada.rotulo;
  return ROTULO_CATEGORIA_DOCUMENTO[tipo] ?? (tipo || "Outros Documentos");
}

/** Classifica automaticamente a categoria sugerida pelo nome do arquivo, caindo em "outro" se não reconhecer. */
export function classificarDocumentoPorNome(
  nomeArquivo: string,
  categorias?: CategoriaPastaDrive[] | null,
): TipoDocumentoConsulta {
  const nomeSemExt = nomeArquivo.replace(/\.[^.]+$/, "");
  const n = semAcentoMinusculo(nomeSemExt);
  const lista = obterCategoriasDrive(categorias);

  // 1. Checa palavras-chave configuradas nas categorias
  for (const cat of lista) {
    if (cat.padraoOutros || cat.valor === "outro") continue;
    for (const kw of cat.palavrasChave ?? []) {
      const k = semAcentoMinusculo(kw);
      if (!k) continue;
      if (k.length <= 3) {
        const regCurta = new RegExp(`(?:^|[^a-z0-9])${k}(?:$|[^a-z0-9])`, "i");
        if (regCurta.test(n)) return cat.valor;
      } else if (n.includes(k)) {
        return cat.valor;
      }
    }
  }

  // 2. Regras nativas de segurança caso as palavras-chave padrão não tenham batido
  if (/convenc/.test(n)) return "convencao";
  if (/regiment|regulament/.test(n)) return "regimento";
  if (/\batas?\b|assemble/.test(n)) return "ata";
  if (/apolice|segur/.test(n)) return "seguro";
  if (/contrat/.test(n)) return "contrato";
  if (/laudo|vistori|extintor|bomba/.test(n)) return "laudo";
  if (/notificac|notif_|multa|advertenc/.test(n)) return "notificacao";
  return "outro";
}

export interface AlocacaoPastaDrive {
  /** Pasta ou caminho de pasta/subpasta no Drive (ex.: "Atas/2025", "Convenção", "Outros Documentos"). */
  pasta: string;
  /** Categoria associada ao documento. */
  tipo: TipoDocumentoConsulta;
  /** Caminho relativo completo salvo no documento (ex.: "Atas/2025/Ata_AGO.pdf"). */
  caminhoRelativo: string;
  /** Regra que determinou a pasta de destino. */
  regra: "subpasta_origem" | "auto_nome" | "outros_padrao" | "manual";
}

/**
 * Resolve em qual pasta/subpasta e categoria o documento deve entrar ao subir:
 * 1. Se veio de importação de pasta e possui pasta/subpasta interna (`caminhoRelativoOrigem` com subdiretórios),
 *    mantém e cadastra automaticamente as pastas e subpastas de origem.
 * 2. Se foi enviado fora de pasta (avulso ou na raiz da pasta selecionada):
 *    - Se o usuário escolheu manualmente uma pasta específica diferente de "automatico", usa essa pasta;
 *    - Caso contrário, tenta identificar automaticamente pelo nome do arquivo usando as categorias cadastradas;
 *    - Se não identificar automaticamente, aloca na pasta "Outros Documentos".
 */
export function resolverAlocacaoDocumentoDrive(opcoes: {
  nomeArquivo: string;
  caminhoRelativoOrigem?: string | null;
  pastaManual?: string | null;
  categorias?: CategoriaPastaDrive[] | null;
}): AlocacaoPastaDrive {
  const lista = obterCategoriasDrive(opcoes.categorias);
  const outros = pastaPadraoOutros(lista);
  const nomeLimpo = opcoes.nomeArquivo.split(/[\\/]/).pop() || opcoes.nomeArquivo;

  // Verifica se o arquivo veio de uma estrutura de pastas/subpastas (webkitRelativePath)
  const bruto = (opcoes.caminhoRelativoOrigem ?? "").replace(/\\/g, "/").trim();
  const partes = bruto
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  // Quando o navegador envia via webkitdirectory, partes[0] é a pasta-raiz escolhida (ex.: "Santa Cecilia"),
  // partes[1..n-2] são as pastas/subpastas internas (ex.: ["Atas", "2025"]) e partes[n-1] é o arquivo.
  if (partes.length >= 3) {
    const subpastas = partes.slice(1, -1).join("/");
    const primeiraSubpasta = partes[1]!;
    // Tenta vincular a categoria pela primeira pasta ou pelo nome do arquivo
    const catPorPasta = classificarDocumentoPorNome(primeiraSubpasta, lista);
    const catPorNome = classificarDocumentoPorNome(nomeLimpo, lista);
    const tipo = catPorPasta !== "outro" ? catPorPasta : catPorNome;
    return {
      pasta: subpastas,
      tipo,
      caminhoRelativo: `${subpastas}/${nomeLimpo}`,
      regra: "subpasta_origem",
    };
  }

  // Se o usuário definiu uma pasta manualmente (que não seja "automatico")
  const manual = (opcoes.pastaManual ?? "").trim();
  if (manual && manual !== "automatico") {
    const catCorrespondente = lista.find(
      (c) => semAcentoMinusculo(c.rotulo) === semAcentoMinusculo(manual) || c.valor === manual,
    );
    const pastaNome = catCorrespondente ? catCorrespondente.rotulo : manual.replace(/^\/+|\/+$/g, "");
    const tipo = catCorrespondente
      ? catCorrespondente.valor
      : classificarDocumentoPorNome(`${pastaNome} ${nomeLimpo}`, lista);
    return {
      pasta: pastaNome,
      tipo,
      caminhoRelativo: `${pastaNome}/${nomeLimpo}`,
      regra: "manual",
    };
  }

  // Arquivo avulso (fora de pasta): tenta identificar automaticamente pelo nome
  const tipoAuto = classificarDocumentoPorNome(nomeLimpo, lista);
  if (tipoAuto !== "outro") {
    const cat = lista.find((c) => c.valor === tipoAuto);
    const nomePasta = cat ? cat.rotulo : rotuloCategoriaDocumento(tipoAuto, lista);
    return {
      pasta: nomePasta,
      tipo: tipoAuto,
      caminhoRelativo: `${nomePasta}/${nomeLimpo}`,
      regra: "auto_nome",
    };
  }

  // Não identificado automaticamente e fora de pasta -> vai para "Outros Documentos"
  return {
    pasta: outros.rotulo,
    tipo: "outro",
    caminhoRelativo: `${outros.rotulo}/${nomeLimpo}`,
    regra: "outros_padrao",
  };
}

/** Extrai o caminho da pasta/subpasta de um documento já salvo no Drive. */
export function extrairPastaDoDocumento(
  doc: { caminhoRelativo?: string | null; tipo?: TipoDocumentoConsulta | string | null; nomeArquivo?: string | null },
  categorias?: CategoriaPastaDrive[] | null,
): string {
  const lista = obterCategoriasDrive(categorias);
  const outros = pastaPadraoOutros(lista);
  const cam = (doc.caminhoRelativo ?? "").replace(/\\/g, "/").trim();
  const partes = cam
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length >= 2) {
    return partes.slice(0, -1).join("/");
  }
  const tipo = doc.tipo ?? "outro";
  if (tipo && tipo !== "outro") {
    return rotuloCategoriaDocumento(tipo, lista);
  }
  return outros.rotulo;
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
