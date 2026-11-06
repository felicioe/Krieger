import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export interface ConfigAgente {
  apiBaseUrl: string;
  login: string;
  senha: string;
}

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * Lê config.local.json (fora do Git, copiado uma vez de config.example.json) com a URL da
 * API e as credenciais do usuário de serviço — nunca commitado, mesmo padrão de
 * krieger-config.php no backend.
 */
export async function carregarConfig(): Promise<ConfigAgente> {
  const caminho = join(AQUI, "..", "config.local.json");
  let bruto: string;
  try {
    bruto = await readFile(caminho, "utf-8");
  } catch {
    throw new Error(
      "config.local.json não encontrado. Copie config.example.json para config.local.json e preencha apiBaseUrl/login/senha."
    );
  }
  const dados = JSON.parse(bruto);
  if (!dados.apiBaseUrl || !dados.login || !dados.senha) {
    throw new Error("config.local.json incompleto: informe apiBaseUrl, login e senha.");
  }
  return dados;
}
