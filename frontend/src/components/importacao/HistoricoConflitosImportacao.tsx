import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SecaoRecolhivel } from "@/components/app/SecaoRecolhivel";
import { contagem } from "@/components/app/textos";
import { listaQuery } from "@/lib/queries";
import { formatBRL, formatDataHora } from "@/lib/format";
import { ROTULO_SECAO } from "./ConflitoImportacao";
import type { DecisaoConflitoImportacao } from "@/domain/types";

/**
 * Histórico (fechado por padrão, não mostra nada se vazio) das reimportações que encontraram
 * contas divergentes neste relatório mensal ou prestação de contas — a "conferência futura" das
 * decisões manter/atualizar tomadas item a item. Puramente informativo: não há nada a decidir aqui.
 */
export function HistoricoConflitosImportacao({ registroId }: { registroId: string }) {
  const [aberta, setAberta] = useState(false);
  const { data: decisoes = [] } = useQuery({
    ...listaQuery<DecisaoConflitoImportacao>("decisoes_importacao"),
    select: (d) => d.filter((x) => x.registroId === registroId).sort((a, b) => (a.decididoEm < b.decididoEm ? 1 : -1)),
  });

  if (decisoes.length === 0) return null;

  return (
    <SecaoRecolhivel
      titulo="Histórico de conflitos de importação"
      resumo={contagem(decisoes.length, "reimportação registrada", "reimportações registradas")}
      aberta={aberta}
      aoMudar={setAberta}
    >
      <ul className="grid gap-3 text-sm">
        {decisoes.map((d) => (
          <li key={d.id} className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              <span className="break-words font-medium text-foreground">{d.arquivo}</span> — decidido por{" "}
              {d.decididoPorNome || "—"} em {formatDataHora(d.decididoEm)}
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4">
              {d.itens.map((i, idx) => (
                <li key={idx}>
                  {ROTULO_SECAO[i.secao]}
                  {i.grupo ? ` / ${i.grupo}` : ""} — {i.nome}:{" "}
                  {i.escolha === "manter"
                    ? `manteve ${i.valorAtual !== null ? formatBRL(i.valorAtual) : "(não incluiu)"}`
                    : `atualizou para ${i.valorNovo !== null ? formatBRL(i.valorNovo) : "(removeu)"}`}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </SecaoRecolhivel>
  );
}
