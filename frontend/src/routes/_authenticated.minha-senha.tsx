import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { FormSenha } from "@/components/app/FormSenha";
import { cabecalho } from "@/lib/head";

export const Route = createFileRoute("/_authenticated/minha-senha")({
  head: () => cabecalho("Minha senha", "Alteração da senha de acesso."),
  component: MinhaSenha,
});

function MinhaSenha() {
  return (
    <>
      <PageHeader titulo="Minha senha" descricao="Altere a senha usada para entrar no sistema." />
      <SectionCard className="max-w-lg">
        <FormSenha aoConcluir={() => void toast.success("Senha alterada com sucesso.")} />
      </SectionCard>
    </>
  );
}
