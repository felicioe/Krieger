import { useState } from "react";
import { Link } from "@/components/app/LinkPermitido";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable } from "@/components/app/DataTable";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { ROTULO_TIPO_ANEXO, textoPeriodo } from "./anexos";
import { api, mensagemErro } from "@/lib/api";
import { dataUrlParaBlob } from "@/lib/arquivo";
import { salvarArquivo } from "@/lib/documento/baixar";
import { formatBytes, formatDataHora } from "@/lib/format";
import { chaves } from "@/lib/queries";
import type { AnexoImportado } from "@/domain/types";
import type { MetadadosAnexoImportado } from "@/lib/apiTypes";

export const anexosQuery = (exercicioId: string) => queryOptions({
  queryKey: [...chaves.store("anexos_importacao"), "metadados", exercicioId],
  queryFn: () => api.anexos.listar(exercicioId),
});

async function baixar(a: MetadadosAnexoImportado) {
  try {
    const completo = await api.obter<AnexoImportado>("anexos_importacao", a.id);
    if (!completo?.arquivoDataUrl) throw new Error("Arquivo indisponível. Atualize a lista e tente novamente.");
    salvarArquivo(await dataUrlParaBlob(completo.arquivoDataUrl), a.arquivo || "comparativo.pdf");
  } catch (e) {
    toast.error(`Não foi possível baixar o PDF: ${mensagemErro(e)}`);
  }
}

/** PDFs anexados a esta prestação de contas pelo Importador (referência, não mexem no demonstrativo). */
export function AnexosPrestacao({ exercicioId }: { exercicioId: string }) {
  const queryClient = useQueryClient();
  const { data: metadados } = useSuspenseQuery(anexosQuery(exercicioId));
  const anexos = [...metadados].sort((a, b) => b.importadoEm.localeCompare(a.importadoEm));
  const [excluindo, setExcluindo] = useState<MetadadosAnexoImportado | null>(null);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const excluir = useMutation({
    mutationFn: (a: MetadadosAnexoImportado) => api.excluir("anexos_importacao", a.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.store("anexos_importacao") });
      toast.success("Anexo excluído.");
    },
  });

  return (
    <SectionCard
      titulo="Anexos de referência"
      descricao="PDFs anexados pelo Importador, como o Comparativo Financeiro. Ficam só para consulta e download; não alteram o demonstrativo."
      acoes={
        <Button variant="outline" size="sm" asChild>
          <Link to="/importador">
            <FileUp /> Anexar comparativo
          </Link>
        </Button>
      }
    >
      <DataTable<MetadadosAnexoImportado>
        colunas={[
          {
            chave: "arquivo",
            titulo: "Arquivo",
            render: (a) => (
              <span className="block min-w-0 break-words">
                <span className="font-medium">{a.arquivo || "Sem nome"}</span>
                <span className="block text-xs text-muted-foreground">
                  {ROTULO_TIPO_ANEXO[a.tipo] ?? a.tipo}
                  {a.temArquivo ? ` · ${formatBytes(a.arquivoBytes)}` : ""}
                </span>
              </span>
            ),
          },
          { chave: "periodo", titulo: "Período", className: "whitespace-nowrap", render: (a) => <span className="num">{textoPeriodo(a.relatorio)}</span> },
          { chave: "importadoEm", titulo: "Anexado em", className: "whitespace-nowrap", render: (a) => <span className="num">{formatDataHora(a.importadoEm)}</span> },
          {
            chave: "acoes",
            titulo: "Ações",
            className: "w-px whitespace-nowrap",
            render: (a) => (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (baixandoId) return;
                    setBaixandoId(a.id);
                    try { await baixar(a); } finally { setBaixandoId(null); }
                  }}
                  disabled={!a.temArquivo || !!baixandoId}
                  aria-label={`Baixar ${a.arquivo}`}
                >
                  <Download /> {baixandoId === a.id ? "Baixando…" : "Baixar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setExcluindo(a)}
                  aria-label={`Excluir anexo ${a.arquivo}`}
                >
                  <Trash2 /> Excluir
                </Button>
              </div>
            ),
          },
        ]}
        dados={anexos}
        chaveLinha={(a) => a.id}
        vazio="Nenhum PDF anexado. Use o Importador para anexar o Comparativo Financeiro."
      />
      <ConfirmDialog
        aberto={!!excluindo}
        aoMudar={(v) => !v && setExcluindo(null)}
        titulo="Excluir anexo?"
        descricao={`O arquivo ${excluindo?.arquivo ?? ""} será retirado desta prestação de contas. O demonstrativo não muda. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={async () => {
          if (excluindo) await excluir.mutateAsync(excluindo);
          setExcluindo(null);
        }}
      />
    </SectionCard>
  );
}
