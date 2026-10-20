import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConteudoMenu } from "@/components/app/AppSidebar";
import { Marca } from "@/components/app/Marca";
import { Carregando } from "@/components/app/Carregando";
import { garantirSessao } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const usuario = await garantirSessao();
    if (!usuario) throw redirect({ to: "/login" });
    if (usuario.trocarSenha) throw redirect({ to: "/trocar-senha" });
    return { usuario };
  },
  pendingComponent: () => <Carregando />,
  component: LayoutSistema,
});

function LayoutSistema() {
  const [gaveta, setGaveta] = useState(false);
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setGaveta(false), [caminho]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
        <ConteudoMenu />
      </aside>

      <Sheet open={gaveta} onOpenChange={setGaveta}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <ConteudoMenu aoNavegar={() => setGaveta(false)} />
        </SheetContent>
      </Sheet>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-sidebar px-3 text-sidebar-foreground md:hidden">
          <button
            type="button"
            onClick={() => setGaveta(true)}
            className="flex size-9 items-center justify-center rounded-md hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <Marca compacta />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
