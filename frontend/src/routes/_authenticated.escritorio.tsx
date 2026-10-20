import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { api, mensagemErro } from "@/lib/api";
import { chaves, itemQuery } from "@/lib/queries";
import { redimensionarImagem } from "@/lib/imagem";
import { cabecalho } from "@/lib/head";
import type { ConfigEscritorio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/escritorio")({
  head: () => cabecalho("Escritório", "Dados do escritório usados nos relatórios e editais."),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
  component: Escritorio,
});

const VAZIO: ConfigEscritorio = { id: "escritorio", nome: "", cidade: "", rodape: "", assinatura: "", logo: "", logoRatio: null };

function Escritorio() {
  const { data } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  return <FormEscritorio inicial={{ ...VAZIO, ...(data ?? {}), id: "escritorio" }} />;
}

function FormEscritorio({ inicial }: { inicial: ConfigEscritorio }) {
  const queryClient = useQueryClient();
  const [e, setE] = useState<ConfigEscritorio>(inicial);
  const [processando, setProcessando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ConfigEscritorio>(k: K, v: ConfigEscritorio[K]) => setE((x) => ({ ...x, [k]: v }));

  const salvar = useMutation({
    mutationFn: (dados: ConfigEscritorio) => api.salvar("config", dados),
    onSuccess: (salvo) => {
      queryClient.setQueryData(chaves.item("config", "escritorio"), salvo);
      queryClient.invalidateQueries({ queryKey: chaves.store("config") });
      toast.success("Dados do escritório salvos.");
    },
  });

  async function escolherLogo(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem (PNG ou JPG).");
      return;
    }
    setProcessando(true);
    try {
      const { dataUrl, ratio } = await redimensionarImagem(f, 900);
      setE((x) => ({ ...x, logo: dataUrl, logoRatio: Number(ratio.toFixed(4)) }));
    } catch (err) {
      toast.error(mensagemErro(err));
    } finally {
      setProcessando(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    salvar.mutate(e);
  }

  return (
    <>
      <PageHeader
        titulo="Escritório"
        descricao="Estes dados aparecem no cabeçalho, rodapé e assinatura dos documentos."
        acoes={
          <Button type="submit" form="form-escritorio" disabled={salvar.isPending}>
            {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar
          </Button>
        }
      />
      <form id="form-escritorio" onSubmit={enviar} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <SectionCard titulo="Identificação">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field rotulo="Nome do escritório">
                <Input value={e.nome} onChange={(x) => set("nome", x.target.value)} />
              </Field>
              <Field rotulo="Cidade" dica="Usada na data de emissão dos documentos.">
                <Input value={e.cidade} onChange={(x) => set("cidade", x.target.value)} />
              </Field>
            </div>
            <Field rotulo="Rodapé">
              <Input value={e.rodape} onChange={(x) => set("rodape", x.target.value)} placeholder="Endereço, telefone, e-mail…" />
            </Field>
            <Field rotulo="Assinatura" dica="Uma informação por linha (nome, cargo, registro profissional…).">
              <Textarea rows={5} value={e.assinatura} onChange={(x) => set("assinatura", x.target.value)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard titulo="Logotipo" descricao="Reduzido automaticamente a no máximo 900 px de largura.">
          <div className="grid gap-3">
            <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed bg-muted/40 p-4">
              {e.logo ? (
                <img src={e.logo} alt="Logotipo do escritório" className="max-h-32 max-w-full object-contain" />
              ) : (
                <span className="text-sm text-muted-foreground">Nenhum logotipo</span>
              )}
            </div>
            <input
              ref={arquivo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(x) => escolherLogo(x.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => arquivo.current?.click()} disabled={processando}>
                {processando ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {e.logo ? "Trocar imagem" : "Escolher imagem"}
              </Button>
              {e.logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setE((x) => ({ ...x, logo: "", logoRatio: null }))}>
                  <X /> Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Lembre-se de salvar após trocar o logotipo.</p>
          </div>
        </SectionCard>
      </form>
    </>
  );
}
