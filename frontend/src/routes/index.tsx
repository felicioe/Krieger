import { createFileRoute, redirect } from "@tanstack/react-router";
import { cabecalho } from "@/lib/head";

// A página inicial é o Painel; o guarda de autenticação decide se vai ao login.
export const Route = createFileRoute("/")({
  head: () => cabecalho("Início", "Sistema Krieger — contabilidade condominial."),
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
});
