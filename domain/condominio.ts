import type { Condominio, DocumentoObrigatorio } from "./types";
import { extrairCidadeDoEndereco } from "./notificacao";

/** Mesma normalização de cidade usada nos modelos de edital/ata. */
function normalizarCidade(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mesma cidade: "Balneário Camboriú" = "balneario camboriu" (não casa com só "Camboriú"). */
function ehBalnearioCamboriu(cidade: string): boolean {
  return normalizarCidade(cidade) === "balneario camboriu";
}

/**
 * Itens padrão do checklist "Documentos obrigatórios".
 *
 * Sem `cidade` (cadastro do condomínio), devolve a lista completa — o cadastro é livre e o
 * usuário remove o que não se aplica. Com `cidade`, o "Alvará Estrutural" só entra quando o
 * condomínio é de Balneário Camboriú, onde ele é exigência municipal.
 */
export function documentosObrigatoriosPadrao(
  cidade?: string,
): DocumentoObrigatorio[] {
  const itens = [
    "Extintor",
    "Seguro",
    "Limpeza de Caixa D'Água",
    "Dedetização",
    "Alvará de Bombeiros",
    "Alvará Estrutural",
    // Nome completo pra não ser confundido com a linha financeira "Elevadores" de Consumo de
    // serviços — este item é sobre conformidade (contrato em dia), não sobre valor gasto.
    "Elevador — contrato de manutenção em dia",
  ];
  const filtrados = cidade
    ? filtrarDocumentosPorCidade(
        itens.map((nome) => ({ nome })),
        cidade,
      )
    : itens.map((nome) => ({ nome }));
  return filtrados.map(({ nome }) => ({
    nome,
    status: "pendente",
    informacao: "",
    observacao: "",
    noRelatorio: true,
  }));
}

/** Cidade do condomínio, extraída do endereço do edital (a mesma fonte dos modelos de ata/edital). */
export function cidadeDoCondominio(
  c: Pick<Condominio, "enderecoEdital"> | null | undefined,
): string {
  return c?.enderecoEdital ? extrairCidadeDoEndereco(c.enderecoEdital, "") : "";
}

/**
 * Remove o "Alvará Estrutural" do checklist quando o condomínio não é de Balneário Camboriú.
 * Aplicado no relatório final para condomínios que já têm o item gravado no `consid` antes
 * desta regra existir. Não mexe no cadastro: lá a lista continua livre.
 */
export function filtrarDocumentosPorCidade<
  T extends Pick<DocumentoObrigatorio, "nome">,
>(documentos: T[], cidade: string): T[] {
  if (ehBalnearioCamboriu(cidade)) return documentos;
  return documentos.filter(
    (d) => normalizarCidade(d.nome) !== "alvara estrutural",
  );
}

/** Valores padrão de um condomínio novo. */
export function condominioPadrao(): Omit<Condominio, "id"> {
  return {
    codigo: "",
    nome: "",
    nomeRelatorio: "",
    cnpj: "",
    enderecoEdital: "",
    unidades: null,
    fracaoUnidades: [],
    rateioAtual: null,
    prazoConvocacao: 8,
    quorum: "",
    administradoraTermo: "",
    administracao: [],
    seguradora: "",
    vigenciaSeguro: "",
    seguro: { riscoAbsoluto: null, coberturas: [] },
    historicoApolices: [],
    vigenciaExtintores: "",
    ultGordura: "",
    ultDedetizacao: "",
    ultCaixaDagua: "",
    vistoriaAno: null,
    vistoriaLei: "",
    vistoriaIntervalo: 3,
    indices: [],
    mapeamento: [],
    deducaoRegex: "fundo de caixa p/ obras",
    aguaRubrica: "^[áa]gua",
    energiaRubrica: "energia el[ée]trica",
    elevadorRubrica: "manuten[çc][ãa]o.*elevador",
    elevadorFornecedor: "",
    documentosObrigatorios: documentosObrigatoriosPadrao(),
    arredondamento: "truncar",
    variacaoPadrao: null,
    conhecidas: [],
    somenteAnual: true,
    regras: [],
    variacaoMetodo: "manual",
    variacaoParam: null,
    pastaDocumentos: "",
    areaTotalM2: null,
    alertaCadastro: null,
  };
}

/**
 * Completa um registro vindo da API/backup com os padrões, preservando
 * quaisquer campos extras que já existam.
 */
export function normalizarCondominio(
  raw: Partial<Condominio> & { id?: string },
): Condominio {
  const p = condominioPadrao();
  const historicoExistente = raw.historicoApolices ?? [];
  const historicoInicial =
    historicoExistente.length > 0
      ? historicoExistente
      : raw.seguradora ||
          raw.vigenciaSeguro ||
          raw.seguro?.riscoAbsoluto != null ||
          (raw.seguro?.coberturas?.length ?? 0) > 0
        ? [
            {
              id: "legado-atual",
              seguradora: raw.seguradora ?? "",
              numeroApolice: "",
              vigenciaIni: "",
              vigenciaFim: raw.vigenciaSeguro ?? "",
              riscoAbsoluto: raw.seguro?.riscoAbsoluto ?? null,
              coberturas: raw.seguro?.coberturas ?? [],
              importadaEm: "",
            },
          ]
        : [];
  return {
    ...p,
    ...raw,
    id: raw.id ?? "",
    seguro: {
      riscoAbsoluto: raw.seguro?.riscoAbsoluto ?? null,
      coberturas: raw.seguro?.coberturas ?? [],
    },
    historicoApolices: historicoInicial,
    administracao: raw.administracao ?? [],
    indices: raw.indices ?? [],
    mapeamento: raw.mapeamento ?? [],
    conhecidas: raw.conhecidas ?? [],
    regras: raw.regras ?? [],
    fracaoUnidades: raw.fracaoUnidades ?? [],
    documentosObrigatorios:
      raw.documentosObrigatorios ?? p.documentosObrigatorios,
    vistoriaIntervalo: raw.vistoriaIntervalo ?? p.vistoriaIntervalo,
    somenteAnual: raw.somenteAnual ?? p.somenteAnual,
  } as Condominio;
}

/** Nome usado nos relatórios: nomeRelatorio ou, se vazio, o nome. */
export function nomeParaRelatorio(
  c: Pick<Condominio, "nome" | "nomeRelatorio">,
): string {
  return c.nomeRelatorio?.trim() || c.nome?.trim() || "";
}

export type ResultadoValidacao<T> =
  { ok: true; valor: T } | { ok: false; erro: string };

/** Valida e ajusta o condomínio antes de gravar. */
export function prepararCondominio<
  T extends Condominio | Omit<Condominio, "id">,
>(c: T): ResultadoValidacao<T> {
  const nome = c.nome?.trim() ?? "";
  if (!nome) return { ok: false, erro: "Informe o nome do condomínio." };
  return {
    ok: true,
    valor: { ...c, nome, nomeRelatorio: c.nomeRelatorio?.trim() || nome },
  };
}
