import { createFileRoute, Link, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Calculator, FileText, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DataInput, DinheiroInput, InteiroInput } from "@/components/app/inputs";
import { EditorDemonstrativo } from "@/components/demonstrativo/EditorDemonstrativo";
import { ImportarPdf } from "@/components/importacao/ImportarPdf";
import { DialogoDivergencia } from "@/components/importacao/DialogoDivergencia";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { aplicarConsideracoesAoExercicio, divergenciasImportacao, origemComArquivo, type DivergenciaImportacao } from "@/domain/importacao";
import { normalizarExercicio, prepararExercicio, validarNovoExercicio } from "@/domain/exercicio";
import { previsaoSugeridaDoPdf } from "@/domain/previsaoSugerida";
import type { Condominio, Demonstrativo, Exercicio } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/prestacao-contas/$id")({
  head: () => cabecalho("Prestação de contas", "Dados e demonstrativo do exercício."),
  loader: async ({ params, context: { queryClient } }) => {
    const [e] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Exercicio>("exercicios", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
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
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const [e, setE] = useState<Exercicio>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erroAno, setErroAno] = useState<string | null>(null);
  // Totais do PDF importado, guardados até o primeiro salvamento seguinte (trava de divergência).
  const [snapshotImportado, setSnapshotImportado] = useState<Demonstrativo | null>(null);
  const [divergencias, setDivergencias] = useState<DivergenciaImportacao[]>([]);
  const [confirmarDivergencia, setConfirmarDivergencia] = useState(false);

  const condo = condominios.find((c) => c.id === e.condoId);
  const demonstrativo = e.demonstrativo ?? demonstrativoVazio(e.condoNome);
  const sujo = JSON.stringify(e) !== salvoJson;

  const mudar = (parcial: Partial<Exercicio>) => setE((x) => ({ ...x, ...parcial }));

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
    mutationFn: (dados: Exercicio) => api.salvar("exercicios", dados),
    onSuccess: (salvo) => {
      const n = normalizarExercicio(salvo);
      queryClient.invalidateQueries({ queryKey: chaves.lista("exercicios") });
      queryClient.setQueryData(chaves.item("exercicios", salvo.id), salvo);
      setE(n);
      setSalvoJson(JSON.stringify(n));
      toast.success("Prestação de contas salva.");
      setSnapshotImportado(null);
    },
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir("exercicios", e.id),
    onSuccess: () => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("exercicios") });
      toast.success("Prestação de contas excluída.");
      navigate({ to: "/prestacao-contas" });
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    const v = validarNovoExercicio(e.condoId, Number(e.ano) || null, exercicios, e.id);
    if (!v.ok) {
      setErroAno(v.erro);
      toast.error(v.erro);
      return;
    }
    setErroAno(null);
    if (snapshotImportado) {
      const d = divergenciasImportacao(snapshotImportado, e.demonstrativo ?? demonstrativoVazio(e.condoNome));
      if (d.length > 0) {
        setDivergencias(d);
        setConfirmarDivergencia(true);
        return;
      }
    }
    salvar.mutate(prepararExercicio(e));
  }

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/prestacao-contas">
              <ArrowLeft /> Prestação de contas
            </Link>
          </Button>
        }
        titulo={`Exercício ${e.ano}`}
        descricao={e.condoNome || condo?.nome}
        acoes={
          <>
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <ImportarPdf
              modo="editor"
              destino="exercicios"
              condominio={condo}
              nomeCondominio={e.condoNome || condo?.nome || ""}
              aoAplicar={(r) => {
                mudar({
                  demonstrativo: r.demonstrativo,
                  origem: origemComArquivo(e.origem, r.arquivo),
                  ...(r.consideracoes ? { consid: aplicarConsideracoesAoExercicio(e.consid, r.consideracoes) } : {}),
                  ...(r.previsaoSugerida ? { previsaoSugerida: previsaoSugeridaDoPdf(r.previsaoSugerida) } : {}),
                });
                setSnapshotImportado(r.demonstrativo);
              }}
            />
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
            <Button variant="outline" type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:text-destructive">
              <Trash2 /> Excluir
            </Button>
            <Button type="submit" form="form-exercicio" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      <form id="form-exercicio" onSubmit={enviar} className="space-y-6" noValidate>
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
              <DinheiroInput value={e.rateioAtual} onChange={(v) => mudar({ rateioAtual: v })} />
            </Field>
            <Field rotulo="Rateio aprovado" dica="Valor aprovado em assembleia." className="sm:col-span-3">
              <DinheiroInput value={e.rateioAprovado} onChange={(v) => mudar({ rateioAprovado: v })} />
            </Field>
          </div>
        </SectionCard>

        <EditorDemonstrativo
          valor={demonstrativo}
          onChange={(d) => mudar({ demonstrativo: d })}
          descricaoDespesas="Organize as despesas por grupo (Pessoal, Consumo, Manutenção…). São a base da previsão calculada pelo demonstrativo."
        />
      </form>

      <DialogoDivergencia
        aberto={confirmarDivergencia}
        aoMudar={setConfirmarDivergencia}
        divergencias={divergencias}
        aoConfirmar={() => salvar.mutateAsync(prepararExercicio(e)).then(() => setSnapshotImportado(null))}
      />

      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir prestação de contas?"
        descricao={`O exercício ${e.ano} de ${e.condoNome} será excluído. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
