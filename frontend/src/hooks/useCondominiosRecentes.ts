import { useEffect, useState } from "react";

/**
 * Hook para gerenciar a lista de condomínios recentes do usuário.
 * Persiste os IDs em localStorage com a chave 'krieger.condominios.recentes.{userId}'.
 *
 * Retorna:
 * - recentes: string[] - IDs dos condomínios recentes (na ordem mais recente primeiro)
 * - adicionarRecente: (id: string) => void - adiciona um condomínio à lista de recentes
 * - removerRecente: (id: string) => void - remove um condomínio da lista de recentes
 * - limparRecentes: () => void - limpa toda a lista de recentes
 */
export function useCondominiosRecentes(userId: string | undefined) {
  const storageKey = userId ? `krieger.condominios.recentes.${userId}` : "krieger.condominios.recentes";

  // Carrega da persistência localStorage na inicialização
  const [recenteIds, setRecenteIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Atualiza o localStorage sempre que a lista muda
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(recenteIds));
    } catch {
      // Ignora erros de persistência em ambientes restritos
    }
  }, [recenteIds, storageKey]);

  const adicionarRecente = (id: string) => {
    setRecenteIds((prev) => {
      // Remove ID se já existir (para reposicioná-lo no topo)
      const filtered = prev.filter((item) => item !== id);
      // Insere no início, mantendo limite de 10 itens
      const updated = [id, ...filtered].slice(0, 10);
      return updated;
    });
  };

  const removerRecente = (id: string) => {
    setRecenteIds((prev) => prev.filter((item) => item !== id));
  };

  const limparRecentes = () => {
    setRecenteIds([]);
  };

  return {
    recentes: recenteIds,
    adicionarRecente,
    removerRecente,
    limparRecentes,
  };
}