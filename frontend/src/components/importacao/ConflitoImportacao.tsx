import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { contagem } from "@/components/app/textos";
import { api, mensagemErro } from "@/lib/api";
import { novoId } from "@/lib/id";
import { formatBRL } from "@/lib/format";
import { chaves } from "@/lib/queries";
import { aplicarDecisoesImportacao, compararDemonstrativos } from "@/domain/importacao";
import type {
  Demonstrativo,
  DecisaoConflitoImportacao,
  ItemDivergenteImportacao,
  Usuario,
} from "@/domain/types";

type EscolhaItem = ItemDivergenteImportacao & { escolha: "manter" | "atualizar" };

export const ROTULO_SECAO: Record<ItemDivergenteImportacao["secao"], string> = {
  saldoAnterior: "Saldo anterior",
  receitas: "Receitas",
  despesas: "Despesas",
  saldoAtual: "Saldo atual",
};

function chaveItem(i: ItemDivergenteImportacao): string {
  return `${i.secao}::${i.grupo ?? ""}::${i.nome}::${i.ocorrencia}`;
}

/** O que descrever e gravar quando o usuário resolve os itens divergentes de uma reimportação. */
type ContextoConflito = {
  condoId: string;
  condoNome: string;
  destino: DecisaoConflitoImportacao["destino"];
  registroId: string;
  /** "mm/aaaa" (mensal) ou o ano, como texto (exercício). */
  competencia: string;
  arquivo: string;
  atual: Demonstrativo | null;
  novo: Demonstrativo;
};

/** A decisão já tomada, pronta pra gravar — falta só o `id` e quem/quando (ver `persistirDecisaoConflito`). */
export type DecisaoConflitoPendente = Omit<
  DecisaoConflitoImportacao,
  "id" | "decididoPor" | "decididoPorNome" | "decididoEm"
>;

type Pendente = {
  itens: ItemDivergenteImportacao[];
  contexto: ContextoConflito;
  resolve: (r: { demonstrativo: Demonstrativo; decisao: DecisaoConflitoPendente | null }) => void;
  reject: () => void;
};

/**
 * Compara conta a conta e, se houver divergência, abre o diálogo de conflito e só resolve a
 * promessa quando o usuário decidir todos os itens (nenhuma escolha pré-marcada) — ou rejeita se
 * ele cancelar. Sem divergência (ou sem nada gravado antes), resolve direto com `novo`, sem diálogo
 * e sem decisão a registrar.
 *
 * Não grava nada sozinho: devolve a decisão pronta (`decisao`) pra quem chamou gravar só depois que
 * o dado que ela descreve realmente for salvo (ver `persistirDecisaoConflito`) — gravar aqui, antes
 * disso, registraria uma decisão como aplicada mesmo quando a importação é cancelada ou descartada
 * antes do Salvar.
 */
export function useConflitoImportacao() {
  const [pendente, setPendente] = useState<Pendente | null>(null);

  function resolver(
    contexto: ContextoConflito,
  ): Promise<{ demonstrativo: Demonstrativo; decisao: DecisaoConflitoPendente | null }> {
    const itens = compararDemonstrativos(contexto.atual, contexto.novo);
    if (itens.length === 0) return Promise.resolve({ demonstrativo: contexto.novo, decisao: null });
    return new Promise((resolve, reject) => setPendente({ itens, contexto, resolve, reject }));
  }

  function confirmar(escolhas: EscolhaItem[]) {
    if (!pendente) return;
    const demonstrativo = aplicarDecisoesImportacao(
      pendente.contexto.atual,
      pendente.contexto.novo,
      escolhas,
    );
    const decisao: DecisaoConflitoPendente = {
      condoId: pendente.contexto.condoId,
      condoNome: pendente.contexto.condoNome,
      destino: pendente.contexto.destino,
      registroId: pendente.contexto.registroId,
      competencia: pendente.contexto.competencia,
      arquivo: pendente.contexto.arquivo,
      itens: escolhas,
    };
    pendente.resolve({ demonstrativo, decisao });
    setPendente(null);
  }

  function cancelar() {
    pendente?.reject();
    setPendente(null);
  }

  return {
    resolver,
    dialogo: {
      aberto: !!pendente,
      itens: pendente?.itens ?? [],
      aoConfirmar: confirmar,
      aoCancelar: cancelar,
    },
  };
}

/**
 * Grava a decisão de conflito já resolvida (ver `useConflitoImportacao`) — chamar só depois que o
 * registro que ela descreve foi efetivamente salvo, nunca antes. Falha de gravação não é lançada:
 * é só o registro de auditoria que não vai pra frente, igual ao padrão já usado em `decisoes_previsao`.
 */
export async function persistirDecisaoConflito(
  usuario: Usuario | null,
  queryClient: QueryClient,
  decisao: DecisaoConflitoPendente,
): Promise<void> {
  if (!usuario) return;
  try {
    await api.salvar<DecisaoConflitoImportacao>("decisoes_importacao", {
      id: novoId(),
      ...decisao,
      decididoPor: usuario.id,
      decididoPorNome: usuario.nome,
      decididoEm: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: chaves.lista("decisoes_importacao") });
  } catch (e) {
    mensagemErro(e);
  }
}

export function ConflitoImportacaoDialog({
  aberto,
  itens,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  itens: ItemDivergenteImportacao[];
  aoConfirmar: (escolhas: EscolhaItem[]) => void;
  aoCancelar: () => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, "manter" | "atualizar">>({});
  // Nenhuma escolha vem pré-marcada: a cada novo conjunto de itens, o usuário decide tudo de novo.
  useEffect(() => {
    if (aberto) setEscolhas({});
  }, [aberto, itens]);

  const todasFeitas = itens.length > 0 && itens.every((i) => escolhas[chaveItem(i)]);

  /** Preenche todas as escolhas de uma vez, deixando o usuário ajustar item a item por cima. */
  function escolherTodos(escolha: "manter" | "atualizar") {
    const todas: Record<string, "manter" | "atualizar"> = {};
    for (const i of itens) todas[chaveItem(i)] = escolha;
    setEscolhas(todas);
  }

  const resumo = itens.reduce(
    (acc, i) => {
      const e = escolhas[chaveItem(i)];
      if (e === "manter") acc.manter++;
      else if (e === "atualizar") acc.atualizar++;
      else acc.pendentes++;
      return acc;
    },
    { manter: 0, atualizar: 0, pendentes: 0 },
  );

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) aoCancelar();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Valores divergentes na reimportação</DialogTitle>
          <DialogDescription>
            Este relatório já tinha dados gravados.{" "}
            {contagem(itens.length, "conta ficou diferente", "contas ficaram diferentes")} do que
            veio no PDF agora — decida em bloco abaixo ou ajuste item a item.
          </DialogDescription>
        </DialogHeader>
        {/* Decisão em bloco: 77 itens um a um é inviável e leva a esquecer algum. Preenche todas
            as escolhas, sem travar o ajuste individual por cima (o rádio de cada item continua
            mandando no que vai ser aplicado). */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
          <span className="text-sm font-medium">Decidir todos:</span>
          <Button variant="outline" size="sm" onClick={() => escolherTodos("manter")}>
            Manter os gravados
          </Button>
          <Button variant="outline" size="sm" onClick={() => escolherTodos("atualizar")}>
            Usar todos do PDF
          </Button>
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {resumo.manter} manter · {resumo.atualizar} do PDF
            {resumo.pendentes > 0 ? ` · ${resumo.pendentes} sem decidir` : ""}
          </span>
        </div>
        {resumo.pendentes > 0 && (
          <p className="text-xs text-muted-foreground">
            {contagem(
              resumo.pendentes,
              "item ainda precisa de decisão",
              "itens ainda precisam de decisão",
            )}
            .
          </p>
        )}
        <ul className="grid gap-3 rounded-md border p-3">
          {itens.map((i) => {
            const k = chaveItem(i);
            return (
              <li key={k} className="grid gap-2 border-b pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium">
                  {ROTULO_SECAO[i.secao]}
                  {i.grupo ? ` / ${i.grupo}` : ""} — {i.nome}
                  {i.ocorrencia > 0 && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ({i.ocorrencia + 1}ª conta com esse nome)
                    </span>
                  )}
                </p>
                <RadioGroup
                  value={escolhas[k] ?? ""}
                  onValueChange={(v) =>
                    setEscolhas((s) => ({ ...s, [k]: v as "manter" | "atualizar" }))
                  }
                  className="gap-2 sm:grid-cols-2"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="manter" id={`${k}-manter`} className="mt-0.5" />
                    <Label htmlFor={`${k}-manter`} className="grid gap-0.5 font-normal">
                      <span className="text-xs text-muted-foreground">
                        Manter o que está gravado
                      </span>
                      <span className="num font-medium">
                        {i.valorAtual !== null ? formatBRL(i.valorAtual) : "Não incluir este item"}
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="atualizar" id={`${k}-atualizar`} className="mt-0.5" />
                    <Label htmlFor={`${k}-atualizar`} className="grid gap-0.5 font-normal">
                      <span className="text-xs text-muted-foreground">
                        Usar o valor do PDF novo
                      </span>
                      <span className="num font-medium">
                        {i.valorNovo !== null ? formatBRL(i.valorNovo) : "Remover este item"}
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={aoCancelar}>
            Cancelar importação
          </Button>
          <Button
            disabled={!todasFeitas}
            onClick={() =>
              aoConfirmar(itens.map((i) => ({ ...i, escolha: escolhas[chaveItem(i)]! })))
            }
          >
            Confirmar e aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
