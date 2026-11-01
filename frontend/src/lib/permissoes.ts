import type { Usuario } from "@/domain/types";

export const rotasPermissoes: Array<[string, string]> = [
  ["/painel", "painel"],
  ["/condominios", "condominios"],
  ["/prestacao-contas", "prestacao_contas"],
  ["/relatorio-final", "prestacao_contas"],
  ["/previsao-orcamentaria", "previsao_orcamentaria"],
  ["/previsto-realizado", "previsto_realizado"],
  ["/relatorio-mensal", "relatorio_mensal"],
  ["/importador", "importador"],
  ["/importacoes", "importador"],
  ["/importador-condominios", "importador"],
  ["/editais", "editais"],
  ["/atas", "atas"],
  ["/modelos", "modelos"],
  ["/drive-documentos", "drive_documentos"],
  ["/consulta-documentos", "consulta_documentos"],
  ["/escritorio", "escritorio"],
  ["/backup", "backup"],
  ["/usuarios", "usuarios"],
];

export function podeAcessarRota(usuario: Usuario | null, caminho: string): boolean {
  if (!usuario) return false;
  const rota = (caminho.split(/[?#]/)[0] ?? "/").replace(/\/$/, "") || "/";
  if (["/usuarios", "/limpeza-dados"].some((r) => rota === r || rota.startsWith(r + "/")))
    return usuario.perfil === "admin";
  if (usuario.perfil === "admin") return true;
  const regra = rotasPermissoes.find(([r]) => rota === r || rota.startsWith(r + "/"));
  return (
    !regra ||
    usuario.permissoes?.includes("*") === true ||
    usuario.permissoes?.includes(regra[1] + ".visualizar") === true
  );
}
