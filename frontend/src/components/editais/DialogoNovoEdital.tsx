import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { DataInput, Selecao, SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { dataParaISO, parseData } from "@/lib/format";
import { normalizarCondominio } from "@/domain/condominio";
import { assembleiaPadrao, TIPOS_ASSEMBLEIA, validarAssembleia } from "@/domain/edital";
import { cidadeDoModeloEdital, escolherModeloEdital, modelosDoEdital } from "@/domain/modelo";
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
      // Modelo do condomínio para o tipo escolhido, com o da cidade dele na frente.
      const cond = condominios.find((c) => c.id === condoInicial);
      const iniciais = modelosDoEdital(
        modelos,
        condoInicial,
        cidadeDoModeloEdital(cond?.enderecoEdital ?? ""),
        "ordinaria",
      );
      setModeloId(
        escolherModeloEdital(
          iniciais,
          cidadeDoModeloEdital(cond?.enderecoEdital ?? ""),
          "ordinaria",
        )?.id ?? SEM_MODELO,
      );
      setData("");
      setErros({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, condoInicial]);

  const criar = useMutation({
    mutationFn: (dados: Omit<Assembleia, "id">) =>
      api.salvar<Omit<Assembleia, "id"> & { id?: string }>("assembleias", dados),
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
    const e2 = {
      ...(v.condoId ? { condoId: v.condoId } : {}),
      ...(v.data ? { data: v.data } : {}),
    };
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
        modelo: disponiveis.find((m) => m.id === modeloId) ?? null,
        cidade: escritorio?.cidade ?? "",
        ...(ultimo ? { exercicio: String(ultimo) } : {}),
      }),
    );
  }

  const opcoesCondo = opcoesCondominio(condominios);
  // Cidade do condomínio escolhido: o modelo padrão daquela cidade vem primeiro.
  const cidadeCondo = cidadeDoModeloEdital(
    condominios.find((c) => c.id === condoId)?.enderecoEdital ?? "",
  );
  // Trocar o condomínio ou o tipo troca a lista; a escolha atual só permanece se continuar válida.
  const disponiveis = modelosDoEdital(modelos, condoId, cidadeCondo, tipo);
  const escolherTipo = (v: Assembleia["tipo"]) => {
    setTipo(v);
    const lista = modelosDoEdital(modelos, condoId, cidadeCondo, v);
    setModeloId((atual) =>
      lista.some((m) => m.id === atual)
        ? atual
        : (escolherModeloEdital(lista, cidadeCondo, v)?.id ?? SEM_MODELO),
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo edital</DialogTitle>
          <DialogDescription>
            Os demais campos vêm do cadastro do condomínio e podem ser ajustados em seguida.
          </DialogDescription>
        </DialogHeader>
        <form id="form-novo-edital" onSubmit={enviar} className="grid gap-4" noValidate>
          <Field rotulo="Condomínio" obrigatorio erro={erros.condoId ?? null}>
            <SelecaoBusca
              value={condoId}
              onChange={(v) => {
                setCondoId(v);
                setErros((x) => ({ ...(x.data ? { data: x.data } : {}) }));
                const cidade = cidadeDoModeloEdital(
                  condominios.find((c) => c.id === v)?.enderecoEdital ?? "",
                );
                const paraEste = modelosDoEdital(modelos, v, cidade, tipo);
                setModeloId((atual) =>
                  paraEste.some((m) => m.id === atual)
                    ? atual
                    : (escolherModeloEdital(paraEste, cidade, tipo)?.id ?? SEM_MODELO),
                );
              }}
              opcoes={opcoesCondo}
              placeholder="Escolha o condomínio"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field rotulo="Tipo">
              <Selecao value={tipo} onChange={escolherTipo} opcoes={TIPOS_ASSEMBLEIA} />
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
          <Field
            rotulo="Modelo de edital"
            dica="Só aparecem os modelos deste condomínio e os gerais, compatíveis com o tipo escolhido; o da cidade do condomínio vem primeiro."
          >
            <Selecao
              value={modeloId}
              onChange={setModeloId}
              opcoes={[
                { valor: SEM_MODELO, rotulo: "Sem modelo" },
                ...disponiveis.map((m) => ({
                  valor: m.id,
                  rotulo: m.cidade ? `${m.nome} — ${m.cidade}` : m.nome,
                })),
              ]}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => aoMudar(false)}
            disabled={criar.isPending}
          >
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
