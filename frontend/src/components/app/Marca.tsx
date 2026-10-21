import logoCor from "@/assets/logo-krieger.png";
import logoClaro from "@/assets/logo-krieger-claro.png";
import logoNomeClaro from "@/assets/logo-krieger-nome-claro.png";
import { cn } from "@/lib/utils";

/**
 * Logo oficial "Krieger — Contabilidade Condominial".
 * - `fundo="escuro"` (padrão): versão clara, para o menu azul-marinho.
 * - `fundo="claro"`: versão colorida original, para fundos claros.
 * - `compacta`: só o nome "Krieger" (sem subtítulo), para a barra do celular.
 */
export function Marca({
  className,
  compacta,
  fundo = "escuro",
}: {
  className?: string;
  compacta?: boolean;
  fundo?: "escuro" | "claro";
}) {
  const src = compacta ? logoNomeClaro : fundo === "claro" ? logoCor : logoClaro;
  return (
    <img
      src={src}
      alt="Krieger — Contabilidade Condominial"
      draggable={false}
      className={cn("block h-auto select-none", compacta ? "h-8 w-auto" : "w-full", className)}
    />
  );
}
