import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { Selecao, SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { modeloPadrao, validarModelo } from "@/domain/modelo";
import type { Condominio, Modelo } from "@/domain/types";

const EM_BRANCO = "__branco";
/** Modelo sem condomínio: serve a todos (é o que já existia antes do modelo por condomínio). */
const GERAL = "__geral";

export function DialogoNovoModelo({
  aberto,
  aoMudar,
  modelos,
  condominios,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  modelos: Modelo[];
  condominios: Condominio[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [condoId, setCondoId] = useState(GERAL);
  const [base, setBase] = useState(EM_BRANCO);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setNome("");
      setCondoId(GERAL);
      setBase(EM_BRANCO);
      setErro(null);
    }
  }, [aberto]);

  const criar = useMutation({
    mutationFn: (dados: Omit<Modelo, "id">) => api.salvar<Omit<Modelo, "id"> & { id?: string }>("modelos", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("modelos") });
      queryClient.setQueryData(chaves.item("modelos", salvo.id), salvo);
      toast.success("Modelo criado.");
      aoMudar(false);
      navigate({ to: "/modelos/$id", params: { id: salvo.id } });
    },
  });

  const opcoesCondo = [{ valor: GERAL, rotulo: "Geral (todos os condomínios)", busca: "geral todos" }, ...opcoesCondominio(condominios)];

  function enviar(e: FormEvent) {
    e.preventDefault();
    const msg = validarModelo({ nome });
    if (msg) return setErro(msg);
    criar.mutate(modeloPadrao(nome, modelos.find((m) => m.id === base) ?? null, condoId === GERAL ? "" : condoId));
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo modelo de edital</DialogTitle>
          <DialogDescription>Comece em branco ou copie os blocos e a pauta de um modelo existente. O condomínio define a quem o modelo se aplica.</DialogDescription>
        </DialogHeader>
        <form id="form-novo-modelo" onSubmit={enviar} className="grid gap-4" noValidate>
          <Field rotulo="Nome do modelo" obrigatorio erro={erro}>
            <Input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErro(null);
              }}
              placeholder="Ex.: Edital padrão"
              autoFocus
            />
          </Field>
          <Field rotulo="Condomínio" dica="O modelo fica disponível para este condomínio; “Geral” serve a todos.">
            <SelecaoBusca value={condoId} onChange={setCondoId} opcoes={opcoesCondo} placeholder="Escolha o condomínio" />
          </Field>
          <Field rotulo="Começar a partir de">
            <Selecao
              value={base}
              onChange={setBase}
              opcoes={[{ valor: EM_BRANCO, rotulo: "Modelo em branco" }, ...modelos.map((m) => ({ valor: m.id, rotulo: `Cópia de ${m.nome}` }))]}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => aoMudar(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-modelo" disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
