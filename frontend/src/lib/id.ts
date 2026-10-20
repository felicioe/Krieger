/** Gera um id curto e único (até 64 caracteres). */
export function novoId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 64);
}
