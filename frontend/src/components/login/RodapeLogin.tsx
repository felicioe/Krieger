import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VERSOES } from "./versoes";

/**
 * Rodapé da tela de entrada: autoria, versão atual e o registro de alterações.
 * A janela abre por um acionador próprio (Radix devolve o foco a ele ao fechar) e fica
 * num portal, então o formulário de entrada continua montado com o que já foi digitado.
 */
export function RodapeLogin() {
  const { versaoAtual, versoes } = VERSOES;

  return (
    <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
      {/* No celular cada item fica numa linha (sem separador solto); a partir de sm, lado a lado. */}
      <div className="mx-auto flex flex-col items-center gap-1 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
        <span>Feito pela Therafinancial</span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span>Versão {versaoAtual}</span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="link" size="sm" className="h-auto px-1 py-1 text-xs whitespace-normal">
              Registro de Alterações
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registro de Alterações</DialogTitle>
              <DialogDescription>
                Versão atual: {versaoAtual}. Uma versão nova só é registrada em marcos importantes
                do sistema.
              </DialogDescription>
            </DialogHeader>
            <ol className="grid gap-4" aria-label="Versões do Sistema Krieger">
              {versoes.map((v) => (
                <li key={v.versao} className="rounded-md border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Versão {v.versao} — {v.titulo}
                    {v.versao === versaoAtual && (
                      <span className="ml-2 font-normal text-muted-foreground">(versão atual)</span>
                    )}
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {v.alteracoes.map((a, i) => (
                      <li key={i} className="break-words">
                        {a}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </footer>
  );
}
