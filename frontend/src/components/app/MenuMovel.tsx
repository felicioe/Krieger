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
 *   (`destinoFoco`), em vez de voltar ao botão ou ficar num item escondido — mas só depois que a
 *   página nova terminou de carregar (`carregando` falso), para o leitor de tela não ler a página
 *   anterior. Se o conteúdo for trocado durante a carga, o foco é refeito no elemento novo.
 * - `depoisDeFechar(acao)` (ex.: abrir uma janela a partir do menu): fecha a gaveta, deixa o foco
 *   voltar ao "Abrir menu" e só então roda a ação — nunca duas camadas abertas ao mesmo tempo,
 *   e a janela aberta devolve o foco a um botão que continua na tela.
 */
export function MenuMovel({
  topo,
  children,
  destinoFoco,
  caminho,
  carregando = false,
}: {
  /** Conteúdo ao lado do botão (ex.: a marca compacta). */
  topo?: ReactNode;
  /**
   * Conteúdo da gaveta; chame `aoNavegar` quando um item levar a outra página e
   * `depoisDeFechar(acao)` para rodar algo (ex.: abrir uma janela) só depois que ela fechar.
   */
  children: (aoNavegar: () => void, depoisDeFechar: (acao: () => void) => void) => ReactNode;
  /** Elemento que recebe o foco depois de navegar pelo menu (precisa aceitar foco, ex.: tabIndex={-1}). */
  destinoFoco: () => HTMLElement | null;
  /** Caminho atual: a gaveta fecha sozinha quando ele muda. */
  caminho?: string;
  /** Verdadeiro enquanto a página de destino ainda carrega. */
  carregando?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const navegou = useRef(false);
  const focoPendente = useRef(false);
  const acaoPendente = useRef<(() => void) | null>(null);
  const carregandoRef = useRef(carregando);
  carregandoRef.current = carregando;

  useEffect(() => setAberto(false), [caminho]);

  const focarDestino = () => {
    const destino = destinoFoco();
    if (destino && document.activeElement !== destino) destino.focus({ preventScroll: true });
  };

  // Página carregada depois que a gaveta fechou: agora sim leva o foco ao conteúdo novo.
  useEffect(() => {
    if (carregando || !focoPendente.current) return;
    const quadro = requestAnimationFrame(() => {
      if (!focoPendente.current) return;
      focoPendente.current = false;
      const atual = document.activeElement;
      // Não rouba o foco se a pessoa já foi para outro controle durante a carga.
      if (!atual || atual === document.body || !atual.isConnected || atual === destinoFoco()) focarDestino();
    });
    return () => cancelAnimationFrame(quadro);
  }, [carregando, caminho]);

  const aoNavegar = () => {
    navegou.current = true;
    setAberto(false);
  };

  const depoisDeFechar = (acao: () => void) => {
    navegou.current = false;
    acaoPendente.current = acao;
    setAberto(false);
  };

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (v) {
          navegou.current = false;
          acaoPendente.current = null;
        }
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
        {/* min-w-0: com texto ampliado o logo encolhe no espaço que sobra em vez de empurrar a página. */}
        <div className="min-w-0 flex-1">{topo}</div>
      </header>
      <SheetContent
        side="left"
        className="w-72 max-w-[85vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        fecharClassName="text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring"
        onCloseAutoFocus={(e) => {
          const acao = acaoPendente.current;
          if (acao) {
            // Deixa o foco voltar ao "Abrir menu" (padrão) e roda a ação no quadro seguinte.
            acaoPendente.current = null;
            requestAnimationFrame(acao);
            return;
          }
          if (!navegou.current) return; // Escape / Fechar / tocar fora: o foco volta ao "Abrir menu".
          navegou.current = false;
          e.preventDefault();
          if (carregandoRef.current) focoPendente.current = true;
          else focarDestino();
        }}
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Navegação principal do sistema</SheetDescription>
        {children(aoNavegar, depoisDeFechar)}
      </SheetContent>
    </Sheet>
  );
}
