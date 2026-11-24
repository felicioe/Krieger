import { Link } from "@/components/app/LinkPermitido";
import { Button } from "@/components/ui/button";
import { CircleHelp } from "lucide-react";

/**
 * Botão de ajuda contextual (?).
 * Leva à Central de Ajuda com a seção da tela atual pré-selecionada.
 * Usa `variant="ghost" size="icon"` para não competir com as ações principais.
 */
export function BotaoAjuda({ secao }: { secao: string }) {
  return (
    <Button variant="ghost" size="icon" asChild title="Ajuda sobre esta tela">
      <Link to="/ajuda" search={{ secao }} aria-label={`Ajuda sobre ${secao.replace(/-/g, " ")}`}>
        <CircleHelp />
      </Link>
    </Button>
  );
}
