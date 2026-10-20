import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/** Diálogo de confirmação controlado. A ação pode ser assíncrona. */
export function ConfirmDialog({
  aberto,
  aoMudar,
  titulo,
  descricao,
  rotuloConfirmar = "Confirmar",
  destrutivo,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
  rotuloConfirmar?: string;
  destrutivo?: boolean;
  aoConfirmar: () => unknown | Promise<unknown>;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    setOcupado(true);
    try {
      await aoConfirmar();
      aoMudar(false);
    } catch {
      /* a mensagem de erro é exibida por quem chamou (toast) */
    } finally {
      setOcupado(false);
    }
  }

  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !ocupado && aoMudar(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descricao && <AlertDialogDescription asChild><div>{descricao}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
          <Button variant={destrutivo ? "destructive" : "default"} onClick={confirmar} disabled={ocupado}>
            {ocupado && <Loader2 className="animate-spin" />}
            {rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
