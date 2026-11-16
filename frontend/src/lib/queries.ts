import { queryOptions } from "@tanstack/react-query";
import type { Store } from "@/domain/types";
import { api } from "./api";

export const chaves = {
  lista: (store: Store) => ["store", store, "lista"] as const,
  item: (store: Store, id: string) => ["store", store, "item", id] as const,
  store: (store: Store) => ["store", store] as const,
  usuarios: ["auth", "usuarios"] as const,
  backups: ["backups"] as const,
  limpezaContagens: ["manutencao", "contagens"] as const,
  consultaHistorico: (condoId: string) => ["documentos", "historico", condoId] as const,
  documentosDrive: (condoId: string) => ["documentos", "drive", condoId] as const,
  documentosResumo: ["documentos", "resumo"] as const,
};

export const listaQuery = <T>(store: Store) =>
  queryOptions({
    queryKey: chaves.lista(store),
    queryFn: () => api.listar<T>(store),
  });

/**
 * Lista de um store que pode ainda não existir no banco (tabela criada por migration posterior
 * à instalação). Devolve lista vazia em vez de derrubar a tela: o recurso fica sem histórico até
 * a migration ser aplicada, e o resto da página continua funcionando.
 */
export const listaQueryTolerante = <T>(store: Store) =>
  queryOptions({
    queryKey: chaves.lista(store),
    queryFn: async () => {
      try {
        return await api.listar<T>(store);
      } catch (erro) {
        console.warn(`[krieger] store "${store}" indisponível; seguindo com lista vazia.`, erro);
        return [] as T[];
      }
    },
  });

export const itemQuery = <T>(store: Store, id: string) =>
  queryOptions({
    queryKey: chaves.item(store, id),
    queryFn: () => api.obter<T>(store, id),
  });

export const usuariosQuery = () =>
  queryOptions({
    queryKey: chaves.usuarios,
    queryFn: () => api.auth.usuarios(),
  });

export const backupsQuery = () =>
  queryOptions({
    queryKey: chaves.backups,
    queryFn: () => api.backup.listar(),
  });

export const limpezaContagensQuery = () =>
  queryOptions({
    queryKey: chaves.limpezaContagens,
    queryFn: () => api.manutencao.contagens(),
  });

export const consultaHistoricoQuery = (condoId: string) =>
  queryOptions({
    queryKey: chaves.consultaHistorico(condoId),
    queryFn: () => api.documentos.historico(condoId),
    enabled: condoId !== "",
  });

export const documentosDriveQuery = (condoId: string) =>
  queryOptions({
    queryKey: chaves.documentosDrive(condoId),
    queryFn: () => api.documentos.listar(condoId),
    enabled: condoId !== "",
  });

export const documentosResumoQuery = () =>
  queryOptions({
    queryKey: chaves.documentosResumo,
    queryFn: () => api.documentos.resumo(),
  });
