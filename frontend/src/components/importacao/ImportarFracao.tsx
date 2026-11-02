import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, mensagemErro } from "@/lib/api";
import { lerListagemFracao } from "@/domain/pdfParser";
import type { Condominio } from "@/domain/types";
import { extrairTextoPdf } from "@/lib/pdfTexto";

export function ImportarFracao({ condominios }: { condominios: Condominio[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false); const [lendo, setLendo] = useState(false); const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<{ arquivo: string; rel: ReturnType<typeof lerListagemFracao> } | null>(null); const [condoId, setCondoId] = useState("");
  async function escolher(file: File | undefined) {
    if (!file) return; setAberto(true); setLendo(true); setErro(null); setLido(null);
    try { const rel = lerListagemFracao(await extrairTextoPdf(file)); if (!rel.unidades.length) throw new Error("Não encontrei linhas de unidades e frações neste PDF."); setLido({ arquivo: file.name, rel }); }
    catch (e) { setErro(mensagemErro(e)); } finally { setLendo(false); if (input.current) input.current.value = ""; }
  }
  async function aplicar() {
    if (!lido || !condoId) return; const c = condominios.find((x) => x.id === condoId); if (!c) return;
    if (!window.confirm(`Substituir a relação de unidades de ${c.nome} por ${lido.rel.unidades.length} unidades?`)) return;
    await api.salvar("condominios", { ...c, fracaoUnidades: lido.rel.unidades, unidades: lido.rel.unidades.length });
    toast.success("Unidades e frações importadas no cadastro."); setAberto(false); window.location.reload();
  }
  return <><Button variant="outline" onClick={() => input.current?.click()}><FileUp /> Importar relatório de fração</Button><input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
    <Dialog open={aberto} onOpenChange={setAberto}><DialogContent><DialogHeader><DialogTitle>Importar unidades e frações</DialogTitle></DialogHeader>
      {lendo && <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Lendo o PDF…</p>}{erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
      {lido && <div className="space-y-3 text-sm"><p><strong>{lido.rel.unidades.length}</strong> unidades encontradas em <strong>{lido.rel.condominio ?? "condomínio não identificado"}</strong>.</p><label className="block"><span className="text-xs text-muted-foreground">Cadastro de destino</span><select className="mt-1 w-full rounded-md border bg-background p-2" value={condoId} onChange={(e) => setCondoId(e.target.value)}><option value="">Escolha o condomínio</option>{condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><p className="text-xs text-muted-foreground">Nomes de proprietários ou inquilinos não são importados.</p></div>}
      <DialogFooter>{lido && <Button onClick={aplicar} disabled={!condoId}>Aplicar no cadastro</Button>}<Button variant="outline" onClick={() => setAberto(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog></>;
}
