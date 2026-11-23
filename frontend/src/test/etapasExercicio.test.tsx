import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import type { Usuario } from "@/domain/types";
import type { EtapaExercicio } from "@/domain/etapasExercicio";

const { definirUsuario } = await import("@/lib/auth");
const { EtapasExercicio } = await import("@/components/app/EtapasExercicio");

const etapas: EtapaExercicio[] = [
  {
    chave: "importar",
    titulo: "Importar",
    estado: "concluida",
    detalhe: "Demonstrativo com lançamentos.",
  },
  { chave: "conferir", titulo: "Conferir", estado: "concluida", detalhe: "Saldos fecham." },
  { chave: "previsao", titulo: "Previsão", estado: "em_andamento", detalhe: "Apure o reajuste." },
  {
    chave: "edital",
    titulo: "Edital",
    estado: "pendente",
    detalhe: "Crie o edital.",
    registroId: "ed1",
  },
  { chave: "ata", titulo: "Ata", estado: "pendente", detalhe: "Depende do edital." },
  { chave: "fechar", titulo: "Fechar", estado: "pendente", detalhe: "Feche o exercício." },
];

function montar() {
  definirUsuario({
    id: "u1",
    login: "t",
    nome: "T",
    perfil: "admin",
    trocarSenha: false,
  } as Usuario);
  const raiz = createRootRoute({
    component: () => <EtapasExercicio etapas={etapas} exercicioId="ex1" />,
  });
  const router = createRouter({
    routeTree: raiz,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("fluxo guiado do exercício na tela (#309)", () => {
  it("lista as seis etapas em ordem e marca o próximo passo", async () => {
    montar();
    const nav = await screen.findByRole("navigation", { name: "Etapas do exercício" });
    const itens = within(nav).getAllByRole("listitem");
    expect(itens.map((li) => li.textContent?.match(/\d\. \p{L}+/u)?.[0])).toEqual([
      "1. Importar",
      "2. Conferir",
      "3. Previsão",
      "4. Edital",
      "5. Ata",
      "6. Fechar",
    ]);
    expect(itens[2]).toHaveAttribute("aria-current", "step");
  });

  it("oferece atalhos para a previsão, o edital encontrado e as atas", async () => {
    montar();
    await screen.findByRole("navigation", { name: "Etapas do exercício" });
    expect(screen.getByRole("link", { name: "Abrir a previsão" })).toHaveAttribute(
      "href",
      expect.stringContaining("/previsao-orcamentaria"),
    );
    expect(screen.getByRole("link", { name: "Abrir o edital" })).toHaveAttribute(
      "href",
      "/editais/ed1",
    );
    expect(screen.getByRole("link", { name: "Ir para atas" })).toHaveAttribute("href", "/atas");
  });
});
