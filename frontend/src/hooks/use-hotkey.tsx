import { useEffect } from "react";

/**
 * Hook para registrar atalhos de teclado globais.
 * @param keys - Array de teclas (ex: ["Control", "/"] para Ctrl+/)
 * @param callback - Função a executar quando o atalho for pressionado
 * @param target - Elemento alvo (default: window)
 */
export function useHotkey(
  keys: string[],
  callback: (event: KeyboardEvent) => void,
  target: EventTarget = window,
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ignora se estiver em input/textarea/select editável
      const targetEl = event.target as HTMLElement;
      const isEditing =
        targetEl.isContentEditable ||
        targetEl.tagName === "INPUT" ||
        targetEl.tagName === "TEXTAREA" ||
        targetEl.tagName === "SELECT";

      if (isEditing && !(event.ctrlKey || event.metaKey)) return;

      const match = keys.every((k) => {
        const normalized = k.toLowerCase();
        if (normalized === "control") return event.ctrlKey;
        if (normalized === "meta") return event.metaKey;
        if (normalized === "shift") return event.shiftKey;
        if (normalized === "alt") return event.altKey;
        return event.key.toLowerCase() === normalized;
      });

      if (match) {
        event.preventDefault();
        callback(event);
      }
    };

    target.addEventListener("keydown", handler as EventListener);
    return () => target.removeEventListener("keydown", handler as EventListener);
  }, [keys, callback, target]);
}
