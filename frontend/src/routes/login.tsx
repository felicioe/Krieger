import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/app/Field";
import { Marca } from "@/components/app/Marca";
import { RodapeLogin } from "@/components/login/RodapeLogin";
import { api, mensagemErro, usandoMock } from "@/lib/api";
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
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!login.trim() || !senha) return setErro("Informe o usuário e a senha.");
    setOcupado(true);
    try {
      const u = await api.auth.entrar(login.trim().toLowerCase(), senha);
      definirUsuario(u);
      navigate({ to: u.trocarSenha ? "/trocar-senha" : "/painel", replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
      setSenha("");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
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
            <form onSubmit={entrar} className="grid gap-4">
              {erro && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
              <Field rotulo="Usuário">
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </Field>
              <Field rotulo="Senha">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={ocupado} className="mt-2 w-full">
                {ocupado && <Loader2 className="animate-spin" />}
                Entrar
              </Button>
            </form>
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
