import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { api, mensagemErro } from "@/lib/api";
import { chaves, usuariosQuery } from "@/lib/queries";
import { useUsuario } from "@/lib/auth";
import { formatDataHora } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { PERFIL_ROTULO, SENHA_MINIMA, validarLogin, validarNovaSenha } from "@/domain/usuario";
import type { Perfil, UsuarioAdmin } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => cabecalho("Usuários", "Gestão dos usuários com acesso ao sistema."),
  beforeLoad: ({ context }) => {
    if (context.usuario.perfil !== "admin") throw redirect({ to: "/painel" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(usuariosQuery()),
  component: Usuarios,
});

function Usuarios() {
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(usuariosQuery());
  const [editando, setEditando] = useState<UsuarioAdmin | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<UsuarioAdmin | null>(null);

  const excluir = useMutation({
    mutationFn: (id: string) => api.auth.usuarioExcluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.usuarios });
      toast.success("Usuário excluído.");
    },
  });

  const ordenados = [...data].sort((a, b) => a.login.localeCompare(b.login));

  return (
    <>
      <PageHeader
        titulo="Usuários"
        descricao="Quem pode acessar o Sistema Krieger."
        acoes={
          <Button onClick={() => setEditando("novo")}>
            <Plus /> Novo usuário
          </Button>
        }
      />
      <DataTable
        colunas={[
          {
            chave: "login",
            titulo: "Login",
            render: (u: UsuarioAdmin) => (
              <span className="font-mono text-sm">
                {u.login}
                {u.id === eu?.id && <span className="ml-2 font-sans text-xs text-muted-foreground">(você)</span>}
              </span>
            ),
          },
          { chave: "nome", titulo: "Nome" },
          { chave: "perfil", titulo: "Perfil", render: (u) => PERFIL_ROTULO[u.perfil] ?? u.perfil },
          {
            chave: "ativo",
            titulo: "Situação",
            render: (u) => (
              <Badge variant={u.ativo ? "success" : "secondary"}>
                {u.ativo ? "Ativo" : "Inativo"}
              </Badge>
            ),
          },
          { chave: "ultimoAcesso", titulo: "Último acesso", className: "num whitespace-nowrap", render: (u) => formatDataHora(u.ultimoAcesso) },
          {
            chave: "acoes",
            titulo: "",
            alinhar: "direita",
            className: "w-24",
            render: (u) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label={`Editar ${u.login}`} onClick={() => setEditando(u)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${u.login}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setExcluindo(u)}
                >
                  <Trash2 />
                </Button>
              </div>
            ),
          },
        ]}
        dados={ordenados}
        chaveLinha={(u) => u.id}
        vazio="Nenhum usuário cadastrado."
      />

      {editando && (
        <DialogUsuario
          usuario={editando === "novo" ? null : editando}
          aoFechar={() => setEditando(null)}
        />
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        aoMudar={(v) => !v && setExcluindo(null)}
        titulo="Excluir usuário?"
        descricao={
          excluindo && (
            <>
              O usuário <strong>{excluindo.login}</strong> ({excluindo.nome}) perderá o acesso ao sistema.
            </>
          )
        }
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluindo && excluir.mutateAsync(excluindo.id)}
      />
    </>
  );
}

function DialogUsuario({ usuario, aoFechar }: { usuario: UsuarioAdmin | null; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const novo = !usuario;
  const [login, setLogin] = useState(usuario?.login ?? "");
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "user");
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novo) {
      const v = validarLogin(login);
      if (v) return setErro(v);
    }
    if (!nome.trim()) return setErro("Informe o nome.");
    if (novo && !senha) return setErro("Informe a senha provisória.");
    if (senha) {
      const v = validarNovaSenha(senha);
      if (v) return setErro(v.replace("A nova senha", "A senha provisória"));
    }
    setOcupado(true);
    try {
      await api.auth.usuarioSalvar({
        ...(usuario ? { id: usuario.id } : {}),
        login: usuario?.login ?? login,
        nome: nome.trim(),
        perfil,
        ativo,
        ...(senha ? { senha } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: chaves.usuarios });
      toast.success(novo ? "Usuário criado." : "Usuário atualizado.");
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !ocupado && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{novo ? "Novo usuário" : `Editar ${usuario.login}`}</DialogTitle>
          <DialogDescription>
            {novo
              ? "O usuário deverá trocar a senha provisória no primeiro acesso."
              : "Informe uma senha apenas se quiser redefini-la (será provisória)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <Field
            rotulo="Login"
            obrigatorio={novo}
            dica={novo ? "3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado. Não pode ser alterado depois." : "O login não pode ser alterado."}
          >
            <Input
              value={login}
              disabled={!novo}
              autoCapitalize="none"
              autoComplete="off"
              maxLength={40}
              className="font-mono"
              onChange={(e) => setLogin(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
            />
          </Field>
          <Field rotulo="Nome" obrigatorio>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 items-end gap-4">
            <Field rotulo="Perfil">
              <Selecao<Perfil>
                value={perfil}
                onChange={setPerfil}
                opcoes={[
                  { valor: "user", rotulo: PERFIL_ROTULO.user },
                  { valor: "admin", rotulo: PERFIL_ROTULO.admin },
                ]}
              />
            </Field>
            <div className="flex h-9 items-center gap-2 max-md:h-11 max-md:gap-3 pointer-coarse:h-11 pointer-coarse:gap-3">
              <Switch id="usuario-ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="usuario-ativo">{ativo ? "Ativo" : "Inativo"}</Label>
            </div>
          </div>
          <Field
            rotulo={novo ? "Senha provisória" : "Nova senha provisória (opcional)"}
            obrigatorio={novo}
            dica={`Mínimo de ${SENHA_MINIMA} caracteres.`}
          >
            <Input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button type="submit" disabled={ocupado}>
              {ocupado && <Loader2 className="animate-spin" />}
              {novo ? "Criar usuário" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
