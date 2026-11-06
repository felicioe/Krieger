import { HardHat } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <>
      <PageHeader titulo={titulo} descricao={descricao} />
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-card px-6 py-16 text-center">
        <HardHat className="size-10 text-sidebar-indicator" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Em construção</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Esta tela será disponibilizada em uma próxima etapa do Sistema Krieger.
        </p>
      </div>
    </>
  );
}
