import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarPlus, Loader2, Megaphone, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import {
  DataInput,
  DinheiroInput,
  InteiroInput,
  MesAnoInput,
  NumeroInput,
  PercentualInput,
  Selecao,
} from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves, itemQuery } from "@/lib/queries";
import { mascaraCNPJ } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { condominioPadrao, normalizarCondominio, prepararCondominio } from "@/domain/condominio";
import type { Arredondamento, Condominio, ModoRegra, VariacaoMetodo } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/condominios/$id")({
  head: () => cabecalho("Condomínio", "Cadastro completo do condomínio."),
  loader: async ({ params, context: { queryClient } }) => {
    if (params.id === "novo") return null;
    const c = await queryClient.ensureQueryData(itemQuery<Condominio>("condominios", params.id));
    if (!c) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Condomínio não encontrado.</p>
      <Button variant="link" asChild>
        <Link to="/condominios">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaCondominio,
});

function PaginaCondominio() {
  const { id } = Route.useParams();
  if (id === "novo") return <FormCondominio key="novo" inicial={{ ...condominioPadrao(), id: "" }} />;
  return <CondominioExistente key={id} id={id} />;
}

function CondominioExistente({ id }: { id: string }) {
  const { data } = useSuspenseQuery(itemQuery<Condominio>("condominios", id));
  return <FormCondominio inicial={normalizarCondominio(data ?? { id })} />;
}

const ARREDONDAMENTO: { valor: Arredondamento; rotulo: string }[] = [
  { valor: "truncar", rotulo: "Truncar (sem centavos, para baixo)" },
  { valor: "arredondar", rotulo: "Arredondar (sem centavos)" },
  { valor: "centavos", rotulo: "Manter centavos" },
];
const VARIACAO: { valor: VariacaoMetodo; rotulo: string }[] = [
  { valor: "manual", rotulo: "Manual" },
  { valor: "percentual", rotulo: "Percentual fixo" },
  { valor: "mediaIndices", rotulo: "Média dos índices" },
  { valor: "valor", rotulo: "Valor fixo (R$)" },
];
const MODO_REGRA: { valor: ModoRegra; rotulo: string }[] = [
  { valor: "ultimo", rotulo: "Último valor" },
  { valor: "ultimo+12", rotulo: "Último valor × 12" },
];

function FormCondominio({ inicial }: { inicial: Condominio }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const novo = !inicial.id;
  const [c, setC] = useState<Condominio>(inicial);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const refNome = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Condominio>(campo: K, valor: Condominio[K]) =>
    setC((atual) => ({ ...atual, [campo]: valor }));

  const salvar = useMutation({
    mutationFn: (dados: Condominio) => api.salvar("condominios", dados),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("condominios") });
      queryClient.setQueryData(chaves.item("condominios", salvo.id), salvo);
      toast.success("Condomínio salvo.");
      if (novo) navigate({ to: "/condominios/$id", params: { id: salvo.id }, replace: true });
      else setC(normalizarCondominio(salvo));
    },
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir("condominios", c.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.store("condominios") });
      toast.success("Condomínio excluído.");
      navigate({ to: "/condominios" });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const r = prepararCondominio(c);
    if (!r.ok) {
      setErroNome(r.erro);
      toast.error(r.erro);
      refNome.current?.focus();
      return;
    }
    setErroNome(null);
    setC(r.valor);
    salvar.mutate(r.valor);
  }

  const botaoSalvar = (
    <Button type="submit" form="form-condominio" disabled={salvar.isPending}>
      {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
      Salvar
    </Button>
  );

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/condominios">
              <ArrowLeft /> Condomínios
            </Link>
          </Button>
        }
        titulo={novo ? "Novo condomínio" : c.nome || "Condomínio"}
        descricao={!novo && c.codigo ? `Código ${c.codigo}` : undefined}
        acoes={
          <>
            {!novo && (
              <Button variant="outline" asChild>
                <Link to="/relatorio-mensal" search={{ novo: inicial.id }}>
                  <CalendarPlus /> Novo relatório mensal
                </Link>
              </Button>
            )}
            {!novo && (
              <Button variant="outline" asChild>
                <Link to="/editais" search={{ novo: inicial.id }}>
                  <Megaphone /> Novo edital
                </Link>
              </Button>
            )}
            {!novo && (
              <Button variant="outline" type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:text-destructive">
                <Trash2 /> Excluir
              </Button>
            )}
            {botaoSalvar}
          </>
        }
      />

      <form id="form-condominio" onSubmit={enviar} className="space-y-6" noValidate>
        <SectionCard titulo="Dados gerais">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field rotulo="Código" className="sm:col-span-1">
              <Input value={c.codigo} onChange={(e) => set("codigo", e.target.value)} />
            </Field>
            <Field rotulo="Nome" obrigatorio erro={erroNome} className="sm:col-span-5">
              <Input
                value={c.nome}
                onChange={(e) => {
                  set("nome", e.target.value);
                  if (erroNome) setErroNome(null);
                }}
                ref={refNome}
              />
            </Field>
            <Field rotulo="Nome no relatório" dica="Se ficar vazio, será usado o nome." className="sm:col-span-4">
              <Input value={c.nomeRelatorio} onChange={(e) => set("nomeRelatorio", e.target.value)} placeholder={c.nome} />
            </Field>
            <Field rotulo="CNPJ" className="sm:col-span-2">
              <Input
                value={c.cnpj}
                onChange={(e) => set("cnpj", mascaraCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                className="num"
              />
            </Field>
            <Field rotulo="Unidades" className="sm:col-span-2">
              <InteiroInput value={c.unidades} onChange={(v) => set("unidades", v)} />
            </Field>
            <Field rotulo="Rateio mensal atual" className="sm:col-span-2">
              <DinheiroInput value={c.rateioAtual} onChange={(v) => set("rateioAtual", v)} />
            </Field>
            <Field rotulo="Variação padrão" dica="Usada na previsão orçamentária." className="sm:col-span-2">
              <PercentualInput value={c.variacaoPadrao} onChange={(v) => set("variacaoPadrao", v)} />
            </Field>
            <Field rotulo="Endereço (edital)" className="sm:col-span-6">
              <Input value={c.enderecoEdital} onChange={(e) => set("enderecoEdital", e.target.value)} />
            </Field>
            <Field rotulo="Termo da administradora" dica="Como a administradora é citada nos documentos." className="sm:col-span-3">
              <Input value={c.administradoraTermo} onChange={(e) => set("administradoraTermo", e.target.value)} />
            </Field>
            <Field rotulo="Prazo de convocação (dias)" className="sm:col-span-1">
              <InteiroInput value={c.prazoConvocacao} onChange={(v) => set("prazoConvocacao", v ?? 0)} />
            </Field>
            <Field rotulo="Quórum" className="sm:col-span-2">
              <Input value={c.quorum} onChange={(e) => set("quorum", e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard titulo="Administração" descricao="Síndico, subsíndico, conselheiros e respectivos mandatos.">
          <RepeatableList
            itens={c.administracao}
            onChange={(v) => set("administracao", v)}
            novo={() => ({ cargo: "", nome: "", mandatoFim: "" })}
            colunas="@2xl:grid-cols-[12rem_1fr_8rem]"
            cabecalhos={["Cargo", "Nome", "Fim do mandato"]}
            rotuloAdicionar="Adicionar membro"
            vazio="Nenhum membro da administração informado."
            render={(m, up) => (
              <>
                <Input aria-label="Cargo" placeholder="Cargo" value={m.cargo} onChange={(e) => up({ cargo: e.target.value })} />
                <Input aria-label="Nome" placeholder="Nome" value={m.nome} onChange={(e) => up({ nome: e.target.value })} />
                <MesAnoInput aria-label="Fim do mandato" value={m.mandatoFim} onChange={(v) => up({ mandatoFim: v })} />
              </>
            )}
          />
        </SectionCard>

        <SectionCard titulo="Seguro">
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Field rotulo="Seguradora">
              <Input value={c.seguradora} onChange={(e) => set("seguradora", e.target.value)} />
            </Field>
            <Field rotulo="Vigência do seguro (até)">
              <DataInput value={c.vigenciaSeguro} onChange={(v) => set("vigenciaSeguro", v)} />
            </Field>
            <Field rotulo="Risco absoluto">
              <DinheiroInput
                value={c.seguro.riscoAbsoluto}
                onChange={(v) => set("seguro", { ...c.seguro, riscoAbsoluto: v })}
              />
            </Field>
          </div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">Coberturas</Label>
          <RepeatableList
            itens={c.seguro.coberturas}
            onChange={(v) => set("seguro", { ...c.seguro, coberturas: v })}
            novo={() => ({ desc: "", valor: null })}
            colunas="@2xl:grid-cols-[1fr_12rem]"
            cabecalhos={["Descrição", "Valor"]}
            rotuloAdicionar="Adicionar cobertura"
            vazio="Nenhuma cobertura informada."
            render={(cob, up) => (
              <>
                <Input aria-label="Descrição" placeholder="Descrição da cobertura" value={cob.desc} onChange={(e) => up({ desc: e.target.value })} />
                <DinheiroInput aria-label="Valor" value={cob.valor} onChange={(v) => up({ valor: v })} />
              </>
            )}
          />
        </SectionCard>

        <SectionCard titulo="Manutenções e vistorias">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field rotulo="Recarga de extintores (vence em)">
              <DataInput value={c.vigenciaExtintores} onChange={(v) => set("vigenciaExtintores", v)} />
            </Field>
            <Field rotulo="Última limpeza da caixa de gordura">
              <DataInput value={c.ultGordura} onChange={(v) => set("ultGordura", v)} />
            </Field>
            <Field rotulo="Última dedetização">
              <DataInput value={c.ultDedetizacao} onChange={(v) => set("ultDedetizacao", v)} />
            </Field>
            <Field rotulo="Última limpeza da caixa d'água">
              <DataInput value={c.ultCaixaDagua} onChange={(v) => set("ultCaixaDagua", v)} />
            </Field>
            <Field rotulo="Ano da última vistoria técnica">
              <InteiroInput value={c.vistoriaAno} onChange={(v) => set("vistoriaAno", v)} maxLength={4} placeholder="aaaa" />
            </Field>
            <Field rotulo="Intervalo da vistoria (anos)">
              <InteiroInput value={c.vistoriaIntervalo} onChange={(v) => set("vistoriaIntervalo", v ?? 3)} />
            </Field>
            <Field rotulo="Lei da vistoria" className="sm:col-span-2">
              <Input value={c.vistoriaLei} onChange={(e) => set("vistoriaLei", e.target.value)} placeholder="Ex.: Lei municipal nº …" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard titulo="Índices de correção aplicados">
          <RepeatableList
            itens={c.indices}
            onChange={(v) => set("indices", v)}
            novo={() => ({ ano: new Date().getFullYear(), pct: null })}
            colunas="grid-cols-2 @2xl:grid-cols-[8rem_10rem]"
            cabecalhos={["Ano", "Percentual"]}
            rotuloAdicionar="Adicionar índice"
            vazio="Nenhum índice informado."
            render={(ind, up) => (
              <>
                <InteiroInput aria-label="Ano" maxLength={4} value={ind.ano} onChange={(v) => up({ ano: v })} />
                <PercentualInput aria-label="Percentual" value={ind.pct} onChange={(v) => up({ pct: v })} />
              </>
            )}
          />
        </SectionCard>

        <SectionCard titulo="Histórico mensal e automações">
          <div className="mb-5 flex items-center gap-3">
            <Switch id="somente-anual" checked={c.somenteAnual} onCheckedChange={(v) => set("somenteAnual", v)} />
            <Label htmlFor="somente-anual" className="text-sm">
              Somente prestação de contas anual (sem histórico mensal)
            </Label>
          </div>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Field rotulo="Método da variação">
              <Selecao value={c.variacaoMetodo} onChange={(v) => set("variacaoMetodo", v)} opcoes={VARIACAO} />
            </Field>
            {c.variacaoMetodo === "valor" ? (
              <Field rotulo="Variação (R$)" dica="Valor fixo somado à base, positivo ou negativo — não é percentual.">
                <DinheiroInput value={c.variacaoParam} onChange={(v) => set("variacaoParam", v)} />
              </Field>
            ) : (
              <Field rotulo="Parâmetro da variação" dica="Percentual ou quantidade de índices, conforme o método.">
                <NumeroInput value={c.variacaoParam} onChange={(v) => set("variacaoParam", v)} />
              </Field>
            )}
          </div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">Regras de preenchimento automático</Label>
          <RepeatableList
            itens={c.regras}
            onChange={(v) => set("regras", v)}
            novo={() => ({ campo: "", rotulo: "", fonte: "", regex: "", modo: "ultimo" as ModoRegra })}
            colunas="@2xl:grid-cols-[1fr_1fr_1fr_1.4fr_10rem]"
            cabecalhos={["Campo", "Rótulo", "Fonte", "Expressão (regex)", "Modo"]}
            rotuloAdicionar="Adicionar regra"
            vazio="Nenhuma regra de preenchimento automático."
            render={(r, up) => (
              <>
                <Input aria-label="Campo" placeholder="Campo" value={r.campo} onChange={(e) => up({ campo: e.target.value })} />
                <Input aria-label="Rótulo" placeholder="Rótulo" value={r.rotulo} onChange={(e) => up({ rotulo: e.target.value })} />
                <Input aria-label="Fonte" placeholder="Fonte" value={r.fonte} onChange={(e) => up({ fonte: e.target.value })} />
                <Input aria-label="Expressão" placeholder="^energia" className="font-mono text-xs" value={r.regex} onChange={(e) => up({ regex: e.target.value })} />
                <Selecao value={r.modo} onChange={(v) => up({ modo: v })} opcoes={MODO_REGRA} />
              </>
            )}
          />
        </SectionCard>

        <SectionCard titulo="Regras do relatório">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field rotulo="Rubrica de dedução (regex)" dica='Padrão: "fundo de caixa p/ obras"'>
              <Input className="font-mono text-xs" value={c.deducaoRegex} onChange={(e) => set("deducaoRegex", e.target.value)} />
            </Field>
            <Field rotulo="Rubrica de água (regex)" dica='Padrão: "^[áa]gua"'>
              <Input className="font-mono text-xs" value={c.aguaRubrica} onChange={(e) => set("aguaRubrica", e.target.value)} />
            </Field>
            <Field rotulo="Arredondamento do rateio">
              <Selecao value={c.arredondamento} onChange={(v) => set("arredondamento", v)} opcoes={ARREDONDAMENTO} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard titulo="De-para de rótulos" descricao="Substitui rótulos do balancete pelos nomes usados no relatório.">
          <RepeatableList
            itens={c.mapeamento}
            onChange={(v) => set("mapeamento", v)}
            novo={() => ({ de: "", para: "" })}
            colunas="@2xl:grid-cols-2"
            cabecalhos={["De (como vem no balancete)", "Para (como sai no relatório)"]}
            rotuloAdicionar="Adicionar de-para"
            vazio="Nenhum de-para cadastrado."
            render={(m, up) => (
              <>
                <Input aria-label="De" value={m.de} onChange={(e) => up({ de: e.target.value })} />
                <Input aria-label="Para" value={m.para} onChange={(e) => up({ para: e.target.value })} />
              </>
            )}
          />
        </SectionCard>

        <div className="flex justify-end">{botaoSalvar}</div>
      </form>

      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir condomínio?"
        descricao={
          <>
            <strong>{c.nome}</strong> será excluído definitivamente. Prestações de contas, editais e atas
            vinculados não serão apagados automaticamente.
          </>
        }
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
