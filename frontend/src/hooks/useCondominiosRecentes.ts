import { useCallback, useSyncExternalStore } from "react";
import {
  assinarRecentes,
  limparRecentes as limpar,
  lerRecentes,
  registrarRecente,
  removerRecente as remover,
} from "@/lib/condominiosRecentes";

/**
 * Condomínios recentes do usuário (issue #295). A lista é compartilhada entre todos os seletores
 * da tela e fica guardada no navegador, por usuário. Ver `lib/condominiosRecentes.ts`.
 *
 * Retorna:
 * - recentes: string[] - IDs dos últimos condomínios escolhidos, do mais recente para o mais antigo
 * - adicionarRecente: (id) => void - coloca o condomínio no topo da lista
 * - removerRecente: (id) => void - remove o condomínio da lista
 * - limparRecentes: () => void - esvazia a lista
 */
export function useCondominiosRecentes(userId: string | undefined) {
  const recentes = useSyncExternalStore(
    assinarRecentes,
    () => lerRecentes(userId),
    () => [],
  );

  const adicionarRecente = useCallback((id: string) => registrarRecente(userId, id), [userId]);
  const removerRecente = useCallback((id: string) => remover(userId, id), [userId]);
  const limparRecentes = useCallback(() => limpar(userId), [userId]);

  return { recentes, adicionarRecente, removerRecente, limparRecentes };
}
