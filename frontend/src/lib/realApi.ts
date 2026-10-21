import type { Backup, BackupRegistro, Store, Usuario, UsuarioAdmin } from "@/domain/types";
import { ApiError, type ApiAdapter } from "./apiTypes";

/**
 * Adaptador da API PHP existente (api.php / auth.php no mesmo diretório do site).
 * As URLs são relativas ao documento: com rotas em hash, o documento é sempre
 * o index.html, então funciona inclusive em subpastas.
 */

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      credentials: "same-origin",
      ...(init?.body ? { headers: { "Content-Type": "application/json" } } : {}),
      ...init,
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua conexão.", 0);
  }
  const texto = await resp.text();
  let corpo: unknown = null;
  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      if (!resp.ok) throw new ApiError(`Erro ${resp.status} no servidor.`, resp.status);
      throw new ApiError("Resposta inválida do servidor.", resp.status);
    }
  }
  const erro = (corpo as { erro?: string } | null)?.erro;
  if (!resp.ok || erro) {
    throw new ApiError(erro || `Erro ${resp.status} no servidor.`, resp.status || 500);
  }
  return corpo as T;
}

const post = <T>(url: string, body: unknown) => req<T>(url, { method: "POST", body: JSON.stringify(body) });

/** A API pode devolver o dado direto ou embrulhado; aceitamos ambos. */
function lista<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const o = r as Record<string, unknown> | null;
  for (const k of ["itens", "lista", "dados", "registros", "usuarios"]) {
    if (o && Array.isArray(o[k])) return o[k] as T[];
  }
  return [];
}

function objeto<T>(r: unknown): T | null {
  if (r === null || r === undefined) return null;
  const o = r as Record<string, unknown>;
  const interno = o["o"];
  if (interno && typeof interno === "object") return interno as T;
  return r as T;
}

const enc = encodeURIComponent;

export const realApi: ApiAdapter = {
  async listar<T>(store: Store) {
    return lista<T>(await req(`api.php?a=listar&s=${enc(store)}`));
  },
  async obter<T>(store: Store, id: string) {
    try {
      return objeto<T>(await req(`api.php?a=obter&s=${enc(store)}&id=${enc(id)}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  async salvar<T extends { id?: string }>(store: Store, o: T) {
    const r = await post(`api.php?a=salvar&s=${enc(store)}`, { o });
    return (objeto<T & { id: string }>(r) ?? (o as T & { id: string })) as T & { id: string };
  },
  async excluir(store: Store, id: string) {
    await post(`api.php?a=excluir&s=${enc(store)}&id=${enc(id)}`, {});
  },
  async exportar() {
    return (await req<Backup>("api.php?a=exportar")) ?? {};
  },
  async importar(dados: Backup, substituir: boolean) {
    return post("api.php?a=importar", { dados, substituir });
  },
  backup: {
    async criar() {
      return post<BackupRegistro>("api.php?a=backup_criar", {});
    },
    async listar() {
      return lista<BackupRegistro>(await req("api.php?a=backup_listar"));
    },
    async baixar(id: string) {
      return (await req<Backup>(`api.php?a=backup_baixar&id=${enc(id)}`)) ?? ({} as Backup);
    },
    async restaurar(id: string, substituir: boolean) {
      return post(`api.php?a=backup_restaurar&id=${enc(id)}`, { substituir });
    },
    async excluir(id: string) {
      await post(`api.php?a=backup_excluir&id=${enc(id)}`, {});
    },
  },
  auth: {
    async eu() {
      try {
        const r = await req<{ usuario?: Usuario }>("auth.php?a=eu");
        return r?.usuario ?? null;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    async entrar(login: string, senha: string) {
      const r = await post<{ usuario?: Usuario }>("auth.php", { a: "entrar", login, senha });
      if (r?.usuario) return r.usuario;
      const u = await realApi.auth.eu();
      if (!u) throw new ApiError("Não foi possível iniciar a sessão.", 401);
      return u;
    },
    async sair() {
      await post("auth.php", { a: "sair" });
    },
    async minhaSenha(atual: string, nova: string) {
      await post("auth.php", { a: "minha_senha", atual, nova });
    },
    async usuarios() {
      return lista<UsuarioAdmin>(await req("auth.php?a=usuarios"));
    },
    async usuarioSalvar(u) {
      return post("auth.php", { a: "usuario_salvar", ...u });
    },
    async usuarioExcluir(id: string) {
      await post("auth.php", { a: "usuario_excluir", id });
    },
  },
};
