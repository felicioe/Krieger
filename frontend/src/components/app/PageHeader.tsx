import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  descricao,
  acoes,
  voltar,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  voltar?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {voltar && <div className="mb-2">{voltar}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
