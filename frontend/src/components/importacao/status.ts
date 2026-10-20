import type { Importacao } from "@/domain/types";

export const ROTULO_STATUS: Record<Importacao["status"], { rotulo: string; variante: "warning" | "success" | "outline" }> = {
  pendente: { rotulo: "Pendente", variante: "warning" },
  confirmado: { rotulo: "Confirmada", variante: "success" },
  descartado: { rotulo: "Descartada", variante: "outline" },
};
