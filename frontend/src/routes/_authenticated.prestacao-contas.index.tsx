import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { FileUp, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { AvisoImportacoesPendentes } from "@/components/importacao/AvisoImportacoesPendentes";
import { Field } from "@/components/app/Field";
import { InteiroInput, Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { normalizarCondominio } from "@/domain/condominio";
import { exercicioPadrao, normalizarExercicio, validarNovoExercicio } from "@/domain/exercicio";
import { calcularPrevisao } from "@/domain/previsao";
import { calcularPrevisaoSugerida, chaveDivergencia, compararComTotaisPdf } from "@/domain/previsaoSugerida";
import type { Condominio, ConfigEscritorio, Exercicio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/prestacao-contas/")({
  head: () => cabecalho("Prestação de contas", "Prestações de contas anuais com previsão orçamentária."),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]),
  component: ListaExercicios,
});

type Linha = Exercicio & { previsto: number | null; despesas: number; emConferencia: boolean };

/** Divergência (PDF × recalculado) na previsão sugerida ainda sem decisão "confirmado" — ver PainelPrevisaoSugerida. */
function temDivergenciaEmConferencia(e: Exercicio): boolean {
  if (!e.previsaoSugerida) return false;
  const divergencias = compararComTotaisPdf(calcularPrevisaoSugerida(e.previsaoSugerida), e.previsaoSugerida.totaisPdf);
  if (divergencias.length === 0) return false;
  const decisao = e.previsaoSugerida.decisaoDivergencia;
  return !(decisao?.chave === chaveDivergencia(divergencias) && decisao.status === "confirmado");
}

function ListaExercicios() {
  const navigate = useNavigate();
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);

  const linhas = useMemo<Linha[]>(() => {
    const porId = new Map(condominios.map((c) => [c.id, c]));
    const q = busca.trim().toLowerCase();
    return exercicios
      .map((raw) => {
        const e = normalizarExercicio(raw);
        const condo = porId.get(e.condoId);
        const r = calcularPrevisao(e.demonstrativo, { ...e, indices: e.consid.indices }, condo?.unidades ?? null);
        return {
          ...e,
          condoNome: e.condoNome || condo?.nome || "",
          previsto: r.rateioSugerido,
          despesas: r.base,
          emConferencia: temDivergenciaEmConferencia(e),
        };
      })
      .filter((e) => !q || e.condoNome.toLowerCase().includes(q) || String(e.ano).includes(q))
      .sort((a, b) => Number(b.ano) - Number(a.ano) || a.condoNome.localeCompare(b.condoNome, "pt-BR"));
  }, [exercicios, condominios, busca]);

  return (
    <>
      <PageHeader
        titulo="Prestação de contas"
        descricao="Demonstrativo do exercício e previsão orçamentária do ano seguinte."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link to="/importador">
                <FileUp /> Importar PDF
              </Link>
            </Button>
            <Button permissao="prestacao_contas.editar" onClick={() => setNovoAberto(true)} disabled={condominios.length === 0}>
              <Plus /> Nova prestação de contas
            </Button>
          </>
        }
      />
      <AvisoImportacoesPendentes />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por condomínio ou ano"
          className="bg-card pl-9"
          aria-label="Buscar prestações de contas"
        />
      </div>
      <DataTable<Linha>
        colunas={[
          { chave: "ano", titulo: "Exercício", className: "w-24 num" },
          {
            chave: "condoNome",
            titulo: "Condomínio",
            render: (e) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{e.condoNome}</span>
                {e.emConferencia && (
                  <Badge variant="warning" title='Divergência entre o PDF e o recalculado na Previsão sugerida, ainda sem decisão "confirmado".'>
                    Em conferência
                  </Badge>
                )}
              </span>
            ),
          },
          {
            chave: "despesas",
            titulo: "Despesas realizadas",
            alinhar: "direita",
            className: "num whitespace-nowrap",
            render: (e) => formatBRL(e.despesas),
          },
          {
            chave: "previsto",
            titulo: "Previsto por unidade",
            alinhar: "direita",
            className: "num whitespace-nowrap",
            render: (e) => formatBRL(e.previsto),
          },
          {
            chave: "aprovado",
            titulo: "Rateio aprovado",
            alinhar: "direita",
            className: "num whitespace-nowrap",
            render: (e) => formatBRL(e.rateioAprovado),
          },
        ]}
        dados={linhas}
        chaveLinha={(e) => e.id}
        aoClicar={(e) => navigate({ to: "/prestacao-contas/$id", params: { id: e.id } })}
        colunaAcao="condoNome"
        rotuloAcao={(e) => `Abrir prestação de contas de ${e.condoNome}, exercício ${e.ano}`}
        vazio={
          condominios.length === 0
            ? "Cadastre um condomínio antes de criar a prestação de contas."
            : busca
              ? "Nenhuma prestação de contas corresponde à busca."
              : "Nenhuma prestação de contas cadastrada."
        }
      />
      <DialogoNovo aberto={novoAberto} aoMudar={setNovoAberto} condominios={condominios} exercicios={exercicios} />
    </>
  );
}

function DialogoNovo({
  aberto,
  aoMudar,
  condominios,
  exercicios,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  condominios: Condominio[];
  exercicios: Exercicio[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [condoId, setCondoId] = useState("");
  const [ano, setAno] = useState<number | null>(new Date().getFullYear() - 1);
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: (dados: Omit<Exercicio, "id">) => api.salvar<Omit<Exercicio, "id"> & { id?: string }>("exercicios", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);
      toast.success("Prestação de contas criada.");
      aoMudar(false);
      navigate({ to: "/prestacao-contas/$id", params: { id: salvo.id } });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarNovoExercicio(condoId, ano, exercicios);
    if (!v.ok) return setErro(v.erro);
    const condo = condominios.find((c) => c.id === condoId);
    if (!condo || !ano) return;
    setErro(null);
    criar.mutate(exercicioPadrao(normalizarCondominio(condo), ano, escritorio?.cidade ?? ""));
  }

  const opcoes = [...condominios]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ valor: c.id, rotulo: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome }));

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova prestação de contas</DialogTitle>
          <DialogDescription>
            Os parâmetros da previsão e as considerações são copiados do cadastro do condomínio.
          </DialogDescription>
        </DialogHeader>
        <form id="form-novo-exercicio" onSubmit={enviar} className="grid gap-4" noValidate>
          {erro && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <Field rotulo="Condomínio" obrigatorio>
            <Selecao value={condoId} onChange={setCondoId} opcoes={opcoes} placeholder="Escolha o condomínio" />
          </Field>
          <Field rotulo="Ano do exercício" obrigatorio className="max-w-[10rem]">
            <InteiroInput value={ano} onChange={setAno} maxLength={4} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => aoMudar(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button permissao="prestacao_contas.editar" type="submit" form="form-novo-exercicio" disabled={criar.isPending}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
