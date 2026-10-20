import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { ApiError, definirAoNaoAutorizado, mensagemErro } from "./lib/api";
import { limparSessao } from "./lib/auth";

function avisarErro(e: unknown) {
  // 401 é tratado com redirecionamento para o login
  if (e instanceof ApiError && e.status === 401) return;
  toast.error(mensagemErro(e));
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: avisarErro }),
    mutationCache: new MutationCache({ onError: avisarErro }),
    defaultOptions: {
      queries: {
        retry: (n, e) => !(e instanceof ApiError && e.status > 0 && e.status < 500) && n < 1,
        refetchOnWindowFocus: false,
        staleTime: 15_000,
      },
    },
  });

  const noNavegador = typeof window !== "undefined";

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Rotas com "#" funcionam em qualquer hospedagem estática, sem regras de rewrite.
    ...(noNavegador ? { history: createHashHistory() } : {}),
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  if (noNavegador) {
    definirAoNaoAutorizado(() => {
      limparSessao();
      queryClient.clear();
      if (router.state.location.pathname !== "/login") {
        router.navigate({ to: "/login" });
      }
    });
  }

  return router;
};
