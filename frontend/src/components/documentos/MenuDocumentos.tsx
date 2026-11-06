import { Fragment, useState } from "react";
import { ChevronDown, FileDown, FileText, FileType2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { baixarDocumento, ROTULO_FORMATO, type Formato } from "@/lib/documento/baixar";
import type { Documento } from "@/lib/documento/tipos";

export interface OpcaoDocumento {
  rotulo: string;
  gerar: () => Documento | Promise<Documento>;
  /** motivo para não gerar (mostrado no lugar das opções) */
  bloqueio?: string | null;
}

/** Um botão com vários documentos, cada um em PDF ou Word. `bloqueio` geral desabilita o botão. */
export function MenuDocumentos({
  documentos,
  bloqueio,
  rotulo = "Documentos",
}: {
  documentos: OpcaoDocumento[];
  bloqueio?: string | null;
  rotulo?: string;
}) {
  const [gerando, setGerando] = useState<string | null>(null);

  async function baixar(d: OpcaoDocumento, formato: Formato) {
    setGerando(d.rotulo);
    try {
      await baixarDocumento(await d.gerar(), formato);
      toast.success(`${d.rotulo} gerado(a) em ${ROTULO_FORMATO[formato]}.`);
    } catch (e) {
      console.error(e);
      toast.error(`Não foi possível gerar: ${d.rotulo}. Tente novamente.`);
    } finally {
      setGerando(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" type="button" disabled={!!bloqueio || gerando !== null} title={bloqueio ?? undefined}>
          {gerando ? <Loader2 className="animate-spin" /> : <FileDown />}
          {gerando ? `Gerando ${gerando.toLowerCase()}…` : rotulo}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {documentos.map((d, i) => (
          <Fragment key={d.rotulo}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{d.rotulo}</DropdownMenuLabel>
            {d.bloqueio ? (
              <p className="px-2 pb-1.5 text-xs text-muted-foreground">{d.bloqueio}</p>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => baixar(d, "pdf")} aria-label={`${d.rotulo} em PDF`}>
                  <FileText /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => baixar(d, "docx")} aria-label={`${d.rotulo} em Word`}>
                  <FileType2 /> Word (.docx)
                </DropdownMenuItem>
              </>
            )}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
