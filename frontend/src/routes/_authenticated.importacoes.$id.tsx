import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Info, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { InteiroInput } from "@/components/app/inputs";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { ResumoImportacao } from "@/components/importacao/ResumoImportacao";
import { ROTULO_STATUS } from "@/components/importacao/status";
import { marcarCriadoPorPdf } from "@/components/importacao/criadoPorPdf";
import { focarConteudoApos } from "@/components/app/foco";
import { api } from "@/lib/api";
import { novoId } from "@/lib/id";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { formatDataHora, mascaraCNPJ } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { cn } from "@/lib/utils";
import { normalizarCondominio, prepararCondominio } from "@/domain/condominio";
import {
  anoDoRelatorio,
  aplicarConsideracoesAoExercicio,
  camposComplementares,
  camposFaltando,
  colunaPadrao,
  condominioDoCadastro,
  demonstrativoDoRelatorio,
  encontrarCondominio,
  exercicioImportado,
  mensalImportado,
} from "@/domain/importacao";
import { normalizarMensal, validarMensal } from "@/domain/mensal";
import { previsaoSugeridaDoPdf } from "@/domain/previsaoSugerida";
import { validarNovoExercicio } from "@/domain/exercicio";
import type { Condominio, ConfigEscritorio, Exercicio, Importacao, Mensal } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/importacoes/$id")({
  head: () => cabecalho("Conferir importação", "Conferência do cadastro básico do condomínio lido do PDF do Systemar."),
  loader: async ({ params, context: { queryClient } }) => {
    const [imp] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Importacao>("importacoes", params.id)),
      queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
      queryClient.ensureQueryData(listaQuery<Mensal>("mensais")),
      queryClient.ensureQueryData(listaQuery<Exercicio>("exercicios")),
      queryClient.ensureQueryData(itemQuery<ConfigEscritorio>("config", "escritorio")),
    ]);
    if (!imp) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Importação não encontrada.</p>
      <Button variant="link" asChild>
        <Link to="/importacoes">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaImportacao,
});

function PaginaImportacao() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Importacao>("importacoes", id));
  if (!data) return null;
  return <Conferencia key={id} imp={data} />;
}

type Cad = { codigo: string; nome: string; cnpj: string };
const ROTULO_CAMPO: Record<keyof Cad, string> = { codigo: "Código", nome: "Nome", cnpj: "CNPJ" };

function Conferencia({ imp }: { imp: Importacao }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const { data: mensais } = useSuspenseQuery(listaQuery<Mensal>("mensais"));
  const { data: exercicios } = useSuspenseQuery(listaQuery<Exercicio>("exercicios"));
  const { data: escritorio } = useSuspenseQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const destino = imp.destino ?? "mensais";
  const rel = imp.relatorio;
  const pendente = imp.status === "pendente";

  const [cad, setCad] = useState<Cad>({
    codigo: imp.cadastro?.codigo ?? "",
    nome: imp.cadastro?.nome ?? "",
    cnpj: imp.cadastro?.cnpj ?? "",
  });
  const [coluna, setColuna] = useState<string | null>(() => colunaPadrao(rel, destino));
  const [ano, setAno] = useState<number | null>(() => anoDoRelatorio(rel, colunaPadrao(rel, destino)));
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [descartar, setDescartar] = useState(false);
  const [confirmarComplemento, setConfirmarComplemento] = useState(false);

  // O que faltava no PDF fica destacado, mesmo depois de preenchido aqui.
  const faltavam = useMemo(() => new Set(camposFaltando(imp.cadastro ?? { codigo: null, nome: null, cnpj: null })), [imp.cadastro]);
  const existente = encontrarCondominio(condominios, cad);
  // Campos do cadastro já existente que estão em branco e o PDF conferido traz preenchidos —
  // oferece completar o cadastro, nunca sobrescrever um valor já cadastrado.
  const complementares = useMemo(() => (existente ? camposComplementares(existente, cad) : []), [existente, cad]);
  const demonstrativo = useMemo(() => demonstrativoDoRelatorio(rel, coluna, cad.nome), [rel, coluna, cad.nome]);
  const rotulo = destino === "mensais" ? "relatório mensal" : "prestação de contas";
  // Ids definidos uma vez: repetir a confirmação (ex.: depois de falha de rede) manda o mesmo pedido.
  const [ids] = useState(() => ({ condominio: novoId(), registro: novoId() }));

  const confirmar = useMutation({
    mutationFn: async () => {
      // 1) Valida tudo antes de gravar qualquer coisa.
      const novo = prepararCondominio(condominioDoCadastro(cad));
      if (!existente && !novo.ok) throw new Error(novo.erro);
      if (destino === "exercicios" && !ano) throw new Error("Informe o ano do exercício.");
      if (existente) {
        const c = normalizarCondominio(existente);
        if (destino === "mensais") {
          const { competencia } = mensalImportado(c, rel, coluna, imp.arquivo);
          const v = validarMensal(c.id, competencia, mensais.map((m) => normalizarMensal(m)));
          if (!v.ok) throw new Error(v.erro);
        } else {
          const v = validarNovoExercicio(c.id, ano, exercicios);
          if (!v.ok) throw new Error(v.erro);
        }
      } else if (destino === "mensais") {
        const { competencia } = mensalImportado(normalizarCondominio({ ...condominioDoCadastro(cad), id: "_" }), rel, coluna, imp.arquivo);
        const v = validarMensal("_", competencia, []);
        if (!v.ok) throw new Error(v.erro);
      }

      // 2) Monta tudo com os ids já definidos e envia numa ÚNICA chamada: o servidor cria o
      //    condomínio (se novo), grava o relatório e confirma a importação de uma vez só.
      const novoValor = existente ? null : (novo as { ok: true; valor: Omit<Condominio, "id"> }).valor;
      const condo = existente ? normalizarCondominio(existente) : normalizarCondominio({ ...novoValor!, id: ids.condominio });
      const registro: Mensal | Exercicio =
        destino === "mensais"
          ? { ...mensalImportado(condo, rel, coluna, imp.arquivo).registro, id: ids.registro }
          : (() => {
              const base = exercicioImportado(condo, ano!, escritorio?.cidade ?? "", rel, coluna, imp.arquivo);
              return {
                ...base,
                consid: aplicarConsideracoesAoExercicio(base.consid, imp.consideracoes ?? null),
                previsaoSugerida: imp.previsaoSugerida ? previsaoSugeridaDoPdf(imp.previsaoSugerida) : null,
                id: ids.registro,
              };
            })();
      return api.confirmarImportacao({
        importacaoId: imp.id,
        destino,
        condominio: existente
          ? {
              id: existente.id,
              ...(complementares.length
                ? { camposComplementares: { codigo: cad.codigo || null, nome: cad.nome || null, cnpj: cad.cnpj || null } }
                : {}),
            }
          : { ...novoValor!, id: ids.condominio },
        registro,
        cadastro: { codigo: cad.codigo || null, nome: cad.nome || null, cnpj: cad.cnpj || null },
      });
    },
    onSuccess: ({ registro, criouCondominio, atualizouCadastro, reutilizado }) => {
      for (const s of ["condominios", destino, "importacoes"] as const) queryClient.invalidateQueries({ queryKey: chaves.store(s) });
      queryClient.setQueryData(chaves.item(destino, registro.id), registro);
      const gravado = destino === "mensais" ? "Relatório mensal gravado" : "Prestação de contas gravada";
      if (reutilizado) {
        toast.info(`Esta importação já estava confirmada. Abrindo o ${rotulo} gravado.`);
      } else {
        // Só um registro recém-criado a partir do PDF ganha a conferência dos totais no primeiro Salvar.
        marcarCriadoPorPdf(destino, registro.id);
        if (criouCondominio) toast.success(`Condomínio cadastrado e ${rotulo} gravado a partir do PDF.`);
        else if (atualizouCadastro) toast.success(`Cadastro do condomínio completado e ${rotulo} gravado a partir do PDF.`);
        else toast.success(`${gravado} a partir do PDF.`);
      }
      focarConteudoApos(
        destino === "mensais"
          ? navigate({ to: "/relatorio-mensal/$id", params: { id: registro.id } })
          : navigate({ to: "/prestacao-contas/$id", params: { id: registro.id } }),
      );
    },
  });

  const marcarDescartado = useMutation({
    mutationFn: () => api.salvar<Importacao>("importacoes", { ...imp, status: "descartado" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.store("importacoes") });
      toast.success("Importação descartada.");
      focarConteudoApos(navigate({ to: "/importacoes" }));
    },
  });

  const status = ROTULO_STATUS[imp.status] ?? ROTULO_STATUS.pendente;

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto min-h-0 p-0 text-muted-foreground" asChild>
            <Link to="/importacoes">
              <ArrowLeft /> Importações de PDF
            </Link>
          </Button>
        }
        titulo="Conferir importação"
        descricao={`${imp.arquivo} · importado em ${formatDataHora(imp.importadoEm)} · destino: ${destino === "mensais" ? "Relatório mensal" : "Prestação de contas"}`}
        acoes={
          <>
            <Badge variant={status.variante}>{status.rotulo}</Badge>
            {pendente && (
              <>
                <Button variant="outline" onClick={() => setDescartar(true)} disabled={confirmar.isPending}>
                  <X /> Descartar
                </Button>
                <Button
                  onClick={() => {
                    if (!existente && !cad.nome.trim()) {
                      setErroNome("Informe o nome do condomínio.");
                      return;
                    }
                    setErroNome(null);
                    if (existente && complementares.length) {
                      setConfirmarComplemento(true);
                      return;
                    }
                    confirmar.mutate();
                  }}
                  disabled={confirmar.isPending}
                >
                  {confirmar.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                  Confirmar e gravar
                </Button>
              </>
            )}
          </>
        }
      />

      {!pendente && (
        <Alert className="mb-6">
          <Info />
          <AlertDescription>
            {imp.status === "confirmado" ? (
              <>
                Importação confirmada.{" "}
                {imp.registroId && (
                  <Link
                    className="font-medium underline"
                    {...(destino === "mensais"
                      ? { to: "/relatorio-mensal/$id" as const, params: { id: imp.registroId } }
                      : { to: "/prestacao-contas/$id" as const, params: { id: imp.registroId } })}
                  >
                    Abrir o {rotulo}
                  </Link>
                )}
              </>
            ) : (
              "Importação descartada; nada foi gravado."
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <SectionCard titulo="Cadastro básico do condomínio" descricao="Dados lidos do PDF. Os campos em destaque não vieram no relatório.">
          <fieldset disabled={!pendente} className="grid gap-4">
            {(Object.keys(ROTULO_CAMPO) as (keyof Cad)[]).map((k) => (
              <Field
                key={k}
                rotulo={ROTULO_CAMPO[k]}
                obrigatorio={k === "nome"}
                erro={k === "nome" ? erroNome : null}
                {...(faltavam.has(k) ? { dica: "Não encontrado no PDF — preencha se souber." } : {})}
                className={cn(faltavam.has(k) && "rounded-md border border-warning/60 bg-warning/10 p-2")}
              >
                <Input
                  value={cad[k]}
                  onChange={(e) => setCad((c) => ({ ...c, [k]: k === "cnpj" ? mascaraCNPJ(e.target.value) : e.target.value }))}
                />
              </Field>
            ))}
            {(imp.cadastro?.contas?.length ?? 0) > 0 && (
              <div className="text-sm">
                <p className="text-xs font-medium text-muted-foreground">Contas bancárias no saldo anterior</p>
                <ul className="mt-1 list-disc pl-5">
                  {imp.cadastro.contas.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </fieldset>
          {pendente && existente && (
            <Alert className="mt-4">
              <Info />
              <AlertDescription>
                Já existe o condomínio <span className="font-medium">{existente.nome}</span> com este código ou CNPJ. O {rotulo} será gravado nele, sem criar outro cadastro.
              </AlertDescription>
            </Alert>
          )}
          {pendente && !existente && (
            <p className="mt-4 text-xs text-muted-foreground">
              Ao confirmar, o condomínio é cadastrado com estes dados (os demais campos ficam com os valores padrão e podem ser completados depois em Condomínios).
            </p>
          )}
        </SectionCard>

        <SectionCard titulo={`Relatório (${rotulo})`}>
          <fieldset disabled={!pendente} className="grid gap-4">
            <ResumoImportacao
              arquivo={imp.arquivo}
              relatorio={rel}
              demonstrativo={demonstrativo}
              coluna={coluna}
              aoMudarColuna={setColuna}
              destino={destino}
              consideracoes={imp.consideracoes ?? null}
              previsaoSugerida={imp.previsaoSugerida ?? null}
            />
            {destino === "exercicios" && (
              <Field rotulo="Ano do exercício" obrigatorio className="max-w-[10rem]">
                <InteiroInput value={ano} onChange={setAno} maxLength={4} />
              </Field>
            )}
          </fieldset>
        </SectionCard>
      </div>

      <ConfirmDialog
        aberto={confirmarComplemento}
        aoMudar={setConfirmarComplemento}
        titulo="Completar cadastro do condomínio?"
        descricao={
          <>
            O condomínio <span className="font-medium">{existente?.nome}</span> já está cadastrado, mas sem estes dados
            — o PDF conferido traz:
            <ul className="mt-2 list-disc pl-5">
              {complementares.map((k) => (
                <li key={k}>
                  <span className="font-medium">{ROTULO_CAMPO[k]}:</span> {cad[k]}
                </li>
              ))}
            </ul>
            Só esses campos (hoje em branco no cadastro) serão preenchidos; nada que já está cadastrado muda.
          </>
        }
        rotuloConfirmar="Completar e gravar"
        aoConfirmar={() => confirmar.mutateAsync()}
      />

      <ConfirmDialog
        aberto={descartar}
        aoMudar={setDescartar}
        titulo="Descartar importação?"
        descricao="Nenhum condomínio nem relatório será gravado. A importação fica registrada como descartada."
        rotuloConfirmar="Descartar"
        destrutivo
        aoConfirmar={() => marcarDescartado.mutateAsync()}
      />
    </>
  );
}
