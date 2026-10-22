import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/app/Marca";
import { FormSenha } from "@/components/app/FormSenha";
import { garantirSessao, recarregarSessao, sair } from "@/lib/auth";
import { cabecalho } from "@/lib/head";

export const Route = createFileRoute("/trocar-senha")({
  head: () => cabecalho("Definir nova senha", "Troca obrigatória da senha provisória."),
  beforeLoad: async () => {
    const u = await garantirSessao().catch(() => null);
    if (!u) throw redirect({ to: "/login" });
    if (!u.trocarSenha) throw redirect({ to: "/painel" });
  },
  component: TrocarSenha,
});

function TrocarSenha() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Marca fundo="claro" className="mx-auto max-w-[15rem]" />
        </div>
        <div className="rounded-md border bg-card p-6 sm:p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Defina uma nova senha</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Sua senha atual é provisória. Para continuar, crie uma senha pessoal.
          </p>
          <FormSenha
            rotulo="Salvar e continuar"
            aoConcluir={async () => {
              await recarregarSessao();
              toast.success("Senha alterada com sucesso.");
              navigate({ to: "/painel", replace: true });
            }}
          />
        </div>
        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={async () => {
              await sair().catch(() => undefined);
              navigate({ to: "/login" });
            }}
          >
            Sair
          </Button>
        </div>
      </div>
    </main>
  );
}
