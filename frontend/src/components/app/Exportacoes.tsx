import { useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Menu único de saída dos relatórios: CSV, XLSX, impressão A4 paisagem e, quando o módulo tem
 * documento próprio, PDF/Word. Cada tela passa só as ações que sabe executar — o menu não conhece
 * as colunas nem os dados.
 */
export type AcoesExportacao = {
  csv?: () => void;
  xlsx?: () => Promise<void> | void;
  /** Devolve `false` quando o navegador bloqueia a janela de impressão. */
  imprimir?: () => boolean | void;
  /** PDF/Word com o timbre do escritório; carrega a biblioteca só ao usar. */
  documento?: () => Promise<void> | void;
  rotuloDocumento?: string;
};

export function Exportacoes({
  acoes,
  bloqueio,
  rotulo = "Exportar",
}: {
  acoes: AcoesExportacao;
  /** Motivo para desabilitar (ex.: sem dados no período). Vazio libera. */
  bloqueio?: string | null;
  rotulo?: string;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);

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
          {rotulo}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {acoes.documento && (
          <>
            <DropdownMenuItem
              disabled={!!ocupado}
              onSelect={() => void executar("documento", acoes.documento!)}
            >
              <FileText /> {acoes.rotuloDocumento ?? "PDF / Word"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {acoes.xlsx && (
          <DropdownMenuItem
            disabled={!!ocupado}
            onSelect={() => void executar("xlsx", acoes.xlsx!)}
          >
            <FileSpreadsheet /> Planilha (XLSX)
          </DropdownMenuItem>
        )}
        {acoes.csv && (
          <DropdownMenuItem disabled={!!ocupado} onSelect={() => void executar("csv", acoes.csv!)}>
            <Download /> CSV
          </DropdownMenuItem>
        )}
        {acoes.imprimir && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!!ocupado} onSelect={imprimir}>
              <Printer /> Imprimir (A4 paisagem)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
