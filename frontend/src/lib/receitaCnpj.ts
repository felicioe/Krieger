/**
 * Consulta dados cadastrais de um CNPJ (BrasilAPI, que publica os dados abertos da Receita
 * Federal). Só usado para completar um pré-cadastro de condomínio a partir do que já veio no PDF
 * (nome/CNPJ) — enriquecimento opcional, nunca bloqueia o cadastro se falhar.
 */
export interface DadosCnpjReceita {
  razaoSocial: string | null;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

function resposta(d: Record<string, unknown>): DadosCnpjReceita {
  const texto = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  return {
    razaoSocial: typeof d["razao_social"] === "string" ? (d["razao_social"] as string) : null,
    logradouro: texto("logradouro"),
    numero: texto("numero"),
    complemento: texto("complemento"),
    bairro: texto("bairro"),
    municipio: texto("municipio"),
    uf: texto("uf"),
    cep: texto("cep"),
  };
}

/** null quando o CNPJ não existe na base ou a consulta falha (rede, serviço fora do ar etc.). */
export async function consultarCnpjReceita(cnpjSomenteDigitos: string): Promise<DadosCnpjReceita | null> {
  if (!/^\d{14}$/.test(cnpjSomenteDigitos)) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjSomenteDigitos}`);
    if (!r.ok) return null;
    return resposta(await r.json());
  } catch {
    return null;
  }
}

/**
 * Mesma consulta, em lote — usada pela importação da Listagem de Condomínios (até ~190 CNPJs de
 * uma vez). Sequencial, com atraso entre chamadas pra não estourar o rate limit público da
 * BrasilAPI; uma falha isolada não interrompe o lote (mesma filosofia de `consultarCnpjReceita`).
 * Chave do mapa: CNPJ só com dígitos.
 */
export async function consultarCnpjsEmLote(
  cnpjs: string[],
  aoProgresso?: (feito: number, total: number) => void,
  atrasoMs = 350,
): Promise<Map<string, DadosCnpjReceita | null>> {
  const unicos = [...new Set(cnpjs.map((c) => c.replace(/\D/g, "")).filter((c) => c.length === 14))];
  const resultado = new Map<string, DadosCnpjReceita | null>();
  for (let i = 0; i < unicos.length; i++) {
    const cnpj = unicos[i]!;
    resultado.set(cnpj, await consultarCnpjReceita(cnpj));
    aoProgresso?.(i + 1, unicos.length);
    if (i < unicos.length - 1) await new Promise((r) => setTimeout(r, atrasoMs));
  }
  return resultado;
}

/** Endereço completo numa linha só, pronto para o campo "Endereço (edital)". */
export function enderecoDaReceita(d: DadosCnpjReceita): string {
  const partes = [
    [d.logradouro, d.numero].filter(Boolean).join(", ") + (d.complemento ? ` - ${d.complemento}` : ""),
    d.bairro,
    d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.municipio || d.uf,
    d.cep ? `CEP ${d.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : "",
  ];
  return partes.filter((p) => p.trim() !== "").join(" - ");
}
