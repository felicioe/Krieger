/** Estado da sessão do usuário logado (fora do React, com hook para leitura). */
import { useSyncExternalStore } from "react";
import type { Usuario } from "@/domain/types";
import { api } from "./api";

type Estado = { usuario: Usuario | null; carregado: boolean };

let estado: Estado = { usuario: null, carregado: false };
const ouvintes = new Set<() => void>();
let carregando: Promise<Usuario | null> | null = null;

function definir(novo: Partial<Estado>) {
  estado = { ...estado, ...novo };
  ouvintes.forEach((f) => f());
}

export function definirUsuario(u: Usuario | null) {
  definir({ usuario: u, carregado: true });
}

/** Limpa a sessão local (ex.: após 401). */
export function limparSessao() {
  carregando = null;
  definir({ usuario: null, carregado: true });
}

/** Carrega o usuário uma única vez (ou devolve o que já está em memória). */
export async function garantirSessao(): Promise<Usuario | null> {
  if (estado.carregado) return estado.usuario;
  if (!carregando) {
    carregando = api.auth.eu().then(
      (u) => {
        definirUsuario(u);
        return u;
      },
      (e) => {
        carregando = null;
        throw e;
      },
    );
  }
  return carregando;
}

export async function recarregarSessao(): Promise<Usuario | null> {
  estado = { ...estado, carregado: false };
  carregando = null;
  return garantirSessao();
}

export async function sair() {
  try {
    await api.auth.sair();
  } finally {
    limparSessao();
  }
}

export function useUsuario(): Usuario | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado.usuario,
    () => null,
  );
}

export function temPermissao(usuario: Usuario | null, chave: string): boolean {
  return usuario?.perfil === 'admin' || usuario?.permissoes?.includes('*') === true || usuario?.permissoes?.includes(chave) === true;
}
