import type { ItemManifesto } from "./manifesto.js";

export interface CondominioResumo {
  id: string;
  nome: string;
  pastaDocumentos?: string;
}

export interface TrechoParaRegistrar {
  paginaInicial: number;
  paginaFinal: number;
  texto: string;
}

export interface DocumentoParaRegistrar {
  condoId: string;
  tipo: string;
  nomeArquivo: string;
  caminhoRelativo: string;
  hash: string;
  tamanho: number;
  paginas?: number;
  mtimeOrigem?: string;
  status?: "ok" | "erro";
  erro?: string;
  trechos: TrechoParaRegistrar[];
}

function extrairCookie(resposta: Response): string {
  const comGetSetCookie = resposta.headers as Headers & { getSetCookie?: () => string[] };
  const todos =
    typeof comGetSetCookie.getSetCookie === "function"
      ? comGetSetCookie.getSetCookie()
      : [resposta.headers.get("set-cookie")].filter((v): v is string => Boolean(v));
  if (todos.length === 0) throw new Error("Login não retornou cookie de sessão.");
  return todos.map((c) => c.split(";")[0]).join("; ");
}

/** Cliente HTTP do agente para o backend Krieger (auth.php + api.php + api_documentos.php). */
export class ClienteApi {
  private constructor(
    private readonly apiBaseUrl: string,
    private readonly cookie: string
  ) {}

  static async autenticar(apiBaseUrl: string, login: string, senha: string): Promise<ClienteApi> {
    const resposta = await fetch(`${apiBaseUrl}/auth.php?a=entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha }),
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados?.usuario) {
      throw new Error(`Login falhou (HTTP ${resposta.status}): ${dados?.erro ?? "resposta inválida"}`);
    }
    if (dados.usuario.perfil !== "admin") {
      throw new Error("O usuário de serviço do agente precisa ter perfil admin.");
    }
    return new ClienteApi(apiBaseUrl, extrairCookie(resposta));
  }

  private async chamar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
    const resposta = await fetch(`${this.apiBaseUrl}/${caminho}`, {
      ...opcoes,
      headers: {
        "Content-Type": "application/json",
        Cookie: this.cookie,
        ...(opcoes.headers ?? {}),
      },
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(`Falha em ${caminho} (HTTP ${resposta.status}): ${dados?.erro ?? "erro desconhecido"}`);
    }
    return dados as T;
  }

  async listarCondominios(): Promise<CondominioResumo[]> {
    return this.chamar<CondominioResumo[]>("api.php?a=listar&s=condominios");
  }

  async manifesto(condoId: string): Promise<ItemManifesto[]> {
    return this.chamar<ItemManifesto[]>(`api_documentos.php?a=documentos_manifesto&condoId=${encodeURIComponent(condoId)}`);
  }

  async registrar(documento: DocumentoParaRegistrar): Promise<unknown> {
    return this.chamar("api_documentos.php?a=documentos_registrar", {
      method: "POST",
      body: JSON.stringify({ documento }),
    });
  }
}
