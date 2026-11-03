import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/Field";
import { SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { formatBRL } from "@/lib/format";
import { api, mensagemErro } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { lerApoliceSeguro } from "@/domain/pdfParser";
import type { Condominio } from "@/domain/types";
import { normalizarCondominio } from "@/domain/condominio";
import { useQueryClient } from "@tanstack/react-query";

export function ImportarApolice({ condominios }: { condominios: Condominio[] }) {
  const entrada = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState<ReturnType<typeof lerApoliceSeguro>>(null);
  const [condoId, setCondoId] = useState("");
  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setLendo(true);
    try {
      const { extrairTextoPdf } = await import("@/lib/pdfTexto");
      const resultado = lerApoliceSeguro(await extrairTextoPdf(arquivo));
      if (!resultado) throw new Error("PDF não reconhecido como apólice Allianz/FIRMO.");
      setLido(resultado);
      toast.success("Apólice reconhecida. Revise o condomínio antes de aplicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : mensagemErro(e));
      setLido(null);
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }
  async function aplicar() {
    const atual = condominios.find((c) => c.id === condoId);
    if (!atual || !lido) return;
    const c = normalizarCondominio(atual);
    await api.salvar("condominios", { ...c, seguradora: lido.seguradora ?? c.seguradora, vigenciaSeguro: lido.vigenciaFim ?? c.vigenciaSeguro, seguro: { riscoAbsoluto: lido.riscoAbsoluto ?? c.seguro.riscoAbsoluto, coberturas: lido.coberturas } });
    await queryClient.invalidateQueries({ queryKey: chaves.store("condominios") });
    toast.success("Dados da apólice aplicados ao cadastro do condomínio.");
    setLido(null);
  }
  return <div className="space-y-3"><Button type="button" variant="outline" onClick={() => entrada.current?.click()} disabled={lendo}><input ref={entrada} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Arquivo PDF da apólice" onChange={(e) => escolher(e.target.files?.[0])} />{lendo ? <Loader2 className="animate-spin" /> : <FileUp />} {lendo ? "Lendo apólice…" : "Escolher apólice (PDF)"}</Button>{lido && <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm"><p><strong>{lido.seguradora ?? "Seguradora não identificada"}</strong>{lido.vigenciaFim && ` · vigência até ${lido.vigenciaFim}`}</p><p>Risco absoluto: <strong>{lido.riscoAbsoluto == null ? "—" : formatBRL(lido.riscoAbsoluto)}</strong> · {lido.coberturas.length} cobertura(s).</p><Field rotulo="Cadastro de destino"><SelecaoBusca value={condoId} onChange={setCondoId} opcoes={opcoesCondominio(condominios)} placeholder="Escolha o condomínio" placeholderBusca="Pesquisar condomínio por nome, código ou CNPJ..." /></Field><Button type="button" onClick={() => void aplicar()} disabled={!condoId}>Aplicar ao cadastro</Button></div>}</div>;
}
