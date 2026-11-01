import { Link } from "@/components/app/LinkPermitido";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarPlus, ChevronsDownUp, ChevronsUpDown, Loader2, Megaphone, RefreshCw, Save, TriangleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { SecaoRecolhivel } from "@/components/app/SecaoRecolhivel";
import { contagem } from "@/components/app/textos";
import { AjudaDePara, AjudaExpressoes } from "@/components/condominios/AjudaCadastro";
import { Field } from "@/components/app/Field";
import { CampoRubrica } from "@/components/app/CampoRubrica";
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
import { mascaraCNPJ, formatDataHora } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { useUsuario } from "@/lib/auth";
import { condominioPadrao, normalizarCondominio, prepararCondominio } from "@/domain/condominio";
import { consultarCnpjReceita, divergenciasCnpj, enderecoDaReceita } from "@/lib/receitaCnpj";
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

const SECOES = ["administracao", "seguro", "manutencoes", "documentos", "indices", "automacoes", "regras", "depara"] as const;
type Secao = (typeof SECOES)[number];
const todas = (v: boolean) => Object.fromEntries(SECOES.map((k) => [k, v])) as Record<Secao, boolean>;
const TITULOS: Record<Secao, string> = {
  administracao: "Administração",
  seguro: "Seguro",
  manutencoes: "Manutenções e vistorias",
  documentos: "Documentos obrigatórios",
  indices: "Índices de correção aplicados",
  automacoes: "Histórico mensal e automações",
  regras: "Regras do relatório",
  depara: "De-para de rótulos",
};
const idSecao = (k: Secao) => `secao-${k}`;

/** Resumo de uma linha para cada seção recolhível (só contagem do que está preenchido). */
function resumos(c: Condominio): Record<Secao, string> {
  const preenchido = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
  const datas = [c.vigenciaExtintores, c.ultGordura, c.ultDedetizacao, c.ultCaixaDagua, c.vistoriaAno].filter(preenchido).length;
  const anos = c.indices.map((i) => i.ano).filter((a): a is number => typeof a === "number").sort((a, b) => a - b);
  const metodo = VARIACAO.find((v) => v.valor === c.variacaoMetodo)?.rotulo ?? c.variacaoMetodo;
  const arred = ARREDONDAMENTO.find((v) => v.valor === c.arredondamento)?.rotulo ?? c.arredondamento;
  return {
    administracao: c.administracao.length ? contagem(c.administracao.length, "membro informado", "membros informados") : "Ninguém informado",
    seguro: [
      c.seguradora || "Seguradora não informada",
      c.vigenciaSeguro ? `vigente até ${c.vigenciaSeguro}` : "sem vigência",
      c.seguro.coberturas.length ? contagem(c.seguro.coberturas.length, "cobertura", "coberturas") : "nenhuma cobertura",
    ].join(" · "),
    manutencoes: `${datas} de 5 datas informadas`,
    documentos: c.documentosObrigatorios.length
      ? `${c.documentosObrigatorios.filter((d) => d.status === "ok").length} de ${c.documentosObrigatorios.length} em dia`
      : "Nenhum item cadastrado",
    indices: anos.length
      ? `${contagem(c.indices.length, "índice", "índices")} (${anos[0] === anos[anos.length - 1] ? anos[0] : `${anos[0]} a ${anos[anos.length - 1]}`})`
      : c.indices.length
        ? contagem(c.indices.length, "índice", "índices")
        : "Nenhum índice informado",
    automacoes: [
      c.somenteAnual ? "Só prestação anual" : "Com histórico mensal",
      `variação: ${metodo}`,
      c.regras.length ? contagem(c.regras.length, "regra", "regras") : "nenhuma regra",
    ].join(" · "),
    regras: `${arred}${c.deducaoRegex ? ` · dedução: “${c.deducaoRegex}”` : " · sem dedução"}`,
    depara: c.mapeamento.length ? contagem(c.mapeamento.length, "substituição", "substituições") : "Nenhuma substituição",
  };
}

function FormCondominio({ inicial }: { inicial: Condominio }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useUsuario();
  const novo = !inicial.id;
  const [c, setC] = useState<Condominio>(inicial);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const refNome = useRef<HTMLInputElement>(null);
  const [abertas, setAbertas] = useState(() => todas(false));
  const abrir = (k: Secao) => (v: boolean) => setAbertas((a) => ({ ...a, [k]: v }));
  const todasAbertas = SECOES.every((k) => abertas[k]);
  const res = resumos(c);
  const irPara = (k: Secao) => {
    setAbertas((a) => ({ ...a, [k]: true }));
    requestAnimationFrame(() => document.getElementById(idSecao(k))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const set = <K extends keyof Condominio>(campo: K, valor: Condominio[K]) =>
    setC((atual) => ({ ...atual, [campo]: valor }));

  const [buscandoReceita, setBuscandoReceita] = useState(false);
  async function atualizarPelaReceita() {
    const digitos = c.cnpj.replace(/\D/g, "");
    if (digitos.length !== 14) {
      toast.error("Informe um CNPJ completo antes de atualizar pela Receita Federal.");
      return;
    }
    setBuscandoReceita(true);
    try {
      const dados = await consultarCnpjReceita(digitos);
      if (!dados) {
        toast.error("Não foi possível encontrar esse CNPJ na Receita Federal.");
        return;
      }
      set("enderecoEdital", enderecoDaReceita(dados));
      const avisos = divergenciasCnpj(dados, c.nome);
      if (avisos.length) {
        toast.warning(`Endereço atualizado. Atenção: ${avisos.join("; ")}. Revise antes de salvar.`);
      } else {
        toast.success("Endereço atualizado a partir da Receita Federal. Revise e salve.");
      }
    } finally {
      setBuscandoReceita(false);
    }
  }

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
    // Só grava atualizadoEm/atualizadoPor no que é enviado pro servidor — não no estado local
    // imediato: se o salvamento falhar, "Atualizado em" não deve passar a impressão de que
    // salvou (o `onSuccess` abaixo é quem reflete o registro confirmado de volta na tela).
    salvar.mutate({ ...r.valor, atualizadoEm: new Date().toISOString(), atualizadoPor: usuario?.nome || usuario?.login || "" });
  }

  const botaoSalvar = (
    <Button permissao="condominios.editar" type="submit" form="form-condominio" disabled={salvar.isPending}>
      {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
      Salvar
    </Button>
  );

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto min-h-0 p-0 text-muted-foreground" asChild>
            <Link to="/condominios">
              <ArrowLeft /> Condomínios
            </Link>
          </Button>
        }
        titulo={novo ? "Novo condomínio" : c.nome || "Condomínio"}
        descricao={
          !novo && (c.codigo || c.atualizadoEm) ? (
            <>
              {c.codigo && `Código ${c.codigo}`}
              {c.codigo && c.atualizadoEm && " · "}
              {c.atualizadoEm && (
                <>
                  Atualizado em {formatDataHora(c.atualizadoEm)}
                  {c.atualizadoPor && ` por ${c.atualizadoPor}`}
                </>
              )}
            </>
          ) : undefined
        }
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
              <Button permissao="condominios.editar" variant="outline" type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:text-destructive">
                <Trash2 /> Excluir
              </Button>
            )}
            {botaoSalvar}
          </>
        }
      />

      {c.alertaCadastro && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert />
          <AlertDescription>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{c.alertaCadastro}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => set("alertaCadastro", null)}>
                Dispensar alerta
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <form id="form-condominio" onSubmit={enviar} className="space-y-6" noValidate>
        <SectionCard titulo="Dados gerais" descricao="O essencial para começar. O nome é obrigatório; o resto pode ser completado depois.">
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
            <Field rotulo="Área total (m²)" dica="Informativo, lido da Listagem de Condomínios." className="sm:col-span-2">
              <NumeroInput value={c.areaTotalM2 ?? null} onChange={(v) => set("areaTotalM2", v)} />
            </Field>
            <Field
              rotulo="Endereço (edital)"
              dica="O botão preenche a partir do CNPJ, usando os dados públicos da Receita Federal — revise antes de salvar."
              className="sm:col-span-6"
            >
              <div className="flex gap-2">
                <Input value={c.enderecoEdital} onChange={(e) => set("enderecoEdital", e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" onClick={atualizarPelaReceita} disabled={buscandoReceita}>
                  {buscandoReceita ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Atualizar pela Receita
                </Button>
              </div>
            </Field>
            <Field
              rotulo="Pasta de documentos"
              dica="Caminho da pasta deste condomínio no servidor de arquivos da empresa (NAS), usado pelo agente de indexação da Consulta de Documentos para localizar convenção/regimento/atas. Deixe em branco para não indexar este condomínio."
              className="sm:col-span-6"
            >
              <Input
                value={c.pastaDocumentos}
                onChange={(e) => set("pastaDocumentos", e.target.value)}
                placeholder="\\servidor\condominios\Nome do Condomínio"
              />
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

        <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Demais informações</h2>
            <p className="text-xs text-muted-foreground">
              Abra cada parte quando precisar. Tudo o que estiver preenchido é salvo junto, aberto ou recolhido.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAbertas(todas(!todasAbertas))}>
            {todasAbertas ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {todasAbertas ? "Recolher todas" : "Abrir todas"}
          </Button>
        </div>

        <nav aria-label="Ir direto para uma seção" className="flex flex-wrap gap-1.5">
          {SECOES.map((k) => (
            <Button key={k} type="button" variant="ghost" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => irPara(k)}>
              {TITULOS[k]}
            </Button>
          ))}
        </nav>

        <SecaoRecolhivel
          id={idSecao("administracao")}
          titulo="Administração"
          descricao="Síndico, subsíndico, conselheiros e respectivos mandatos."
          resumo={res.administracao}
          aberta={abertas.administracao}
          aoMudar={abrir("administracao")}
        >
          <RepeatableList
            itens={c.administracao}
            onChange={(v) => set("administracao", v)}
            novo={() => ({ cargo: "", nome: "", mandatoFim: "", identificacao: "", telefone: "" })}
            colunas="grid-cols-1 @2xl:grid-cols-[8rem_7rem_minmax(0,1fr)_10rem_8rem]"
            cabecalhos={["Cargo", "Identificação", "Nome", "Telefone", "Fim do mandato"]}
            rotuloAdicionar="Adicionar membro"
            vazio="Nenhum membro da administração informado."
            render={(m, up) => (
              <>
                <Input aria-label="Cargo" placeholder="Cargo" value={m.cargo} onChange={(e) => up({ cargo: e.target.value })} />
                <Input
                  aria-label="Identificação"
                  placeholder="Unidade, sala, box..."
                  value={m.identificacao ?? ""}
                  onChange={(e) => up({ identificacao: e.target.value })}
                />
                <Input aria-label="Nome" placeholder="Nome" value={m.nome} onChange={(e) => up({ nome: e.target.value })} />
                <Input aria-label="Telefone" placeholder="Telefone" value={m.telefone ?? ""} onChange={(e) => up({ telefone: e.target.value })} />
                <MesAnoInput aria-label="Fim do mandato" value={m.mandatoFim} onChange={(v) => up({ mandatoFim: v })} />
              </>
            )}
          />
        </SecaoRecolhivel>

        <SecaoRecolhivel id={idSecao("seguro")} titulo="Seguro" resumo={res.seguro} aberta={abertas.seguro} aoMudar={abrir("seguro")}>
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
        </SecaoRecolhivel>

        <SecaoRecolhivel id={idSecao("manutencoes")} titulo="Manutenções e vistorias" resumo={res.manutencoes} aberta={abertas.manutencoes} aoMudar={abrir("manutencoes")}>
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
        </SecaoRecolhivel>

        <SecaoRecolhivel
          id={idSecao("documentos")}
          titulo="Documentos obrigatórios"
          descricao="Lista independente das datas acima — status marcado manualmente (sem vencimento calculado), para itens como alvarás."
          resumo={res.documentos}
          aberta={abertas.documentos}
          aoMudar={abrir("documentos")}
        >
          <RepeatableList
            itens={c.documentosObrigatorios}
            onChange={(v) => set("documentosObrigatorios", v)}
            novo={() => ({ nome: "", status: "pendente" as const, informacao: "", observacao: "", noRelatorio: true })}
            colunas="grid-cols-[minmax(0,1fr)_7rem] @2xl:grid-cols-[minmax(0,11rem)_7rem_9rem_5.5rem_minmax(0,1fr)]"
            cabecalhos={["Item", "Status", "Vencimento / informação", "No relatório", "Observação"]}
            rotuloAdicionar="Adicionar item"
            vazio="Nenhum item cadastrado."
            render={(d, up) => (
              <>
                <Input aria-label="Item" placeholder="Nome do item" value={d.nome} onChange={(e) => up({ nome: e.target.value })} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={
                    d.status === "ok"
                      ? "justify-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                      : "justify-center gap-1.5 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                  }
                  onClick={() => up({ status: d.status === "ok" ? "pendente" : "ok" })}
                >
                  {d.status === "ok" ? "✓ Em dia" : "✗ Pendente"}
                </Button>
                <Input
                  aria-label="Vencimento ou informação"
                  placeholder="dd/mm/aaaa ou texto livre"
                  className="col-span-2 @2xl:col-span-1"
                  value={d.informacao}
                  onChange={(e) => up({ informacao: e.target.value })}
                />
                <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground @2xl:col-span-1 @2xl:justify-self-center">
                  <Switch checked={d.noRelatorio} onCheckedChange={(v) => up({ noRelatorio: v })} aria-label="Incluir no relatório" />
                  <span className="@2xl:hidden">Incluir nas Considerações finais</span>
                </label>
                <Input
                  aria-label="Observação"
                  placeholder="opcional"
                  className="col-span-2 @2xl:col-span-1"
                  value={d.observacao}
                  onChange={(e) => up({ observacao: e.target.value })}
                />
              </>
            )}
          />
        </SecaoRecolhivel>

        <SecaoRecolhivel id={idSecao("indices")} titulo="Índices de correção aplicados" resumo={res.indices} aberta={abertas.indices} aoMudar={abrir("indices")}>
          <RepeatableList
            itens={c.indices}
            onChange={(v) => set("indices", v)}
            novo={() => ({ ano: new Date().getFullYear(), pct: null })}
            colunas="grid-cols-1 @min-[12rem]:grid-cols-2 @2xl:grid-cols-[8rem_10rem]"
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
        </SecaoRecolhivel>

        <SecaoRecolhivel
          id={idSecao("automacoes")}
          titulo="Histórico mensal e automações"
          resumo={res.automacoes}
          aberta={abertas.automacoes}
          aoMudar={abrir("automacoes")}
        >
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
            cabecalhos={["Campo", "Rótulo", "Fonte", "Expressão de busca", "Modo"]}
            rotuloAdicionar="Adicionar regra"
            vazio="Nenhuma regra de preenchimento automático."
            render={(r, up) => (
              <>
                <Input aria-label="Campo" placeholder="Campo" value={r.campo} onChange={(e) => up({ campo: e.target.value })} />
                <Input aria-label="Rótulo" placeholder="Rótulo" value={r.rotulo} onChange={(e) => up({ rotulo: e.target.value })} />
                <Input aria-label="Fonte" placeholder="Fonte" value={r.fonte} onChange={(e) => up({ fonte: e.target.value })} />
                <Input aria-label="Expressão de busca" placeholder="^energia" className="font-mono text-xs" value={r.regex} onChange={(e) => up({ regex: e.target.value })} />
                <Selecao aria-label="Modo" value={r.modo} onChange={(v) => up({ modo: v })} opcoes={MODO_REGRA} />
              </>
            )}
          />
        </SecaoRecolhivel>

        <SecaoRecolhivel
          id={idSecao("regras")}
          titulo="Regras do relatório"
          descricao="Quais despesas saem da base da previsão, quais contam como consumo de água e como arredondar o rateio."
          resumo={res.regras}
          aberta={abertas.regras}
          aoMudar={abrir("regras")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoRubrica
              rotulo="Palavras-chave de dedução"
              dica="Despesas (ou grupos) com uma dessas palavras no nome saem da base da previsão."
              placeholder="ex.: fundo de caixa p/ obras"
              value={c.deducaoRegex}
              onChange={(v) => set("deducaoRegex", v)}
            />
            <CampoRubrica
              rotulo="Palavras-chave de água"
              dica="Despesas somadas como consumo de água no relatório final."
              value={c.aguaRubrica}
              onChange={(v) => set("aguaRubrica", v)}
            />
            <CampoRubrica
              rotulo="Palavras-chave de energia elétrica"
              dica="Mesmo mecanismo da água, para a seção Consumo de serviços do relatório final."
              placeholder="ex.: energia, luz"
              value={c.energiaRubrica}
              onChange={(v) => set("energiaRubrica", v)}
            />
            <CampoRubrica
              rotulo="Palavras-chave de elevadores"
              dica="Mesmo mecanismo da água, para a seção Consumo de serviços do relatório final."
              placeholder="ex.: elevador, ascensor"
              value={c.elevadorRubrica}
              onChange={(v) => set("elevadorRubrica", v)}
            />
            <Field rotulo="Fornecedor dos elevadores" dica="Texto livre, impresso junto da linha Elevadores no relatório final.">
              <Input value={c.elevadorFornecedor} onChange={(e) => set("elevadorFornecedor", e.target.value)} />
            </Field>
            <Field rotulo="Arredondamento do rateio">
              <Selecao value={c.arredondamento} onChange={(v) => set("arredondamento", v)} opcoes={ARREDONDAMENTO} />
            </Field>
          </div>
          <div className="mt-5">
            <AjudaExpressoes />
          </div>
        </SecaoRecolhivel>

        <SecaoRecolhivel
          id={idSecao("depara")}
          titulo="De-para de rótulos"
          descricao="Substitui rótulos do balancete pelos nomes usados no relatório."
          resumo={res.depara}
          aberta={abertas.depara}
          aoMudar={abrir("depara")}
        >
          <div className="mb-4">
            <AjudaDePara />
          </div>
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
        </SecaoRecolhivel>

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
