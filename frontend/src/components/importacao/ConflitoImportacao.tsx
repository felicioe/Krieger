import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { contagem } from "@/components/app/textos";
import { api, mensagemErro } from "@/lib/api";
import { novoId } from "@/lib/id";
import { formatBRL } from "@/lib/format";
import { chaves } from "@/lib/queries";
import { useUsuario } from "@/lib/auth";
import { aplicarDecisoesImportacao, compararDemonstrativos } from "@/domain/importacao";
import type { Demonstrativo, DecisaoConflitoImportacao, ItemDivergenteImportacao } from "@/domain/types";

type EscolhaItem = ItemDivergenteImportacao & { escolha: "manter" | "atualizar" };

export const ROTULO_SECAO: Record<ItemDivergenteImportacao["secao"], string> = {
  saldoAnterior: "Saldo anterior",
  receitas: "Receitas",
  despesas: "Despesas",
  saldoAtual: "Saldo atual",
};

function chaveItem(i: ItemDivergenteImportacao): string {
  return `${i.secao}::${i.grupo ?? ""}::${i.nome}`;
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

type Pendente = {
  itens: ItemDivergenteImportacao[];
  contexto: ContextoConflito;
  resolve: (d: Demonstrativo) => void;
  reject: () => void;
};

/**
 * Compara conta a conta e, se houver divergência, abre o diálogo de conflito e só resolve a
 * promessa quando o usuário decidir todos os itens (nenhuma escolha pré-marcada) — ou rejeita se
 * ele cancelar. Sem divergência (ou sem nada gravado antes), resolve direto com `novo`, sem diálogo.
 * Toda decisão (mesmo "manter tudo") é registrada em `decisoes_importacao` para conferência futura.
 */
export function useConflitoImportacao() {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [salvando, setSalvando] = useState(false);

  function resolver(contexto: ContextoConflito): Promise<Demonstrativo> {
    const itens = compararDemonstrativos(contexto.atual, contexto.novo);
    if (itens.length === 0) return Promise.resolve(contexto.novo);
    return new Promise((resolve, reject) => setPendente({ itens, contexto, resolve, reject }));
  }

  async function confirmar(escolhas: EscolhaItem[]) {
    if (!pendente) return;
    const final = aplicarDecisoesImportacao(pendente.contexto.atual, pendente.contexto.novo, escolhas);
    setSalvando(true);
    try {
      if (usuario) {
        await api.salvar<DecisaoConflitoImportacao>("decisoes_importacao", {
          id: novoId(),
          condoId: pendente.contexto.condoId,
          condoNome: pendente.contexto.condoNome,
          destino: pendente.contexto.destino,
          registroId: pendente.contexto.registroId,
          competencia: pendente.contexto.competencia,
          arquivo: pendente.contexto.arquivo,
          itens: escolhas,
          decididoPor: usuario.id,
          decididoPorNome: usuario.nome,
          decididoEm: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: chaves.lista("decisoes_importacao") });
      }
    } catch (e) {
      // Não bloqueia a importação em si — só o registro de auditoria falharia.
      mensagemErro(e);
    } finally {
      setSalvando(false);
    }
    pendente.resolve(final);
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
      confirmando: salvando,
      aoConfirmar: confirmar,
      aoCancelar: cancelar,
    },
  };
}

export function ConflitoImportacaoDialog({
  aberto,
  itens,
  confirmando,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  itens: ItemDivergenteImportacao[];
  confirmando?: boolean;
  aoConfirmar: (escolhas: EscolhaItem[]) => void;
  aoCancelar: () => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, "manter" | "atualizar">>({});
  // Nenhuma escolha vem pré-marcada: a cada novo conjunto de itens, o usuário decide tudo de novo.
  useEffect(() => {
    if (aberto) setEscolhas({});
  }, [aberto, itens]);

  const todasFeitas = itens.length > 0 && itens.every((i) => escolhas[chaveItem(i)]);

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
            Este relatório já tinha dados gravados. {contagem(itens.length, "conta ficou diferente", "contas ficaram diferentes")}{" "}
            do que veio no PDF agora — escolha, uma a uma, se mantém o valor gravado ou usa o valor novo.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3 rounded-md border p-3">
          {itens.map((i) => {
            const k = chaveItem(i);
            return (
              <li key={k} className="grid gap-2 border-b pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium">
                  {ROTULO_SECAO[i.secao]}
                  {i.grupo ? ` / ${i.grupo}` : ""} — {i.nome}
                </p>
                <RadioGroup
                  value={escolhas[k] ?? ""}
                  onValueChange={(v) => setEscolhas((s) => ({ ...s, [k]: v as "manter" | "atualizar" }))}
                  className="gap-2 sm:grid-cols-2"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="manter" id={`${k}-manter`} className="mt-0.5" disabled={confirmando} />
                    <Label htmlFor={`${k}-manter`} className="grid gap-0.5 font-normal">
                      <span className="text-xs text-muted-foreground">Manter o que está gravado</span>
                      <span className="num font-medium">{i.valorAtual !== null ? formatBRL(i.valorAtual) : "Não incluir este item"}</span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="atualizar" id={`${k}-atualizar`} className="mt-0.5" disabled={confirmando} />
                    <Label htmlFor={`${k}-atualizar`} className="grid gap-0.5 font-normal">
                      <span className="text-xs text-muted-foreground">Usar o valor do PDF novo</span>
                      <span className="num font-medium">{i.valorNovo !== null ? formatBRL(i.valorNovo) : "Remover este item"}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={aoCancelar} disabled={confirmando}>
            Cancelar importação
          </Button>
          <Button
            disabled={!todasFeitas || confirmando}
            onClick={() => aoConfirmar(itens.map((i) => ({ ...i, escolha: escolhas[chaveItem(i)]! })))}
          >
            {confirmando && <Loader2 className="animate-spin" />}
            Confirmar e aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
