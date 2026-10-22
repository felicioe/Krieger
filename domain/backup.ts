import { STORES, type Backup, type Store } from "./types";

/** Nome do arquivo de backup: krieger-backup-AAAAMMDD.json */
export function nomeArquivoBackup(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `krieger-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}

/** Quantidade de registros por store num backup (para conferência antes de restaurar). */
export function resumoBackup(b: unknown): { store: Store; total: number }[] | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Backup;
  const resumo = STORES.map((s) => ({ store: s, total: Array.isArray(o[s]) ? (o[s] as unknown[]).length : 0 }));
  return resumo.some((r) => r.total > 0) ? resumo : null;
}

export const ROTULO_STORE: Record<Store, string> = {
  condominios: "Condomínios",
  exercicios: "Prestações de contas",
  mensais: "Relatórios mensais",
  assembleias: "Editais",
  modelos: "Modelos de edital",
  config: "Configurações",
  importacoes: "Importações",
  atas: "Atas",
  anexos_importacao: "Anexos de importação",
};
