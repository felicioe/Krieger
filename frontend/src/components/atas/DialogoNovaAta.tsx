import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { formatData } from "@/lib/format";
import { normalizarCondominio } from "@/domain/condominio";
import { normalizarAssembleia, rotuloTipo } from "@/domain/edital";
import { ataDoEdital, ataEmBranco, novaAtaDeAssembleia, validarNovaAta } from "@/domain/ata";
import type { Assembleia, Ata, Condominio } from "@/domain/types";

const SEM_EDITAL = "__sem";

export function DialogoNovaAta({
  aberto,
  aoMudar,
  condominios,
  assembleias,
  atas,
  condoInicial = "",
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  condominios: Condominio[];
  assembleias: Assembleia[];
  atas: Ata[];
  condoInicial?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [condoId, setCondoId] = useState(condoInicial);
  const [editalId, setEditalId] = useState(SEM_EDITAL);
  const [erro, setErro] = useState<string | null>(null);

  /** Editais do condomínio que ainda não têm ata, do mais recente ao mais antigo. */
  const editaisLivres = (id: string) =>
    assembleias
      .filter((a) => a.condoId === id && !ataDoEdital(a.id, atas))
      .sort((a, b) => b.data.localeCompare(a.data));

  const escolherCondo = (id: string) => {
    setCondoId(id);
    setEditalId(editaisLivres(id)[0]?.id ?? SEM_EDITAL);
    setErro(null);
  };

  useEffect(() => {
    if (aberto) escolherCondo(condoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, condoInicial]);

  const livres = useMemo(() => (condoId ? editaisLivres(condoId) : []), [condoId, assembleias, atas]); // eslint-disable-line react-hooks/exhaustive-deps
  const comAta = condoId ? assembleias.filter((a) => a.condoId === condoId).length - livres.length : 0;

  const criar = useMutation({
    mutationFn: (dados: Omit<Ata, "id">) => api.salvar<Omit<Ata, "id"> & { id?: string }>("atas", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("atas") });
      queryClient.setQueryData(chaves.item("atas", salvo.id), salvo);
      toast.success("Ata criada.");
      aoMudar(false);
      navigate({ to: "/atas/$id", params: { id: salvo.id } });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const condo = condominios.find((c) => c.id === condoId);
    if (!condo) return setErro("Escolha o condomínio.");
    const edital = assembleias.find((a) => a.id === editalId);
    if (edital) {
      const msg = validarNovaAta(edital.id, atas);
      if (msg) return setErro(msg);
    }
    setErro(null);
    const c = normalizarCondominio(condo);
    criar.mutate(edital ? novaAtaDeAssembleia(normalizarAssembleia(edital), c) : ataEmBranco(c));
  }

  const opcoesCondo = [...condominios]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ valor: c.id, rotulo: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome }));
  const opcoesEdital = [
    ...livres.map((a) => ({ valor: a.id, rotulo: `${formatData(a.data)} · ${rotuloTipo(a.tipo)}` })),
    { valor: SEM_EDITAL, rotulo: "Sem edital" },
  ];

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova ata</DialogTitle>
          <DialogDescription>Com um edital, a ata já vem com data, horário, local e um item para cada linha da pauta.</DialogDescription>
        </DialogHeader>
        <form id="form-nova-ata" onSubmit={enviar} className="grid gap-4" noValidate>
          {erro && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <Field rotulo="Condomínio" obrigatorio>
            <Selecao value={condoId} onChange={escolherCondo} opcoes={opcoesCondo} placeholder="Escolha o condomínio" />
          </Field>
          {condoId && (
            <Field
              rotulo="Edital"
              {...(comAta > 0 ? { dica: `${comAta} ${comAta === 1 ? "edital deste condomínio já tem ata" : "editais deste condomínio já têm ata"} e não aparece${comAta === 1 ? "" : "m"} aqui.` } : {})}
            >
              <Selecao value={editalId} onChange={setEditalId} opcoes={opcoesEdital} />
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => aoMudar(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nova-ata" disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar ata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
