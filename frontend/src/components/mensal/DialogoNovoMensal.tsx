import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { MesAnoInput, Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { normalizarCondominio } from "@/domain/condominio";
import {
  competenciaMensal,
  mesAnoDe,
  mesAnterior,
  mensalPadrao,
  ordemCompetencia,
  relatorioAnterior,
  rotuloCompetencia,
  validarMensal,
  type Competencia,
} from "@/domain/mensal";
import type { Condominio, Mensal } from "@/domain/types";

/** Sugere o mês seguinte ao último relatório do condomínio; sem nenhum, o mês passado. */
function mesSugerido(condoId: string, mensais: Mensal[], hoje = new Date()): Competencia {
  const ultimo = mensais
    .filter((m) => m.condoId === condoId)
    .map((m) => competenciaMensal(m))
    .filter((c): c is Competencia => !!c)
    .sort((a, b) => ordemCompetencia(b) - ordemCompetencia(a))[0];
  if (ultimo) return ultimo.mes === 12 ? { mes: 1, ano: ultimo.ano + 1 } : { mes: ultimo.mes + 1, ano: ultimo.ano };
  return mesAnterior({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() });
}

export function DialogoNovoMensal({
  aberto,
  aoMudar,
  condominios,
  mensais,
  condoInicial = "",
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  condominios: Condominio[];
  mensais: Mensal[];
  condoInicial?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [condoId, setCondoId] = useState(condoInicial);
  const [mes, setMes] = useState("");
  const [copiar, setCopiar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const escolherCondo = (id: string) => {
    setCondoId(id);
    setMes(id ? rotuloCompetencia(mesSugerido(id, mensais)) : "");
    setErro(null);
  };

  useEffect(() => {
    if (aberto) escolherCondo(condoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, condoInicial]);

  const competencia = mesAnoDe(mes);
  const anterior = useMemo(
    () => (condoId && competencia ? relatorioAnterior(condoId, competencia, mensais) : null),
    [condoId, competencia?.mes, competencia?.ano, mensais], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const criar = useMutation({
    mutationFn: (dados: Omit<Mensal, "id">) => api.salvar<Omit<Mensal, "id"> & { id?: string }>("mensais", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("mensais") });
      queryClient.setQueryData(chaves.item("mensais", salvo.id), salvo);
      toast.success("Relatório mensal criado.");
      aoMudar(false);
      navigate({ to: "/relatorio-mensal/$id", params: { id: salvo.id } });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarMensal(condoId, competencia, mensais);
    if (!v.ok) return setErro(v.erro);
    const condo = condominios.find((c) => c.id === condoId);
    if (!condo || !competencia) return;
    setErro(null);
    criar.mutate(mensalPadrao(normalizarCondominio(condo), competencia, copiar ? anterior : null));
  }

  const opcoes = [...condominios]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ valor: c.id, rotulo: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome }));

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo relatório mensal</DialogTitle>
          <DialogDescription>O período do demonstrativo é preenchido com o mês escolhido.</DialogDescription>
        </DialogHeader>
        <form id="form-novo-mensal" onSubmit={enviar} className="grid gap-4" noValidate>
          {erro && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <Field rotulo="Condomínio" obrigatorio>
            <Selecao value={condoId} onChange={escolherCondo} opcoes={opcoes} placeholder="Escolha o condomínio" />
          </Field>
          <Field rotulo="Mês do relatório" obrigatorio className="max-w-[10rem]">
            <MesAnoInput
              value={mes}
              onChange={(v) => {
                setMes(v);
                setErro(null);
              }}
            />
          </Field>
          {anterior && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Checkbox id="copiar-anterior" checked={copiar} onCheckedChange={(v) => setCopiar(v === true)} className="mt-0.5" />
              <Label htmlFor="copiar-anterior" className="text-sm font-normal leading-snug">
                Partir do relatório de {rotuloCompetencia(competenciaMensal(anterior))}: saldo anterior = saldo atual dele, e os mesmos
                nomes de contas, receitas e despesas com valores zerados.
              </Label>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => aoMudar(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-mensal" disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
