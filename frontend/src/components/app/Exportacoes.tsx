import { useState } from "react";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Printer,
} from "lucide-react";
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
import { baixarDocumento, type Formato } from "@/lib/documento/baixar";
import type { Documento } from "@/lib/documento/tipos";

/**
 * Menu único de saída de todas as telas com exportação. A lista é fixa: PDF e Word (quando a tela
 * tem documento), XLSX e Imprimir (A4 paisagem). Cada tela só informa quais saídas oferece; o menu
 * não conhece colunas, dados nem layout.
 */
export type OpcaoDocumento = {
  /** Nome do documento. Com mais de um na mesma tela, aparece como título de grupo. */
  rotulo: string;
  gerar: () => Documento | Promise<Documento>;
  /** Motivo para não gerar este documento; no lugar das opções aparece o texto. */
  bloqueio?: string | null;
};

export type AcoesExportacao = {
  documentos?: OpcaoDocumento[];
  xlsx?: () => Promise<void> | void;
  /** Devolve `false` quando o navegador bloqueia a janela de impressão. */
  imprimir?: () => boolean | void;
};

export function Exportacoes({
  acoes,
  bloqueio,
  rotulo = "Exportar",
}: {
  acoes: AcoesExportacao;
  /** Motivo para desabilitar o menu inteiro (ex.: sem dados no período). Vazio libera. */
  bloqueio?: string | null;
  rotulo?: string;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const documentos = acoes.documentos ?? [];
  const agrupado = documentos.length > 1;

  async function executar(chave: string, fn: () => Promise<void> | void) {
    if (ocupado) return;
    setOcupado(chave);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setOcupado(null);
    }
  }

  function imprimir() {
    if (!acoes.imprimir) return;
    const abriu = acoes.imprimir();
    if (abriu === false) {
      toast.error(
        "O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.",
      );
    }
  }

  async function baixar(d: OpcaoDocumento, formato: Formato) {
    await executar(`${d.rotulo}:${formato}`, async () => {
      await baixarDocumento(await d.gerar(), formato);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          type="button"
          disabled={!!bloqueio || ocupado !== null}
          title={bloqueio ?? undefined}
        >
          {ocupado ? <Loader2 className="animate-spin" /> : <Download />}
          {ocupado ? "Gerando…" : rotulo}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {documentos.map((d) => (
          <div key={d.rotulo}>
            {agrupado && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {d.rotulo}
              </DropdownMenuLabel>
            )}
            {d.bloqueio ? (
              <p className="px-2 pb-1.5 text-xs text-muted-foreground">{d.bloqueio}</p>
            ) : (
              <>
                <DropdownMenuItem
                  disabled={!!ocupado}
                  onSelect={() => void baixar(d, "pdf")}
                  aria-label={`${d.rotulo} em PDF`}
                >
                  <FileText /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!!ocupado}
                  onSelect={() => void baixar(d, "docx")}
                  aria-label={`${d.rotulo} em Word`}
                >
                  <FileType2 /> Word (.docx)
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
          </div>
        ))}
        {acoes.xlsx && (
          <DropdownMenuItem
            disabled={!!ocupado}
            onSelect={() => void executar("xlsx", acoes.xlsx!)}
          >
            <FileSpreadsheet /> Planilha (XLSX)
          </DropdownMenuItem>
        )}
        {acoes.imprimir && (
          <DropdownMenuItem disabled={!!ocupado} onSelect={imprimir}>
            <Printer /> Imprimir (A4 paisagem)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
