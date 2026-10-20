import { createFileRoute, Link, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Selecao } from "@/components/app/inputs";
import { api } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { novoBloco, normalizarModelo, prepararModelo, TIPOS_BLOCO, validarModelo, type Bloco } from "@/domain/modelo";
import type { Assembleia, Modelo } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/modelos/$id")({
  head: () => cabecalho("Modelo de edital", "Blocos de texto e pauta padrão do modelo de edital."),
  loader: async ({ params, context: { queryClient } }) => {
    const [m] = await Promise.all([
      queryClient.ensureQueryData(itemQuery<Modelo>("modelos", params.id)),
      queryClient.ensureQueryData(listaQuery<Assembleia>("assembleias")),
    ]);
    if (!m) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Modelo não encontrado.</p>
      <Button variant="link" asChild>
        <Link to="/modelos">Voltar para a lista</Link>
      </Button>
    </div>
  ),
  component: PaginaModelo,
});

function PaginaModelo() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(itemQuery<Modelo>("modelos", id));
  return <FormModelo key={id} inicial={normalizarModelo(data ?? { id })} />;
}

function FormModelo({ inicial }: { inicial: Modelo }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: assembleias } = useSuspenseQuery(listaQuery<Assembleia>("assembleias"));
  const [m, setM] = useState<Modelo>(inicial);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(inicial));
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const usos = assembleias.filter((a) => a.modeloId === m.id).length;
  const sujo = JSON.stringify(m) !== salvoJson;
  const mudar = (parcial: Partial<Modelo>) => setM((x) => ({ ...x, ...parcial }));

  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const liberado = useRef(false);
  useBlocker({
    shouldBlockFn: () =>
      !liberado.current && sujoRef.current && !window.confirm("Há alterações não salvas neste modelo. Sair mesmo assim?"),
    enableBeforeUnload: () => !liberado.current && sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: (dados: Modelo) => api.salvar("modelos", dados),
    onSuccess: (salvo) => {
      const n = normalizarModelo(salvo);
      queryClient.invalidateQueries({ queryKey: chaves.lista("modelos") });
      queryClient.setQueryData(chaves.item("modelos", salvo.id), salvo);
      setM(n);
      setSalvoJson(JSON.stringify(n));
      toast.success("Modelo salvo.");
    },
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir("modelos", m.id),
    onSuccess: () => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("modelos") });
      toast.success("Modelo excluído.");
      navigate({ to: "/modelos" });
    },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    const erro = validarModelo(m);
    setErroNome(erro);
    if (erro) {
      toast.error(erro);
      return;
    }
    salvar.mutate(prepararModelo(m));
  }

  const historico = Array.isArray(m.historico) ? m.historico.length : 0;

  return (
    <>
      <PageHeader
        voltar={
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/modelos">
              <ArrowLeft /> Modelos de edital
            </Link>
          </Button>
        }
        titulo={m.nome || "Modelo de edital"}
        descricao={usos ? `Usado em ${usos} ${usos === 1 ? "edital" : "editais"}.` : "Ainda não usado em editais."}
        acoes={
          <>
            {sujo && <Badge variant="warning">Alterações não salvas</Badge>}
            <Button variant="outline" type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:text-destructive">
              <Trash2 /> Excluir
            </Button>
            <Button type="submit" form="form-modelo" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />

      <form id="form-modelo" onSubmit={enviar} className="space-y-6" noValidate>
        <SectionCard titulo="Identificação">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field rotulo="Nome" obrigatorio erro={erroNome}>
              <Input
                value={m.nome}
                onChange={(e) => {
                  mudar({ nome: e.target.value });
                  setErroNome(null);
                }}
              />
            </Field>
            <Field rotulo="Versão">
              <Input value={String(m.versao)} onChange={(e) => mudar({ versao: e.target.value })} className="num" />
            </Field>
          </div>
          {historico > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Histórico: {historico} {historico === 1 ? "registro guardado" : "registros guardados"} (mantidos como estão ao salvar).
            </p>
          )}
        </SectionCard>

        <SectionCard titulo="Pauta padrão" descricao="Itens carregados na pauta de cada edital novo que usar este modelo. Podem ser editados no edital.">
          <RepeatableList<{ texto: string }>
            itens={m.pautaOrdinaria.map((texto) => ({ texto }))}
            onChange={(l) => mudar({ pautaOrdinaria: l.map((i) => i.texto) })}
            novo={() => ({ texto: "" })}
            colunas="grid-cols-[2rem_minmax(0,1fr)]"
            rotuloAdicionar="Adicionar item"
            vazio="Nenhum item na pauta padrão."
            render={(item, up, i) => (
              <>
                <span className="num flex h-9 items-center justify-end text-sm text-muted-foreground">{i + 1}.</span>
                <Input aria-label={`Item ${i + 1} da pauta padrão`} value={item.texto} onChange={(e) => up({ texto: e.target.value })} />
              </>
            )}
          />
        </SectionCard>

        <SectionCard
          titulo="Blocos do edital"
          descricao="O texto do edital, na ordem em que aparece. O bloco “Pauta” marca onde entram os itens da pauta. Blocos sem texto são descartados ao salvar (exceto “Pauta”)."
        >
          <div className="mb-4 rounded-md border border-dashed bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Dados do edital no texto:</span> escreva entre chaves duplas, por exemplo{" "}
              <code className="rounded bg-card px-1">{"{{condominio.nome}}"}</code>, <code className="rounded bg-card px-1">{"{{assembleia.data}}"}</code>,{" "}
              <code className="rounded bg-card px-1">{"{{assembleia.modalidade}}"}</code>. Datas saem em dd/mm/aaaa e tipo, modalidade e entrega das contas saem por extenso.
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Condição:</span> o bloco só aparece quando ela é verdadeira, por exemplo{" "}
              <code className="rounded bg-card px-1">assembleia.modalidade != online</code>. Combine com “e” / “ou”:{" "}
              <code className="rounded bg-card px-1">assembleia.modalidade == online e assembleia.tipo == extraordinaria</code>. Compare sempre com o código
              (ordinaria, extraordinaria, presencial, online, hibrida, email, administracao, aplicativo). Em branco, aparece sempre.
            </p>
          </div>
          <RepeatableList<Bloco>
            itens={m.blocos}
            onChange={(blocos) => mudar({ blocos })}
            novo={() => novoBloco()}
            colunas="grid-cols-1"
            rotuloAdicionar="Adicionar bloco"
            vazio="Nenhum bloco. Adicione o título, os parágrafos e o bloco da pauta."
            render={(b, up, i) => (
              <div className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <div className="grid content-start gap-2">
                  <span className="num text-xs font-medium text-muted-foreground">Bloco {i + 1}</span>
                  <Selecao value={b.tipo} onChange={(tipo) => up({ tipo })} opcoes={TIPOS_BLOCO} />
                  <Input
                    aria-label={`Condição do bloco ${i + 1}`}
                    placeholder="Condição (opcional)"
                    value={b.cond}
                    onChange={(e) => up({ cond: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <Textarea
                  aria-label={`Texto do bloco ${i + 1}`}
                  placeholder={b.tipo === "pauta" ? "Texto antes da pauta (opcional)" : "Texto do bloco"}
                  value={b.texto}
                  onChange={(e) => up({ texto: e.target.value })}
                  rows={b.tipo === "titulo" || b.tipo === "subtitulo" ? 1 : b.tipo === "pauta" || b.tipo === "item" ? 2 : 4}
                  className={b.tipo === "titulo" ? "min-h-9 font-semibold" : b.tipo === "subtitulo" ? "min-h-9 font-medium" : ""}
                />
              </div>
            )}
          />
        </SectionCard>
      </form>

      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir modelo?"
        descricao={
          usos
            ? `O modelo “${m.nome}” é usado em ${usos} ${usos === 1 ? "edital" : "editais"}. Os editais continuam salvos, mas ficam sem modelo. Esta ação não pode ser desfeita.`
            : `O modelo “${m.nome}” será excluído. Esta ação não pode ser desfeita.`
        }
        rotuloConfirmar="Excluir"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
