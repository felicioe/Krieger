import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { modeloAtaPadrao, validarModeloAta } from "@/domain/modeloAta";
import type { ModeloAta } from "@/domain/types";

export function DialogoNovoModeloAta({
  aberto,
  aoMudar,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: (dados: Omit<ModeloAta, "id">) => api.salvar<Omit<ModeloAta, "id"> & { id?: string }>("modelos_ata", dados),
    onSuccess: async (salvo) => {
      await queryClient.invalidateQueries({ queryKey: chaves.store("modelos_ata") });
      queryClient.setQueryData(chaves.item("modelos_ata", salvo.id), salvo);
      toast.success("Modelo de ata criado.");
      aoMudar(false);
      navigate({ to: "/modelos-ata/$id", params: { id: salvo.id } });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o modelo.");
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const base = modeloAtaPadrao(nome);
    const erros = validarModeloAta(base);
    if (erros.nome) {
      setErro(erros.nome);
      return;
    }
    criar.mutate(base);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) { setErro(null); setNome(""); } aoMudar(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo modelo de ata</DialogTitle>
          <DialogDescription>O modelo poderá ser ajustado depois com cidade, cartório e texto.</DialogDescription>
        </DialogHeader>
        <form id="form-novo-modelo-ata" onSubmit={submit} className="space-y-4">
          <Field rotulo="Nome" erro={erro}>
            <Input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErro(null);
              }}
              placeholder="Ex.: Ata padrão Florianópolis"
              autoFocus
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => aoMudar(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-modelo-ata" disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}