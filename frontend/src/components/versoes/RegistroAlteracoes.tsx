import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ID_CONTEUDO } from "@/components/app/foco";
import { VERSOES } from "./versoes";

/**
 * Janela "Registro de Alterações" (fonte única: `src/data/versoes.json`). Controlada por estado:
 * guarda o elemento que tinha o foco ao abrir e o devolve ao fechar; se ele saiu da tela, o foco
 * vai para o conteúdo principal — nunca fica no `<body>`. Fica num portal, então a página atrás
 * (com o que já foi digitado) continua montada.
 */
export function DialogoRegistroAlteracoes({
  aberto,
  aoMudar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}) {
  const { versaoAtual, versoes } = VERSOES;
  const origem = useRef<Element | null>(null);

  return (
    <Dialog open={aberto} onOpenChange={aoMudar}>
      {/*
        wrap-anywhere: versão/título/alteração sem espaços quebram em vez de alargar a janela.
        Só a lista rola (e recebe o foco ao abrir, para as setas rolarem); título, "X" e
        "Fechar" ficam sempre à vista. Se nem isso couber, a janela inteira rola.
      */}
      <DialogContent
        className="flex max-h-[85vh] flex-col overflow-y-auto wrap-anywhere"
        onOpenAutoFocus={() => {
          origem.current = document.activeElement;
        }}
        onCloseAutoFocus={(ev) => {
          ev.preventDefault();
          const o = origem.current;
          origem.current = null;
          const visivel = o instanceof HTMLElement && o.isConnected && !o.closest("[hidden],[inert],[aria-hidden='true']");
          if (visivel && o !== document.body) o.focus();
          else document.getElementById(ID_CONTEUDO)?.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle className="pe-6">Registro de Alterações</DialogTitle>
          <DialogDescription>
            Versão atual: {versaoAtual}. Uma versão nova só é registrada em marcos importantes do
            sistema.
          </DialogDescription>
        </DialogHeader>
        <ol
          tabIndex={0}
          className="grid min-h-24 gap-4 overflow-y-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label="Versões do Sistema Krieger"
        >
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
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <DialogFooter className="shrink-0">
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ContextoRegistro = createContext<(() => void) | null>(null);

/**
 * Disponibiliza "abrir o Registro de Alterações" para o menu. Só é montado na área logada,
 * então fora dela (login) a ação não existe. A janela fica aqui, fora da gaveta do celular,
 * para não desmontar junto com ela.
 */
export function ProvedorRegistroAlteracoes({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  return (
    <ContextoRegistro.Provider value={abrir}>
      {children}
      <DialogoRegistroAlteracoes aberto={aberto} aoMudar={setAberto} />
    </ContextoRegistro.Provider>
  );
}

/** Abre o Registro de Alterações; `null` fora da área logada. */
export function useAbrirRegistroAlteracoes(): (() => void) | null {
  return useContext(ContextoRegistro);
}
