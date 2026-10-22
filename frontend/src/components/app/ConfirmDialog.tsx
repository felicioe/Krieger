import { useRef, useState, type ReactNode } from "react";
import { ID_CONTEUDO } from "./foco";
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
  rotuloCancelar = "Cancelar",
  destrutivo,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  destrutivo?: boolean;
  aoConfirmar: () => unknown | Promise<unknown>;
}) {
  const [ocupado, setOcupado] = useState(false);
  // A janela é aberta por estado (sem acionador próprio): guarda quem tinha o foco para devolvê-lo.
  const origem = useRef<Element | null>(null);

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
      <AlertDialogContent
        onOpenAutoFocus={() => {
          origem.current = document.activeElement;
        }}
        onCloseAutoFocus={(ev) => {
          ev.preventDefault();
          const o = origem.current;
          origem.current = null;
          // Se o controle de origem saiu da tela (ex.: página trocada), o foco vai para o conteúdo.
          if (o instanceof HTMLElement && o.isConnected) o.focus();
          else document.getElementById(ID_CONTEUDO)?.focus({ preventScroll: true });
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descricao && <AlertDialogDescription asChild><div>{descricao}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ocupado}>{rotuloCancelar}</AlertDialogCancel>
          <Button variant={destrutivo ? "destructive" : "default"} onClick={confirmar} disabled={ocupado}>
            {ocupado && <Loader2 className="animate-spin" />}
            {rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
