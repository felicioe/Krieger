/** Regras de usuário e senha (funções puras). */

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

export const PERFIL_ROTULO = { admin: "Administrador", user: "Usuário" } as const;
