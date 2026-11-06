import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CondominioParecido } from "@/domain/importacao";
import type { Condominio } from "@/domain/types";

const identificacao = (c: Condominio) =>
  [c.codigo && `código ${c.codigo}`, c.cnpj && `CNPJ ${c.cnpj}`].filter(Boolean).join(" · ");

/**
 * Sugestões de cadastro existente com nome parecido ao do PDF (lista já ordenada pelo domínio em
 * `condominiosParecidos`). O primeiro aparece em destaque; os demais numa lista secundária.
 * Escolher um só aponta o fluxo para esse cadastro — nada no cadastro é alterado.
 */
export function SugestaoParecidos({
  nomeLido,
  parecidos,
  aoEscolher,
  desabilitado,
}: {
  nomeLido: string | null;
  parecidos: CondominioParecido<Condominio>[];
  aoEscolher: (c: Condominio) => void;
  desabilitado?: boolean;
}) {
  const [primeiro, ...outros] = parecidos;
  if (!primeiro) return null;
  const p = primeiro.condominio;
  return (
    <section aria-labelledby="titulo-parecidos" className="grid gap-3 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Building2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <h3 id="titulo-parecidos" className="font-medium text-foreground">
            Isso pode ser <strong>{p.nome}</strong>, já cadastrado?
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {nomeLido ? <>O nome no PDF, “{nomeLido}”, parece com este cadastro. </> : null}
            Se for o mesmo, o relatório é gravado nele, sem mudar o cadastro.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border bg-card px-3 py-2">
        <div className="min-w-0">
          <div className="break-words font-medium">{p.nome}</div>
          {identificacao(p) && <div className="text-xs text-muted-foreground">{identificacao(p)}</div>}
        </div>
        <Button size="sm" onClick={() => aoEscolher(p)} disabled={desabilitado} aria-label={`Usar o cadastro ${p.nome}`}>
          Usar este cadastro
        </Button>
      </div>
      {outros.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Outros parecidos</p>
          <ul className="divide-y rounded-md border bg-card">
            {outros.map(({ condominio: c }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5">
                <span className="min-w-0 break-words">
                  {c.nome}
                  {identificacao(c) && <span className="text-xs text-muted-foreground"> · {identificacao(c)}</span>}
                </span>
                <Button size="sm" variant="outline" onClick={() => aoEscolher(c)} disabled={desabilitado} aria-label={`Usar o cadastro ${c.nome}`}>
                  Usar este cadastro
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
