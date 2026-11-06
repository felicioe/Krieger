import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/app/Field";
import type { Usuario } from "@/domain/types";
import { api, mensagemErro } from "@/lib/api";
import { CampoSenha } from "./CampoSenha";

/**
 * Formulário de entrada. Usuário e senha são obrigatórios (`Field` → `aria-required`);
 * campo vazio fica marcado (`aria-invalid` + mensagem ligada) e recebe o foco. Falha do
 * servidor aparece num alerta, a senha é apagada e o foco volta para ela. Enquanto envia,
 * o botão fica desabilitado e um segundo envio é ignorado.
 */
export function FormEntrar({ aoEntrar }: { aoEntrar: (u: Usuario) => void }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [faltaLogin, setFaltaLogin] = useState(false);
  const [faltaSenha, setFaltaSenha] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const refLogin = useRef<HTMLInputElement>(null);
  const refSenha = useRef<HTMLInputElement>(null);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setErro(null);
    const semLogin = !login.trim();
    const semSenha = !senha;
    setFaltaLogin(semLogin);
    setFaltaSenha(semSenha);
    if (semLogin) return refLogin.current?.focus();
    if (semSenha) return refSenha.current?.focus();
    setOcupado(true);
    try {
      const u = await api.auth.entrar(login.trim().toLowerCase(), senha);
      aoEntrar(u);
    } catch (err) {
      setErro(mensagemErro(err));
      setTentativa((t) => t + 1);
      setSenha("");
      setOcupado(false);
      requestAnimationFrame(() => refSenha.current?.focus());
      return;
    }
    setOcupado(false);
  }

  return (
    <form onSubmit={entrar} className="grid gap-4" aria-busy={ocupado || undefined} noValidate>
      {erro && (
        // A chave muda a cada falha para o alerta ser anunciado de novo, mesmo com o mesmo texto.
        <Alert key={tentativa} variant="destructive">
          <AlertDescription className="break-words">{erro}</AlertDescription>
        </Alert>
      )}
      <Field rotulo="Usuário" obrigatorio erro={faltaLogin ? "Informe o usuário." : null}>
        <Input
          ref={refLogin}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={login}
          onChange={(e) => {
            setLogin(e.target.value);
            if (faltaLogin && e.target.value.trim()) setFaltaLogin(false);
          }}
        />
      </Field>
      <Field rotulo="Senha" obrigatorio erro={faltaSenha ? "Informe a senha." : null}>
        <CampoSenha
          ref={refSenha}
          autoComplete="current-password"
          value={senha}
          onChange={(e) => {
            setSenha(e.target.value);
            if (faltaSenha && e.target.value) setFaltaSenha(false);
          }}
        />
      </Field>
      <Button type="submit" disabled={ocupado} className="mt-2 w-full">
        {ocupado && <Loader2 className="animate-spin" aria-hidden="true" />}
        {ocupado ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
