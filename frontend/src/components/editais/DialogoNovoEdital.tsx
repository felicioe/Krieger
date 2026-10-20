import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { DataInput, Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { dataParaISO, parseData } from "@/lib/format";
import { normalizarCondominio } from "@/domain/condominio";
import { assembleiaPadrao, TIPOS_ASSEMBLEIA, validarAssembleia } from "@/domain/edital";
import type { Assembleia, Condominio, ConfigEscritorio, Exercicio, Modelo } from "@/domain/types";

const SEM_MODELO = "__sem";

export function DialogoNovoEdital({
  aberto,
  aoMudar,
  condominios,
  modelos,
  exercicios,
  escritorio,
  condoInicial = "",
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  condominios: Condominio[];
  modelos: Modelo[];
  exercicios: Exercicio[];
  escritorio: ConfigEscritorio | null;
  condoInicial?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [condoId, setCondoId] = useState(condoInicial);
  const [tipo, setTipo] = useState<Assembleia["tipo"]>("ordinaria");
  const [modeloId, setModeloId] = useState(SEM_MODELO);
  const [data, setData] = useState("");
  const [erros, setErros] = useState<{ condoId?: string; data?: string }>({});

  useEffect(() => {
    if (aberto) {
      setCondoId(condoInicial);
      setTipo("ordinaria");
      setModeloId(modelos.length === 1 ? (modelos[0] as Modelo).id : SEM_MODELO);
      setData("");
      setErros({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, condoInicial]);

  const criar = useMutation({
    mutationFn: (dados: Omit<Assembleia, "id">) => api.salvar<Omit<Assembleia, "id"> & { id?: string }>("assembleias", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("assembleias") });
      queryClient.setQueryData(chaves.item("assembleias", salvo.id), salvo);
      toast.success("Edital criado. Complete os horários e a pauta.");
      aoMudar(false);
      navigate({ to: "/editais/$id", params: { id: salvo.id } });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    // Só condomínio e data são exigidos aqui; o horário é preenchido no formulário completo.
    const v = validarAssembleia({ condoId, data, hora1: "00:00", hora2: "", dataEmissao: "" });
    const e2 = { ...(v.condoId ? { condoId: v.condoId } : {}), ...(v.data ? { data: v.data } : {}) };
    setErros(e2);
    if (Object.keys(e2).length) return;
    const condo = condominios.find((c) => c.id === condoId);
    const d = parseData(data);
    if (!condo || !d) return;
    const ultimo = exercicios
      .filter((x) => x.condoId === condoId)
      .map((x) => Number(x.ano))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a)[0];
    criar.mutate(
      assembleiaPadrao({
        condo: normalizarCondominio(condo),
        tipo,
        data: dataParaISO(d),
        modelo: modelos.find((m) => m.id === modeloId) ?? null,
        cidade: escritorio?.cidade ?? "",
        ...(ultimo ? { exercicio: String(ultimo) } : {}),
      }),
    );
  }

  const opcoesCondo = [...condominios]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ valor: c.id, rotulo: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome }));

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo edital</DialogTitle>
          <DialogDescription>Os demais campos vêm do cadastro do condomínio e podem ser ajustados em seguida.</DialogDescription>
        </DialogHeader>
        <form id="form-novo-edital" onSubmit={enviar} className="grid gap-4" noValidate>
          <Field rotulo="Condomínio" obrigatorio erro={erros.condoId ?? null}>
            <Selecao
              value={condoId}
              onChange={(v) => {
                setCondoId(v);
                setErros((x) => ({ ...(x.data ? { data: x.data } : {}) }));
              }}
              opcoes={opcoesCondo}
              placeholder="Escolha o condomínio"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field rotulo="Tipo">
              <Selecao value={tipo} onChange={setTipo} opcoes={TIPOS_ASSEMBLEIA} />
            </Field>
            <Field rotulo="Data da assembleia" obrigatorio erro={erros.data ?? null}>
              <DataInput
                value={data}
                onChange={(v) => {
                  setData(v);
                  setErros((x) => ({ ...(x.condoId ? { condoId: x.condoId } : {}) }));
                }}
              />
            </Field>
          </div>
          <Field rotulo="Modelo de edital" dica="A pauta padrão do modelo é carregada no edital.">
            <Selecao
              value={modeloId}
              onChange={setModeloId}
              opcoes={[{ valor: SEM_MODELO, rotulo: "Sem modelo" }, ...modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))]}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => aoMudar(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-edital" disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar edital
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
