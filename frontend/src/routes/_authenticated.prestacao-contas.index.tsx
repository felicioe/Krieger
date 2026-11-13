import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CircleHelp, FileUp, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { Exportacoes } from "@/components/app/Exportacoes";
import { baixarCsv, baixarXlsx, type ColunaExportacao } from "@/lib/exportar";
import { imprimirColunas } from "@/lib/imprimirColunas";
import { DataTable } from "@/components/app/DataTable";
import { AvisoImportacoesPendentes } from "@/components/importacao/AvisoImportacoesPendentes";
import { Field } from "@/components/app/Field";
import { DataInput, SelecaoBusca, opcoesCondominio } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { normalizarCondominio } from "@/domain/condominio";
import {
  encontrarExercicioAnterior,
  exercicioPadrao,
  normalizarExercicio,
  periodoInicialDoExercicio,
  validarNovoExercicio,
} from "@/domain/exercicio";
import { mesesNoPeriodo } from "@/domain/demonstrativo";
import { calcularPrevisao, demonstrativoBasePrevisao } from "@/domain/previsao";
import {
  calcularPrevisaoSugerida,
  chaveDivergencia,
  compararComTotaisPdf,
} from "@/domain/previsaoSugerida";
import type { Condominio, ConfigEscritorio, Exercicio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/prestacao-contas/")({
  head: () =>
    cabecalho("Prestação de contas", "Prestações de contas anuais com previsão orçamentária."),
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
  const divergencias = compararComTotaisPdf(
    calcularPrevisaoSugerida(e.previsaoSugerida, e.arredondamento),
    e.previsaoSugerida.totaisPdf,
  );
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
    const todos = exercicios.map(normalizarExercicio);
    return todos
      .map((e) => {
        const condo = porId.get(e.condoId);
        // Mesma base do editor de previsão: o realizado do exercício anterior, nunca o
        // demonstrativo do próprio — pra esta lista nunca divergir da previsão aprovada ali.
        const demonstrativoBase = demonstrativoBasePrevisao(
          e,
          encontrarExercicioAnterior(todos, e),
        );
        const r = calcularPrevisao(
          demonstrativoBase,
          { ...e, indices: e.consid.indices },
          condo?.unidades ?? null,
        );
        return {
          ...e,
          condoNome: e.condoNome || condo?.nome || "",
          previsto: r.rateioSugerido,
          despesas: r.base,
          emConferencia: temDivergenciaEmConferencia(e),
        };
      })
      .filter((e) => !q || e.condoNome.toLowerCase().includes(q) || String(e.ano).includes(q))
      .sort(
        (a, b) => Number(b.ano) - Number(a.ano) || a.condoNome.localeCompare(b.condoNome, "pt-BR"),
      );
  }, [exercicios, condominios, busca]);

  const colunasExport: ColunaExportacao<Linha>[] = [
    { titulo: "Exercício", valor: (e) => e.ano, texto: (e) => String(e.ano) },
    { titulo: "Condomínio", valor: (e) => e.condoNome, texto: (e) => e.condoNome },
    {
      titulo: "Despesas realizadas",
      valor: (e) => e.despesas,
      texto: (e) => formatBRL(e.despesas),
      alinhamento: "direita",
    },
    {
      titulo: "Previsto por unidade",
      valor: (e) => e.previsto,
      texto: (e) => (e.previsto === null ? "—" : formatBRL(e.previsto)),
      alinhamento: "direita",
    },
    {
      titulo: "Rateio aprovado",
      valor: (e) => e.rateioAprovado,
      texto: (e) =>
        e.rateioAprovado === null || e.rateioAprovado === undefined
          ? "—"
          : formatBRL(e.rateioAprovado),
      alinhamento: "direita",
    },
    {
      titulo: "Divergência em conferência",
      valor: (e) => (e.emConferencia ? "Sim" : "Não"),
      texto: (e) => (e.emConferencia ? "Sim" : "Não"),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Prestação de contas"
        descricao="Demonstrativo do exercício e previsão orçamentária do ano seguinte."
        acoes={
          <>
            <Button variant="ghost" size="icon" asChild title="Ajuda sobre esta tela">
              <Link
                to="/ajuda"
                search={{ secao: "prestacao-contas" }}
                aria-label="Ajuda sobre a prestação de contas"
              >
                <CircleHelp />
              </Link>
            </Button>
            <Exportacoes
              acoes={{
                csv: () => baixarCsv("prestacoes-de-contas", colunasExport, linhas),
                xlsx: () => baixarXlsx("prestacoes-de-contas", "Prestações", colunasExport, linhas),
                imprimir: () =>
                  imprimirColunas({
                    titulo: "Prestações de contas",
                    subtitulo: busca.trim() ? `Busca: ${busca.trim()}` : "Todas as prestações",
                    colunas: colunasExport,
                    linhas,
                  }),
              }}
              bloqueio={linhas.length === 0 ? "Nenhuma prestação na seleção." : null}
            />
            <Button variant="outline" asChild>
              <Link to="/importador">
                <FileUp /> Importar PDF
              </Link>
            </Button>
            <Button
              permissao="prestacao_contas.editar"
              onClick={() => setNovoAberto(true)}
              disabled={condominios.length === 0}
            >
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
          {
            chave: "ano",
            titulo: "Exercício",
            className: "w-32",
            render: (e) => (
              <>
                <span className="num font-medium text-foreground">{e.ano}</span>
                {e.demonstrativo?.periodo.ini && e.demonstrativo.periodo.fim && (
                  <span className="num block text-xs text-muted-foreground">
                    {e.demonstrativo.periodo.ini} a {e.demonstrativo.periodo.fim}
                  </span>
                )}
              </>
            ),
          },
          {
            chave: "condoNome",
            titulo: "Condomínio",
            render: (e) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{e.condoNome}</span>
                {e.emConferencia && (
                  <Badge
                    variant="warning"
                    title='Divergência entre o PDF e o recalculado na Previsão sugerida, ainda sem decisão "confirmado".'
                  >
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
      <DialogoNovo
        aberto={novoAberto}
        aoMudar={setNovoAberto}
        condominios={condominios}
        exercicios={exercicios}
      />
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
  const { data: escritorio } = useSuspenseQuery(
    itemQuery<ConfigEscritorio>("config", "escritorio"),
  );
  const [condoId, setCondoId] = useState("");
  const [periodo, setPeriodo] = useState({ ini: "", fim: "" });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!condoId || periodo.ini || periodo.fim) return;
    const anterior = periodoInicialDoExercicio(condoId, 9999, exercicios);
    if (anterior.ini && anterior.fim) setPeriodo(anterior);
  }, [condoId, exercicios, periodo.ini, periodo.fim]);

  const criar = useMutation({
    mutationFn: (dados: Omit<Exercicio, "id">) =>
      api.salvar<Omit<Exercicio, "id"> & { id?: string }>("exercicios", dados),
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
    const ano = Number(periodo.fim.slice(-4));
    const meses = mesesNoPeriodo(periodo.ini, periodo.fim);
    const v = validarNovoExercicio(condoId, ano, exercicios);
    if (!v.ok) return setErro(v.erro);
    if (!periodo.ini || !periodo.fim || !meses || meses < 1)
      return setErro("Informe um período válido, com as datas inicial e final.");
    const condo = condominios.find((c) => c.id === condoId);
    if (!condo || !ano) return;
    setErro(null);
    criar.mutate(
      exercicioPadrao(
        normalizarCondominio(condo),
        ano,
        escritorio?.cidade ?? "",
        new Date(),
        periodo,
      ),
    );
  }

  const opcoes = opcoesCondominio(condominios);

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
            <SelecaoBusca
              value={condoId}
              onChange={setCondoId}
              opcoes={opcoes}
              placeholder="Escolha o condomínio"
            />
          </Field>
          <Field
            rotulo="Período da prestação"
            dica="O rótulo será o ano da data final (ex.: 01/11/2025 a 31/10/2026 = prestação de contas de 2026)."
            obrigatorio
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <DataInput
                aria-label="Data inicial"
                value={periodo.ini}
                onChange={(v) => setPeriodo((p) => ({ ...p, ini: v }))}
              />
              <DataInput
                aria-label="Data final"
                value={periodo.fim}
                onChange={(v) => setPeriodo((p) => ({ ...p, fim: v }))}
              />
            </div>
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
          <Button
            permissao="prestacao_contas.editar"
            type="submit"
            form="form-novo-exercicio"
            disabled={criar.isPending}
          >
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
