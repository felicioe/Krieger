import { useState } from "react";
import { ChevronDown, FileDown, FileText, FileType2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { baixarDocumento, ROTULO_FORMATO, type Formato } from "@/lib/documento/baixar";
import type { Documento } from "@/lib/documento/tipos";

/** Botão "Gerar documento" com escolha PDF / Word. `bloqueio` desabilita e explica o motivo. */
export function BotaoDocumento({
  gerar,
  bloqueio,
  rotulo = "Gerar documento",
}: {
  gerar: () => Documento | Promise<Documento>;
  bloqueio?: string | null;
  rotulo?: string;
}) {
  const [gerando, setGerando] = useState<Formato | null>(null);

  async function baixar(formato: Formato) {
    setGerando(formato);
    try {
      await baixarDocumento(await gerar(), formato);
      toast.success(`${ROTULO_FORMATO[formato]} gerado.`);
    } catch (e) {
      console.error(e);
      toast.error(`Não foi possível gerar o ${ROTULO_FORMATO[formato]}. Tente novamente.`);
    } finally {
      setGerando(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" type="button" disabled={!!bloqueio || gerando !== null} title={bloqueio ?? undefined}>
          {gerando ? <Loader2 className="animate-spin" /> : <FileDown />}
          {gerando ? `Gerando ${ROTULO_FORMATO[gerando]}…` : rotulo}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => baixar("pdf")}>
          <FileText /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => baixar("docx")}>
          <FileType2 /> Word (.docx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
