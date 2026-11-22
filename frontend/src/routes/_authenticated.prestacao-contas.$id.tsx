import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Calculator,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DataInput, DinheiroInput, InteiroInput } from "@/components/app/inputs";
import { EditorDemonstrativo } from "@/components/demonstrativo/EditorDemonstrativo";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { DialogoDivergencia } from "@/components/importacao/DialogoDivergencia";
import { HistoricoConflitosImportacao } from "@/components/importacao/HistoricoConflitosImportacao";
import {
  persistirDecisaoConflito,
  type DecisaoConflitoPendente,
} from "@/components/importacao/ConflitoImportacao";
import { useTravaImportacao } from "@/components/importacao/useTravaImportacao";
import { AnexosPrestacao, anexosQuery } from "@/components/importacao/AnexosPrestacao";
import { excluirPrestacaoComAnexos } from "@/components/importacao/anexos";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery, listaQueryTolerante } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { useUsuario } from "@/lib/auth";
import { demonstrativoVazio, mesesNoPeriodo } from "@/domain/demonstrativo";
import { consolidarPeriodo } from "@/domain/demonstrativoDinamico";
import { aplicarConsideracoesAoExercicio, origemComArquivo } from "@/domain/importacao";
import {
  condominioComConsid,
  considEfetiva,
  normalizarExercicio,
  prepararExercicio,
  validarNovoExercicio,
} from "@/domain/exercicio";
import { previsaoSugeridaDoPdf } from "@/domain/previsaoSugerida";
import { historicoDoExercicio, rateioBaseDivergente } from "@/domain/historicoRateio";
import { novoId } from "@/lib/id";
import { formatBRL } from "@/lib/format";
import type { Condominio, Exercicio, HistoricoRateio, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/prestacao-contas/$id")({
  head: () => cabecalho("Prestação de contas", "Dados e demonstrativo do exercício."),
  loader: async ({ params, context: { queryClient } }) => {
    const [e] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Exercicio>("exercicios", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(anexosQuery(params.id)),
      queryClient.ensureQueryData(listaQueryTolerante<HistoricoRateio>("historico_rateios")),
    ]);
    if (!e) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Prestação de contas não encontrada.</p>
      <Button variant="link" asChild>
        <Link to="/prestacao-contas">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaExercicio,
});

function PaginaExercicio() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Exercicio>("exercicios", id));
  return <FormExercicio key={id} inicial={normalizarExercicio(data ?? { id })} />;
}

function FormExercicio({ inicial }: { inicial: Exercicio }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useUsuario();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { refetch: atualizarMensais, isFetching: atualizandoMensais } = useSuspenseQuery(
    listaQuery<Mensal>("mensais"),
  );
  // Exercício aberto: as considerações vêm do cadastro, que é a fonte única (#307). Fechado: o congelado.
  const condoDoExercicio = condominios.find((c) => c.id === inicial.condoId) ?? null;
  const inicialComCadastro: Exercicio = inicial.fechado
    ? inicial
    : { ...inicial, consid: considEfetiva(inicial, condoDoExercicio) };
  const [e, setE] = useState<Exercicio>(inicialComCadastro);
  // Histórico de rateios: fonte do rateio atual (#308). Só avisa a divergência; não troca sozinho.
  const { data: historicoRateios = [] } = useSuspenseQuery(
    listaQueryTolerante<HistoricoRateio>("historico_rateios"),
  );
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicialComCadastro));
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [confirmarFechamento, setConfirmarFechamento] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState("");
  const [erroAno, setErroAno] = useState<string | null>(null);
  // Decisão de conflito de importação (ver ConflitoImportacao.tsx) ainda pendente de gravar — só
  // registrada quando o Salvar abaixo for bem-sucedido, pra não logar uma importação descartada.
  const [decisaoPendente, setDecisaoPendente] = useState<DecisaoConflitoPendente | null>(null);
  // Totais do PDF importado (ou do registro recém-criado por PDF), conferidos no primeiro Salvar.
  const trava = useTravaImportacao("exercicios", inicial.id, inicial.demonstrativo ?? null);

  const condo = condominios.find((c) => c.id === e.condoId);
  const demonstrativoSalvo = e.demonstrativo ?? demonstrativoVazio(e.condoNome);
  // A tela mostra exatamente o que está gravado (ou o que o usuário acabou de editar). A
  // consolidação pelos relatórios mensais virou ação explícita ("Atualizar dados"), porque somar
  // uma série parcial de meses por cima do saldo gravado troca as contas do exercício sem avisar —
  // foi o que apagou as despesas do balanço na reimportação do Lago Negro 2025.
  const demonstrativo = demonstrativoSalvo;
  const sujo = JSON.stringify(e) !== salvoJson;
  const rateioDoHistorico = rateioBaseDivergente(e, historicoRateios);
  const mesesPeriodo = mesesNoPeriodo(demonstrativo.periodo.ini, demonstrativo.periodo.fim);

  const mudar = (parcial: Partial<Exercicio>) =>
    setE((x) => (x.fechado ? x : { ...x, ...parcial }));

  /**
   * "Atualizar dados" consolida o demonstrativo pelos relatórios mensais do período. Só substitui
   * o demonstrativo gravado quando a cobertura é completa (um mensal por mês do período); com
   * cobertura parcial, avisa e mantém o que está gravado — somar poucos meses por cima do saldo
   * apaga as contas que só o balanço tem.
   */
  async function atualizarPeloPeriodo() {
    const novos = await atualizarMensais().then((r) => r.data ?? []);
    const resultado = consolidarPeriodo(demonstrativoSalvo, novos, e.condoId);
    if (resultado.estado !== "completa") {
      toast.error(resultado.aviso ?? "Não foi possível consolidar os relatórios mensais.");
      return;
    }
    mudar({ demonstrativo: resultado.demonstrativo });
    toast.success(
      `Demonstrativo consolidado com ${resultado.usados} ${resultado.usados === 1 ? "relatório mensal" : "relatórios mensais"}. Salve para gravar.`,
    );
  }

  // Avisa antes de sair com alterações não salvas (refs para ler o estado mais recente).
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const liberado = useRef(false);
  useBlocker({
    shouldBlockFn: () =>
      !liberado.current &&
      sujoRef.current &&
      !window.confirm("Há alterações não salvas nesta prestação de contas. Sair mesmo assim?"),
    enableBeforeUnload: () => !liberado.current && sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: async (dados: Exercicio) => {
      // Exercício aberto: o que foi editado nas considerações grava também no cadastro (#307).
      // Fechado não toca no cadastro, para não voltar dados antigos sobre alterações posteriores.
      if (!dados.fechado && condo) {
        await api.salvar("condominios", condominioComConsid(condo, dados.consid));
        queryClient.invalidateQueries({ queryKey: chaves.store("condominios") });
      }
      return api.salvar("exercicios", dados);
    },
    onSuccess: (salvo) => {
      const n = normalizarExercicio(salvo);
      queryClient.invalidateQueries({ queryKey: chaves.lista("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);
      setE(n);
      setSalvoJson(JSON.stringify(n));
      if (decisaoPendente) {
        persistirDecisaoConflito(usuario, queryClient, decisaoPendente);
        setDecisaoPendente(null);
      }
      // Rateio importado do Systemar entra no histórico acumulativo (uma vez por ano), para o
      // relatório final e o exercício seguinte terem a base mesmo sem ninguém clicar em "Travar".
      void registrarRateioImportado(n);
      toast.success("Prestação de contas salva.");
    },
  });

  /**
   * Quando a prestação tem a previsão sugerida importada (rateio por unidade do PDF) e ainda
   * não existe linha de histórico para esse ano, grava uma. Não sobrescreve: se o rateio já
   * foi travado/editado pelo usuário, a linha guardada vale mais.
   */
  async function registrarRateioImportado(ex: Exercicio) {
    const pv = ex.previsaoSugerida;
    const aprovado = ex.rateioAprovado ?? pv?.rateioUnidadeAtual ?? pv?.rateioMensalAtual ?? null;
    if (aprovado === null) return;
    try {
      const existentes = await api.listar<HistoricoRateio>("historico_rateios");
      const jaTem = existentes.some(
        (h) => h.condoId === ex.condoId && Number(h.ano) === Number(ex.ano),
      );
      if (jaTem) return;
      const anterior = existentes
        .filter((h) => h.condoId === ex.condoId && Number(h.ano) < Number(ex.ano))
        .sort((a, b) => Number(b.ano) - Number(a.ano))[0];
      // Usa o rateio do PDF (rateioUnidadeAtual) como base quando não há histórico anterior.
      // Isso garante que o índice de 15,26% (321 → 370) seja calculado corretamente mesmo na
      // primeira importação do condomínio, onde não existe exercício 2024 no sistema.
      const rateioBase =
        anterior?.rateioAprovado ?? pv?.rateioUnidadeAtual ?? pv?.rateioMensalAtual ?? null;
      const linha = historicoDoExercicio(
        {
          id: ex.id,
          condoId: ex.condoId,
          condoNome: ex.condoNome,
          ano: ex.ano,
          rateioAtual: rateioBase,
          rateioAprovado: aprovado,
        },
        pv?.rateioUnidadeAtual ?? pv?.rateioMensalAtual ?? null,
        "importacao",
        new Date().toISOString(),
      );
      await api.salvar("historico_rateios", { ...linha, id: novoId() });
      queryClient.invalidateQueries({ queryKey: chaves.lista("historico_rateios") });
    } catch {
      // Silencioso: salvar a prestação não pode falhar por causa do histórico.
    }
  }

  const fechamento = useMutation({
    mutationFn: () =>
      api.fechamentoExercicio(e.id, !e.fechado, motivoReabertura, e.atualizadoEm ?? null),
    onSuccess: (salvo) => {
      const n = normalizarExercicio(salvo);
      setE(n);
      setSalvoJson(JSON.stringify(n));
      setMotivoReabertura("");
      queryClient.invalidateQueries({ queryKey: chaves.store("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);
      toast.success(
        salvo.fechado
          ? "Exercício fechado e salvo. Dados consolidados protegidos."
          : "Exercício reaberto. Motivo registrado no histórico.",
      );
    },
  });

  const { data: anexos } = useSuspenseQuery(anexosQuery(e.id));
  const qtdAnexos = anexos.length;

  const excluir = useMutation({
    // Cascata: os anexos de referência desta prestação saem junto.
    mutationFn: () => excluirPrestacaoComAnexos(e.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.store("anexos_importacao") }),
    onSuccess: (n) => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("exercicios") });
      toast.success(
        n > 0
          ? `Prestação de contas e ${n === 1 ? "1 anexo excluídos" : `${n} anexos excluídos`}.`
          : "Prestação de contas excluída.",
      );
      navigate({ to: "/prestacao-contas" });
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (e.fechado) return;
    const v = validarNovoExercicio(e.condoId, Number(e.ano) || null, exercicios, e.id);
    if (!v.ok) {
      setErroAno(v.erro);
      toast.error(v.erro);
      return;
    }
    setErroAno(null);
    trava.salvar(demonstrativo, () =>
      salvar.mutateAsync(prepararExercicio({ ...e, demonstrativo })),
    );
  }

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto min-h-0 p-0 text-muted-foreground" asChild>
            <Link to="/prestacao-contas">
              <ArrowLeft /> Prestação de contas
            </Link>
          </Button>
        }
        titulo={`Exercício ${e.ano}`}
        descricao={e.condoNome || condo?.nome}
        acoes={
          <>
            {e.fechado && <Badge variant="success">Exercício fechado</Badge>}
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <Button
              variant="outline"
              type="button"
              onClick={() => void atualizarPeloPeriodo()}
              disabled={atualizandoMensais || e.fechado}
              title="Somar os relatórios mensais do período neste demonstrativo"
            >
              {atualizandoMensais ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Atualizar dados
            </Button>
            {!e.fechado && (
              <ImportarPdf
                modo="editor"
                destino="exercicios"
                condominio={condo}
                nomeCondominio={e.condoNome || condo?.nome || ""}
                demonstrativoAtual={e.demonstrativo ?? null}
                registroId={e.id}
                competencia={String(e.ano)}
                aoAplicar={(r) => {
                  mudar({
                    demonstrativo: r.demonstrativo,
                    origem: origemComArquivo(e.origem, r.arquivo),
                    ...(r.consideracoes
                      ? { consid: aplicarConsideracoesAoExercicio(e.consid, r.consideracoes) }
                      : {}),
                    ...(r.previsaoSugerida
                      ? { previsaoSugerida: previsaoSugeridaDoPdf(r.previsaoSugerida) }
                      : {}),
                  });
                  trava.marcarImportado(r.demonstrativo);
                  setDecisaoPendente(r.decisaoConflito ?? null);
                }}
              />
            )}
            <Button variant="outline" asChild>
              <Link to="/previsao-orcamentaria" search={{ exercicio: e.id }}>
                <Calculator /> Previsão orçamentária
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/previsto-realizado" search={{ exercicio: e.id }}>
                Previsto × Realizado
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/relatorio-final/$id" params={{ id: e.id }}>
                <FileText /> Relatório final
              </Link>
            </Button>
            <Button
              permissao="prestacao_contas.editar"
              variant="outline"
              type="button"
              disabled={
                salvar.isPending ||
                fechamento.isPending ||
                sujo ||
                (!e.fechado && JSON.stringify(demonstrativo) !== JSON.stringify(demonstrativoSalvo))
              }
              title="Salve os dados e a previsão antes de fechar o exercício."
              onClick={() => setConfirmarFechamento(true)}
            >
              {e.fechado ? "Reabrir exercício" : "Fechar exercício"}
            </Button>
            <Button
              permissao="prestacao_contas.editar"
              variant="outline"
              type="button"
              disabled={e.fechado}
              onClick={() => setConfirmarExclusao(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 /> Excluir
            </Button>
            <Button
              permissao="prestacao_contas.editar"
              type="submit"
              form="form-exercicio"
              disabled={salvar.isPending || e.fechado}
            >
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      {e.fechado && (
        <Alert className="mb-4">
          <AlertDescription>
            Exercício fechado: números e fontes do relatório estão preservados. Para corrigir, use
            Reabrir exercício e informe o motivo.
          </AlertDescription>
        </Alert>
      )}
      <ConfirmDialog
        aberto={confirmarFechamento}
        aoMudar={setConfirmarFechamento}
        titulo={e.fechado ? "Reabrir exercício?" : "Fechar exercício?"}
        descricao={
          <div className="space-y-3">
            <p>
              {e.fechado
                ? "A reabertura libera a edição e fica registrada."
                : "Os dados salvos, o percentual e as fontes usadas no relatório serão preservados. Salve também a previsão antes de confirmar."}
            </p>
            {e.fechado && (
              <Field rotulo="Motivo da reabertura">
                <Input
                  value={motivoReabertura}
                  onChange={(ev) => setMotivoReabertura(ev.target.value)}
                />
              </Field>
            )}
          </div>
        }
        rotuloConfirmar={e.fechado ? "Reabrir e salvar" : "Fechar e salvar"}
        aoConfirmar={() => fechamento.mutateAsync()}
      />
      <form id="form-exercicio" onSubmit={enviar} className="space-y-6" noValidate>
        <fieldset disabled={e.fechado} className="min-w-0 space-y-6">
          <SectionCard titulo="Dados do exercício">
            <div className="grid gap-4 sm:grid-cols-6">
              <Field rotulo="Ano" erro={erroAno} className="sm:col-span-1">
                <InteiroInput
                  value={Number(e.ano) || null}
                  onChange={(v) => {
                    mudar({ ano: v ?? "" });
                    if (erroAno) setErroAno(null);
                  }}
                  maxLength={4}
                />
              </Field>
              <Field rotulo="Cidade" className="sm:col-span-3">
                <Input value={e.cidade} onChange={(ev) => mudar({ cidade: ev.target.value })} />
              </Field>
              <Field rotulo="Data de emissão" className="sm:col-span-2">
                <DataInput value={e.dataEmissao} onChange={(v) => mudar({ dataEmissao: v })} />
              </Field>
              <Field rotulo="Rateio atual (por unidade)" className="sm:col-span-3">
                <DinheiroInput
                  value={e.rateioAtual}
                  onChange={(v) => mudar({ rateioAtual: v })}
                  disabled={e.fechado}
                />
              </Field>
              {!e.fechado && rateioDoHistorico !== null && (
                <p className="col-span-full text-xs text-warning">
                  O histórico de rateios tem {formatBRL(rateioDoHistorico)} aprovado para{" "}
                  {Number(e.ano) - 1}.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => mudar({ rateioAtual: rateioDoHistorico })}
                  >
                    Usar o do histórico
                  </button>
                </p>
              )}
              <Field
                rotulo="Rateio aprovado"
                dica="Valor aprovado em assembleia."
                className="sm:col-span-3"
              >
                <DinheiroInput
                  value={e.rateioAprovado}
                  onChange={(v) => mudar({ rateioAprovado: v })}
                  disabled={e.fechado}
                />
              </Field>
            </div>
          </SectionCard>

          <EditorDemonstrativo
            valor={demonstrativo}
            onChange={(d) => mudar({ demonstrativo: d })}
            descricaoDespesas="Organize as despesas por grupo (Pessoal, Consumo, Manutenção…). São a base da previsão calculada pelo demonstrativo."
            bloqueado={e.fechado === true}
            avisoPeriodo={
              mesesPeriodo !== null && mesesPeriodo > 12 ? (
                <Alert variant="warning" className="mt-3">
                  <TriangleAlert />
                  <AlertDescription>
                    Esse período tem {mesesPeriodo} meses — a prestação de contas normalmente cobre
                    até 12. Confira as datas de início e fim antes de salvar.
                  </AlertDescription>
                </Alert>
              ) : null
            }
          />
        </fieldset>
      </form>

      {/* Fora do formulário: baixar/excluir anexo não envia nem suja a prestação. */}
      <div className="mt-6">
        <AnexosPrestacao exercicioId={e.id} bloqueado={e.fechado === true} />
      </div>

      {e.historicoFechamento?.length ? (
        <SectionCard titulo="Histórico de fechamento" className="mt-6">
          <ul className="space-y-2 text-sm">
            {e.historicoFechamento.map((h, i) => (
              <li key={i}>
                {h.acao === "fechar" ? "Fechado" : "Reaberto"} · {h.em} · {h.por}
                {h.motivo ? ` · ${h.motivo}` : ""}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
      <HistoricoConflitosImportacao registroId={e.id} />

      <DialogoDivergencia
        aberto={trava.dialogo.aberto}
        aoMudar={trava.dialogo.aoMudar}
        pendente={trava.dialogo.pendente}
        aoConfirmar={trava.dialogo.aoConfirmar}
      />

      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir prestação de contas?"
        descricao={`O exercício ${e.ano} de ${e.condoNome} será excluído${
          qtdAnexos > 0
            ? `, junto com ${qtdAnexos === 1 ? "o anexo de referência" : `os ${qtdAnexos} anexos de referência`} desta prestação`
            : ""
        }. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
