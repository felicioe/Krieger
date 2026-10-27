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
