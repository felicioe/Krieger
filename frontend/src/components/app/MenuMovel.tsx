import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Barra superior do celular com o botão "Abrir menu" e a gaveta do menu.
 * - Abre com clique, Enter ou Espaço (o acionador é um botão de verdade).
 * - Fecha com Escape, com o botão "Fechar" ou tocando fora; o foco volta ao "Abrir menu".
 * - Quando a pessoa escolhe um destino no menu, o foco vai para o conteúdo da página
 *   (`destinoFoco`), em vez de voltar ao botão ou ficar num item escondido.
 */
export function MenuMovel({
  topo,
  children,
  destinoFoco,
  caminho,
}: {
  /** Conteúdo ao lado do botão (ex.: a marca compacta). */
  topo?: ReactNode;
  /** Conteúdo da gaveta; chame `aoNavegar` quando um item levar a outra página. */
  children: (aoNavegar: () => void) => ReactNode;
  /** Elemento que recebe o foco depois de navegar pelo menu (precisa aceitar foco, ex.: tabIndex={-1}). */
  destinoFoco: () => HTMLElement | null;
  /** Caminho atual: a gaveta fecha sozinha quando ele muda. */
  caminho?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const navegou = useRef(false);

  useEffect(() => setAberto(false), [caminho]);

  const aoNavegar = () => {
    navegou.current = true;
    setAberto(false);
  };

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (v) navegou.current = false;
        setAberto(v);
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-sidebar px-2 text-sidebar-foreground md:hidden">
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
        </SheetTrigger>
        {topo}
      </header>
      <SheetContent
        side="left"
        className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        fecharClassName="text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring"
        onCloseAutoFocus={(e) => {
          if (!navegou.current) return; // Escape / Fechar / tocar fora: o foco volta ao "Abrir menu".
          navegou.current = false;
          const destino = destinoFoco();
          if (destino) {
            e.preventDefault();
            destino.focus({ preventScroll: true });
          }
        }}
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Navegação principal do sistema</SheetDescription>
        {children(aoNavegar)}
      </SheetContent>
    </Sheet>
  );
}
