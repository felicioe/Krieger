import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Marca } from "@/components/app/Marca";
import { FormEntrar } from "@/components/login/FormEntrar";
import { RodapeLogin } from "@/components/login/RodapeLogin";
import { usandoMock } from "@/lib/api";
import { definirUsuario, garantirSessao } from "@/lib/auth";
import { cabecalho } from "@/lib/head";

export const Route = createFileRoute("/login")({
  head: () => cabecalho("Entrar", "Acesso ao Sistema Krieger de contabilidade condominial."),
  beforeLoad: async () => {
    const u = await garantirSessao().catch(() => null);
    if (u) throw redirect({ to: u.trocarSenha ? "/trocar-senha" : "/painel" });
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <Marca className="max-w-[16rem] lg:max-w-[18rem]" />
        <div className="max-w-sm">
          <p className="text-2xl font-medium leading-snug">
            Prestação de contas, relatórios mensais, editais e atas de assembleia.
          </p>
          <div className="mt-6 h-1 w-16 bg-sidebar-indicator" />
        </div>
        <p className="text-xs text-sidebar-muted">Krieger Assessoria Contábil e Condominial</p>
      </aside>

      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Marca fundo="claro" className="mx-auto max-w-[14rem]" />
          </div>
          <div className="rounded-md border bg-card p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary">
                <LockKeyhole className="size-4" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Entrar no sistema</h1>
                <p className="text-xs text-muted-foreground">Use seu usuário e senha.</p>
              </div>
            </div>
              <FormEntrar
                aoEntrar={(u) => {
                  definirUsuario(u);
                  navigate({ to: u.trocarSenha ? "/trocar-senha" : "/painel", replace: true });
                }}
                />
              <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                Precisa de acesso ou esqueceu sua senha? Procure o administrador responsável pelo
                sistema.
              </p>
          </div>
          {usandoMock() && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
                Modo demonstração (dados locais): usuário <strong>admin</strong>, senha{" "}
                <strong>admin123</strong>.
            </p>
          )}
        </div>
      </main>
        <RodapeLogin />
      </div>
    </div>
  );
}
