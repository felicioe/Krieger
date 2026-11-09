/** Regras de usuário e senha (funções puras). */
import type { Perfil } from "./types";

export const LOGIN_REGEX = /^[a-z0-9._-]{3,40}$/;
export const SENHA_MINIMA = 8;

export function validarLogin(login: string): string | null {
  if (!LOGIN_REGEX.test(login)) {
    return "O login deve ter de 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.";
  }
  return null;
}

export function validarNovaSenha(nova: string, confirmacao?: string): string | null {
  if (nova.length < SENHA_MINIMA) return `A nova senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (confirmacao !== undefined && nova !== confirmacao) return "A confirmação não confere com a nova senha.";
  return null;
}

/** Rótulo de cada perfil na interface. O valor gravado de `admin` continua "admin" (ver `Perfil`). */
export const PERFIL_ROTULO: Record<Perfil, string> = { admin: "SuperADM", adm: "ADM", user: "Usuário" };

/** Perfis que o SuperADM pode atribuir ao criar ou editar usuários. */
export const PERFIS_ATRIBUIVEIS: Perfil[] = ["adm", "user", "admin"];

/** Só o SuperADM administra usuários, perfis e a matriz de permissões. */
export const perfilAdministra = (perfil: Perfil | null | undefined): boolean => perfil === "admin";
