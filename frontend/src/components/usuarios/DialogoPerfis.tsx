import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, mensagemErro } from "@/lib/api";
import { PERFIL_ROTULO } from "@/domain/usuario";
import type { Perfil } from "@/domain/types";
import type { PermissaoCatalogo, PerfilMatriz } from "@/lib/apiTypes";

/** Nome de cada módulo do catálogo, na ordem em que a matriz os mostra. */
const MODULOS: { chave: string; rotulo: string }[] = [
  { chave: "geral", rotulo: "Geral" },
  { chave: "cadastros", rotulo: "Cadastros" },
  { chave: "financeiro", rotulo: "Financeiro" },
  { chave: "assembleias", rotulo: "Assembleias" },
  { chave: "documentos", rotulo: "Documentos" },
  { chave: "administracao", rotulo: "Administração" },
];

const ACAO: Record<string, string> = { visualizar: "Visualizar", editar: "Editar" };

/**
 * Matriz de permissões por perfil. Só o SuperADM abre esta tela: ele mantém acesso total (a linha
 * do SuperADM é só leitura) e define aqui o que o ADM e o Usuário alcançam. Cada chave é gravada na
 * hora, como nas exceções por usuário.
 */
export function DialogoPerfis({ aoFechar }: { aoFechar: () => void }) {
  const [catalogo, setCatalogo] = useState<PermissaoCatalogo[]>([]);
  const [perfis, setPerfis] = useState<PerfilMatriz[]>([]);
  const [aba, setAba] = useState<Perfil>("adm");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.auth
      .perfis()
      .then((r) => {
        setCatalogo(r.catalogo);
        setPerfis(r.perfis);
      })
      .catch((e) => setErro(mensagemErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  const porModulo = useMemo(() => {
    const mapa = new Map<string, PermissaoCatalogo[]>();
    for (const p of catalogo) {
      const lista = mapa.get(p.modulo) ?? [];
      lista.push(p);
      mapa.set(p.modulo, lista);
    }
    const ordem = MODULOS.map((m) => m.chave);
    return [...mapa.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
  }, [catalogo]);

  function permitida(perfil: Perfil, chave: string): boolean {
    return (
      perfis.find((p) => p.id === perfil)?.permissoes.find((x) => x.chave === chave)?.permitida ??
      false
    );
  }

  function marcar(perfil: Perfil, chave: string, valor: boolean) {
    setPerfis((lista) =>
      lista.map((p) =>
        p.id === perfil
          ? {
              ...p,
              permissoes: p.permissoes.map((x) =>
                x.chave === chave ? { ...x, permitida: valor } : x,
              ),
            }
          : p,
      ),
    );
  }

  async function alternar(perfil: Perfil, chave: string, valor: boolean) {
    if (salvando) return;
    setSalvando(`${perfil}:${chave}`);
    const anterior = permitida(perfil, chave);
    // Atualiza a tela antes da resposta: o switch não pode pular de volta enquanto a gravação corre.
    marcar(perfil, chave, valor);
    try {
      await api.auth.perfilPermissaoSalvar(perfil, chave, valor);
      toast.success(`${PERFIL_ROTULO[perfil]}: permissão atualizada.`);
    } catch (e) {
      marcar(perfil, chave, anterior);
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Perfis e permissões</DialogTitle>
          <DialogDescription>
            O SuperADM tem acesso total e não pode ser restringido. O ADM e o Usuário valem pelo que
            estiver marcado aqui; cada pessoa ainda pode ter exceções próprias na tela de Usuários.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" aria-hidden="true" /> Carregando a matriz de
            permissões…
          </p>
        ) : erro ? (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : (
          <Tabs value={aba} onValueChange={(v) => setAba(v as Perfil)}>
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              {perfis.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="px-3">
                  {PERFIL_ROTULO[p.id]}
                  {p.fixo && <ShieldCheck className="ml-1 size-3.5" aria-hidden="true" />}
                </TabsTrigger>
              ))}
            </TabsList>

            {perfis.map((p) => (
              <TabsContent key={p.id} value={p.id} className="mt-4">
                {p.fixo ? (
                  <Alert>
                    <AlertDescription>
                      O {PERFIL_ROTULO[p.id]} alcança todas as telas e ações, inclusive criar os
                      demais perfis. Por isso a matriz dele não é editável.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {p.id === "adm"
                      ? "Por padrão o ADM opera o sistema inteiro, sem as telas de administração."
                      : "Por padrão o Usuário começa como o ADM; restrinja aqui ou por exceção individual."}
                  </p>
                )}

                <div className="space-y-4">
                  {porModulo.map(([modulo, chaves]) => (
                    <section key={modulo} aria-labelledby={`perfil-${p.id}-${modulo}`}>
                      <h3
                        id={`perfil-${p.id}-${modulo}`}
                        className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary"
                      >
                        {MODULOS.find((m) => m.chave === modulo)?.rotulo ?? modulo}
                      </h3>
                      <ul className="divide-y rounded-md border">
                        {chaves.map((chave) => {
                          const marcado = permitida(p.id, chave.chave);
                          const ocupado = salvando === `${p.id}:${chave.chave}`;
                          const rotuloAcao = ACAO[chave.acao] ?? chave.acao;
                          return (
                            <li
                              key={chave.chave}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {chave.tela} · {rotuloAcao}
                                </p>
                                <p className="text-xs text-muted-foreground">{chave.chave}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {ocupado && (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                )}
                                <Badge variant={marcado ? "success" : "secondary"}>
                                  {marcado ? "Permitida" : "Negada"}
                                </Badge>
                                <Switch
                                  checked={p.fixo || marcado}
                                  disabled={p.fixo || salvando !== null}
                                  aria-label={`${PERFIL_ROTULO[p.id]}: ${chave.tela} — ${rotuloAcao}`}
                                  onCheckedChange={(v) => void alternar(p.id, chave.chave, v)}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  {porModulo.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      O catálogo de permissões ainda não está disponível neste ambiente.
                    </p>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando !== null}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
