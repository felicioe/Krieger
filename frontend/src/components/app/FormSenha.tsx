import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "./Field";
import { api, mensagemErro } from "@/lib/api";
import { SENHA_MINIMA, validarNovaSenha } from "@/domain/usuario";

/** Formulário de troca de senha (senha atual, nova e confirmação). */
export function FormSenha({ aoConcluir, rotulo = "Alterar senha" }: { aoConcluir: () => void | Promise<void>; rotulo?: string }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!atual) return setErro("Informe a senha atual.");
    const v = validarNovaSenha(nova, confirmacao);
    if (v) return setErro(v);
    setOcupado(true);
    try {
      await api.auth.minhaSenha(atual, nova);
      setAtual("");
      setNova("");
      setConfirmacao("");
      await aoConcluir();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Field rotulo="Senha atual" obrigatorio>
        <Input type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />
      </Field>
      <Field rotulo="Nova senha" obrigatorio dica={`Mínimo de ${SENHA_MINIMA} caracteres.`}>
        <Input type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
      </Field>
      <Field rotulo="Confirme a nova senha" obrigatorio>
        <Input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
      </Field>
      <div>
        <Button type="submit" disabled={ocupado}>
          {ocupado && <Loader2 className="animate-spin" />}
          {rotulo}
        </Button>
      </div>
    </form>
  );
}
