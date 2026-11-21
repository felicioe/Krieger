import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable, type Coluna } from "@/components/app/DataTable";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Field } from "@/components/app/Field";
import {
  DinheiroInput,
  InteiroInput,
  opcoesCondominio,
  Selecao,
  SelecaoBusca,
} from "@/components/app/inputs";
import { api, mensagemErro } from "@/lib/api";
import { chaves, listaQuery, listaQueryTolerante } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { formatBRL, formatDataHora } from "@/lib/format";
import { novoId } from "@/lib/id";
import {
  formatarPercentualCompleto,
  montarLinhaHistorico,
  parsePercentualCompleto,
  sugestoesPercentual,
  validarLinhaHistorico,
  type EntradaLinhaHistorico,
} from "@/domain/historicoRateio";
import type { Condominio, Exercicio, HistoricoRateio, PrevisaoAprovada } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/historico-rateios")({
  head: () =>
    cabecalho(
      "Histórico de rateios",
      "Rateio atual, rateio aprovado e percentual de cada condomínio por ano.",
    ),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listaQueryTolerante<HistoricoRateio>("historico_rateios")),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQueryTolerante<PrevisaoAprovada>("previsoes_aprovadas")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
    ]),
  component: PaginaHistoricoRateios,
});

const ROTULO_FONTE: Record<HistoricoRateio["fonte"], string> = {
  importacao: "Importação",
  calculo: "Previsão",
  manual: "Manual",
};

/** % em uso na linha e se ele foi informado ou calculado. */
const origemDe = (l: HistoricoRateio) =>
  l.variacaoOrigem === "informado" ? "informado" : "calculado";

interface Formulario {
  idExistente: string | null;
  condoId: string;
  ano: number | null;
  rateioAtual: number | null;
  rateioAprovado: number | null;
  rateioSugerido: number | null;
  textoPercentual: string;
  exercicioId: string | null;
}

const formularioVazio = (condoId = ""): Formulario => ({
  idExistente: null,
  condoId,
  ano: new Date().getFullYear(),
  rateioAtual: null,
  rateioAprovado: null,
  rateioSugerido: null,
  textoPercentual: "",
  exercicioId: null,
});

const formularioDe = (l: HistoricoRateio): Formulario => ({
  idExistente: l.id,
  condoId: l.condoId,
  ano: Number(l.ano),
  rateioAtual: l.rateioAtual,
  rateioAprovado: l.rateioAprovado,
  rateioSugerido: l.rateioSugerido,
  textoPercentual:
    origemDe(l) === "informado" && l.variacao !== null
      ? formatarPercentualCompleto(l.variacao)
      : "",
  exercicioId: l.exercicioId,
});

function PaginaHistoricoRateios() {
  const queryClient = useQueryClient();
  const { data: linhas } = useSuspenseQuery(
    listaQueryTolerante<HistoricoRateio>("historico_rateios"),
  );
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: previsoes } = useSuspenseQuery(
    listaQueryTolerante<PrevisaoAprovada>("previsoes_aprovadas"),
  );
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const [filtro, setFiltro] = useState("todos");
  const [editando, setEditando] = useState<Formulario | null>(null);
  const [excluindo, setExcluindo] = useState<HistoricoRateio | null>(null);

  const nomeCondo = (id: string) =>
    condominios.find((c) => c.id === id)?.nome ??
    linhas.find((l) => l.condoId === id)?.condoNome ??
    id;

  const visiveis = useMemo(
    () =>
      linhas
        .filter((l) => filtro === "todos" || l.condoId === filtro)
        .sort(
          (a, b) =>
            nomeCondo(a.condoId).localeCompare(nomeCondo(b.condoId), "pt-BR") ||
            Number(b.ano) - Number(a.ano),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, filtro, condominios],
  );

  const previstoDe = (l: HistoricoRateio) =>
    previsoes.find(
      (p) => p.condoId === l.condoId && Number(p.exercicioDestino) === Number(l.ano) + 1,
    );

  const excluir = useMutation({
    mutationFn: (id: string) => api.excluir("historico_rateios", id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chaves.lista("historico_rateios") });
      toast.success("Linha do histórico excluída.");
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const colunas: Coluna<HistoricoRateio>[] = [
    { chave: "condo", titulo: "Condomínio", render: (l) => nomeCondo(l.condoId) },
    { chave: "ano", titulo: "Ano", alinhar: "direita", className: "num" },
    {
      chave: "atual",
      titulo: "Rateio atual",
      alinhar: "direita",
      className: "num",
      render: (l) => (l.rateioAtual === null ? "—" : formatBRL(l.rateioAtual)),
    },
    {
      chave: "aprovado",
      titulo: "Rateio aprovado",
      alinhar: "direita",
      className: "num",
      render: (l) => formatBRL(l.rateioAprovado),
    },
    {
      chave: "pct",
      titulo: "% em uso",
      alinhar: "direita",
      render: (l) => {
        const duvida = l.variacao === null || l.variacao === 0;
        return (
          <span className="num inline-flex items-center justify-end gap-2">
            {duvida && (
              <TriangleAlert
                className="size-4 text-warning-foreground"
                aria-label="Conferir o percentual"
              />
            )}
            {l.variacao === null ? "—" : `${formatarPercentualCompleto(l.variacao)}%`}
            <Badge variant={origemDe(l) === "informado" ? "default" : "secondary"}>
              {origemDe(l) === "informado" ? "Informado" : "Calculado"}
            </Badge>
          </span>
        );
      },
    },
    {
      chave: "previsto",
      titulo: "Previsto do ano seguinte",
      render: (l) => {
        const p = previstoDe(l);
        if (!p) return <span className="text-muted-foreground">Não gravado</span>;
        const diverge = l.variacao !== null && Math.abs(p.percentualAprovado - l.variacao) > 0.005;
        return (
          <span className="num">
            {formatBRL(p.totalPrevisto)} · {formatarPercentualCompleto(p.percentualAprovado)}% · v
            {p.versao}
            {diverge && (
              <Badge variant="warning" className="ml-2">
                Difere do % da linha
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      chave: "fonte",
      titulo: "Fonte",
      render: (l) => `${ROTULO_FONTE[l.fonte] ?? l.fonte} · ${formatDataHora(l.travadoEm)}`,
    },
    {
      chave: "acoes",
      titulo: "Ações",
      alinhar: "direita",
      render: (l) => (
        <span className="inline-flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            permissao="previsao_orcamentaria.editar"
            onClick={() => setEditando(formularioDe(l))}
            aria-label={`Editar ${nomeCondo(l.condoId)} ${l.ano}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            permissao="previsao_orcamentaria.editar"
            onClick={() => setExcluindo(l)}
            aria-label={`Excluir ${nomeCondo(l.condoId)} ${l.ano}`}
          >
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Histórico de rateios"
        descricao="Base dos percentuais de reajuste: o previsto do ano seguinte usa o % de cada linha. O % informado vale mais que o calculado."
        acoes={
          <Button
            permissao="previsao_orcamentaria.editar"
            onClick={() => setEditando(formularioVazio(filtro === "todos" ? "" : filtro))}
          >
            <Plus /> Nova linha
          </Button>
        }
      />
      <SectionCard className="mb-6">
        <Field rotulo="Condomínio">
          <Selecao
            value={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: "todos", rotulo: "Todos os condomínios" },
              ...opcoesCondominio(condominios).map((o) => ({ valor: o.valor, rotulo: o.rotulo })),
            ]}
          />
        </Field>
      </SectionCard>
      <DataTable<HistoricoRateio>
        colunas={colunas}
        dados={visiveis}
        chaveLinha={(l) => l.id}
        vazio="Nenhuma linha de histórico. Use “Nova linha” ou trave o rateio na Previsão orçamentária."
      />
      {editando && (
        <DialogoLinha
          key={`${editando.idExistente ?? "novo"}`}
          inicial={editando}
          linhas={linhas}
          condominios={condominios}
          exercicios={exercicios}
          previsoes={previsoes}
          aoFechar={() => setEditando(null)}
        />
      )}
      <ConfirmDialog
        aberto={!!excluindo}
        aoMudar={(v) => !v && setExcluindo(null)}
        titulo="Excluir esta linha do histórico?"
        descricao={
          excluindo
            ? `${nomeCondo(excluindo.condoId)} · ${excluindo.ano}. O previsto do ano seguinte já gravado não é alterado; sem a linha, novas cargas e fechamentos deixam de encontrar o percentual deste ano.`
            : undefined
        }
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => (excluindo ? excluir.mutateAsync(excluindo.id) : undefined)}
      />
    </>
  );
}

function DialogoLinha({
  inicial,
  linhas,
  condominios,
  exercicios,
  previsoes,
  aoFechar,
}: {
  inicial: Formulario;
  linhas: HistoricoRateio[];
  condominios: Condominio[];
  exercicios: Exercicio[];
  previsoes: PrevisaoAprovada[];
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [f, setF] = useState<Formulario>(inicial);
  // Erros só aparecem depois da primeira tentativa de salvar, para o formulário não abrir "vermelho".
  const [tentou, setTentou] = useState(false);
  const mudar = (p: Partial<Formulario>) => setF((x) => ({ ...x, ...p }));

  const percentualInformado = parsePercentualCompleto(f.textoPercentual);
  const textoInvalido = f.textoPercentual.trim() !== "" && percentualInformado === null;
  const entrada: EntradaLinhaHistorico = {
    condoId: f.condoId,
    ano: f.ano,
    rateioAtual: f.rateioAtual,
    rateioAprovado: f.rateioAprovado,
    rateioSugerido: f.rateioSugerido,
    percentualInformado,
  };
  const { erros, avisos } = validarLinhaHistorico(entrada);
  const sugestao = sugestoesPercentual(entrada);
  const existente = linhas.find((l) => l.condoId === f.condoId && Number(l.ano) === f.ano);
  const conflito = existente && existente.id !== f.idExistente ? existente : null;
  const previsto = previsoes.find(
    (p) => p.condoId === f.condoId && f.ano !== null && Number(p.exercicioDestino) === f.ano + 1,
  );
  const seguinteFechado = exercicios.some(
    (e) => e.condoId === f.condoId && f.ano !== null && Number(e.ano) === f.ano + 1 && e.fechado,
  );
  const emUso = percentualInformado ?? sugestao.doAprovado;

  const salvar = useMutation({
    mutationFn: (dados: Omit<HistoricoRateio, "id"> & { id: string }) =>
      api.salvar<Omit<HistoricoRateio, "id"> & { id: string }>("historico_rateios", dados),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chaves.lista("historico_rateios") });
      toast.success("Histórico de rateios salvo.");
      aoFechar();
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    setTentou(true);
    if (Object.keys(erros).length > 0 || textoInvalido) return;
    const linha = montarLinhaHistorico(
      { ...entrada, condoNome: condominios.find((c) => c.id === f.condoId)?.nome ?? "" },
      {
        exercicioId: f.exercicioId ?? existente?.exercicioId ?? null,
        travadoEm: new Date().toISOString(),
      },
    );
    salvar.mutate({ ...linha, id: f.idExistente ?? existente?.id ?? novoId() });
  }

  const usar = (v: number | null) =>
    v !== null && mudar({ textoPercentual: formatarPercentualCompleto(v) });

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {f.idExistente ? "Editar linha do histórico" : "Nova linha do histórico"}
          </DialogTitle>
          <DialogDescription>
            O % informado vale mais que o calculado. Para manter todas as casas decimais, use a
            sugestão do sistema em vez de digitar um valor arredondado.
          </DialogDescription>
        </DialogHeader>
        <form id="form-historico-rateio" onSubmit={enviar} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field rotulo="Condomínio" obrigatorio erro={tentou ? (erros.condoId ?? null) : null}>
              <SelecaoBusca
                value={f.condoId}
                onChange={(v) => mudar({ condoId: v })}
                opcoes={opcoesCondominio(condominios)}
                placeholder="Escolha o condomínio"
                disabled={!!f.idExistente}
              />
            </Field>
            <Field rotulo="Ano" obrigatorio erro={tentou ? (erros.ano ?? null) : null}>
              <InteiroInput
                value={f.ano}
                onChange={(v) => mudar({ ano: v })}
                disabled={!!f.idExistente}
                inputMode="numeric"
              />
            </Field>
          </div>
          {conflito && (
            <p className="text-sm text-muted-foreground" role="status">
              Já existe uma linha deste condomínio em {f.ano}: salvar atualiza essa linha.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              rotulo="Rateio atual (anterior)"
              erro={tentou ? (erros.rateioAtual ?? null) : null}
            >
              <DinheiroInput value={f.rateioAtual} onChange={(v) => mudar({ rateioAtual: v })} />
            </Field>
            <Field
              rotulo="Rateio aprovado"
              obrigatorio
              erro={tentou ? (erros.rateioAprovado ?? null) : null}
            >
              <DinheiroInput
                value={f.rateioAprovado}
                onChange={(v) => mudar({ rateioAprovado: v })}
              />
            </Field>
            <Field rotulo="Sugestão do sistema (R$)" dica="Opcional; usada só como referência.">
              <DinheiroInput
                value={f.rateioSugerido}
                onChange={(v) => mudar({ rateioSugerido: v })}
              />
            </Field>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">Sugestões de % com todas as casas</p>
            <ul className="space-y-1">
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Calculado do rateio aprovado:{" "}
                  <strong className="num">
                    {sugestao.doAprovado === null
                      ? "—"
                      : `${formatarPercentualCompleto(sugestao.doAprovado)}%`}
                  </strong>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sugestao.doAprovado === null}
                  onClick={() => usar(sugestao.doAprovado)}
                >
                  Usar
                </Button>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Da sugestão do sistema:{" "}
                  <strong className="num">
                    {sugestao.doSugerido === null
                      ? "—"
                      : `${formatarPercentualCompleto(sugestao.doSugerido)}%`}
                  </strong>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sugestao.doSugerido === null}
                  onClick={() => usar(sugestao.doSugerido)}
                >
                  Usar
                </Button>
              </li>
            </ul>
          </div>
          <Field
            rotulo="% informado"
            dica="Vazio = usar o calculado. Aceita vírgula ou ponto, até 6 casas."
            erro={
              textoInvalido
                ? "Digite um número, por exemplo 8,93."
                : tentou
                  ? (erros.percentualInformado ?? null)
                  : null
            }
          >
            <Input
              value={f.textoPercentual}
              onChange={(e) => mudar({ textoPercentual: e.target.value.replace(/[^\d.,%-]/g, "") })}
              onBlur={() => percentualInformado !== null && usar(percentualInformado)}
              inputMode="decimal"
              autoComplete="off"
              className="num text-right"
              placeholder="vazio = calculado"
            />
          </Field>
          <p className="text-sm" role="status">
            % que será gravado:{" "}
            <strong className="num">
              {emUso === null ? "—" : `${formatarPercentualCompleto(emUso)}%`}
            </strong>{" "}
            ({percentualInformado !== null ? "informado" : "calculado"})
          </p>
          {(avisos.length > 0 || previsto || seguinteFechado) && (
            <ul className="space-y-1 text-sm text-muted-foreground" aria-label="Avisos">
              {avisos.map((a) => (
                <li key={a} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" /> {a}
                </li>
              ))}
              {previsto && (
                <li>
                  O previsto de {f.ano! + 1} já está gravado (v{previsto.versao},{" "}
                  {formatarPercentualCompleto(previsto.percentualAprovado)}%): ele não muda ao
                  salvar aqui. Para atualizá-lo, reabra e feche o exercício de {f.ano}.
                </li>
              )}
              {seguinteFechado && (
                <li>
                  O exercício de {f.ano! + 1} está fechado: relatórios dele que ainda derivam o
                  previsto do histórico mudam com este percentual.
                </li>
              )}
            </ul>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-historico-rateio" disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
