import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rola até o elemento com esse id e leva o foco pra ele (acessível a teclado/leitor de tela). */
export function irPara(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
}
