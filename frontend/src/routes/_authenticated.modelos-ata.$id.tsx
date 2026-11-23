import { createFileRoute, Link, notFound, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Carregando } from "@/components/app/Carregando";
import { api, mensagemErro } from "@/lib/api";
import { temPermissao, useUsuario } from "@/lib/auth";
import { chaves } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { OPCOES_TIPO } from "@/domain/ata";
import { normalizarModeloAta, validarModeloAta } from "@/domain/modeloAta";
import type { ModeloAta } from "@/domain/types";
import { PainelVariaveis } from "@/components/modelos-ata/PainelVariaveis";

export const Route = createFileRoute("/_authenticated/modelos-ata/$id")({
  head: () => cabecalho("Editar modelo de ata", "Edite o texto e as opções do modelo de ata."),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const modelo = await queryClient.ensureQueryData(itemQuery(id));
    if (!modelo) throw notFound();
    return modelo;
  },
  notFoundComponent: () => (
    <div className="space-y-4">
      <PageHeader
        titulo="Modelo de ata não encontrado"
        descricao="O modelo solicitado não existe ou foi removido."
        acoes={
          <Button variant="outline" asChild>
            <Link to="/modelos-ata">Voltar aos modelos de ata</Link>
          </Button>
        }
      />
    </div>
  ),
  component: RouteComponent,
});

function itemQuery(id: string) {
  return {
    queryKey: chaves.item("modelos_ata", id),
    queryFn: async () => {
      const bruto = await api.obter<ModeloAta>("modelos_ata", id);
      return bruto ? normalizarModeloAta(bruto) : null;
    },
  };
}

function paraFormulario(modelo: ModeloAta): Omit<ModeloAta, "id"> {
  return {
    nome: modelo.nome ?? "",
    cidade: modelo.cidade ?? "",
    cartorio: modelo.cartorio ?? "",
    tipo: modelo.tipo ?? "",
    texto: modelo.texto ?? "",
    logoEscritorio: modelo.logoEscritorio ?? true,
    bordaPagina: modelo.bordaPagina ?? false,
    ativo: modelo.ativo ?? true,
    criadoEm: modelo.criadoEm ?? "",
    atualizadoEm: modelo.atualizadoEm ?? "",
  };
}

function RouteComponent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useUsuario();
  const podeEditar = temPermissao(usuario, "modelos_ata.editar");
  const query = useQuery(itemQuery(id));
  const { data: modelo, isLoading, isError, error } = query;

  const [form, setForm] = useState<Omit<ModeloAta, "id">>(() =>
    modelo
      ? paraFormulario(modelo)
      : {
          nome: "",
          cidade: "",
          cartorio: "",
          tipo: "",
          texto: "",
          logoEscritorio: true,
          bordaPagina: false,
          ativo: true,
          criadoEm: "",
          atualizadoEm: "",
        },
  );
  const [salvoJson, setSalvoJson] = useState<string>(() =>
    modelo ? JSON.stringify(paraFormulario(modelo)) : "",
  );
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    if (modelo) {
      const proximo = paraFormulario(modelo);
      setForm(proximo);
      setSalvoJson(JSON.stringify(proximo));
    }
  }, [modelo]);

  const sujo = Boolean(salvoJson) && JSON.stringify(form) !== salvoJson;
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const liberado = useRef(false);

  useBlocker({
    shouldBlockFn: () =>
      !liberado.current &&
      sujoRef.current &&
      !window.confirm("Há alterações não salvas neste modelo de ata. Sair mesmo assim?"),
    enableBeforeUnload: () => !liberado.current && sujoRef.current,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!podeEditar) throw new Error("Você não tem permissão para editar modelos de ata.");
      const erros = validarModeloAta(form);
      const msgs = [erros.nome, erros.texto].filter(Boolean);
      if (msgs.length) throw new Error(msgs.join("; "));
      const payload: ModeloAta = { ...form, id } as ModeloAta;
      return api.salvar("modelos_ata", payload);
    },
    onSuccess: () => {
      liberado.current = true;
      setSalvoJson(JSON.stringify(form));
      queryClient.invalidateQueries({ queryKey: chaves.store("modelos_ata") });
      queryClient.invalidateQueries({ queryKey: chaves.item("modelos_ata", id) });
      toast.success("Modelo de ata salvo.");
      navigate({ to: "/modelos-ata" });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      if (!podeEditar) throw new Error("Você não tem permissão para excluir modelos de ata.");
      return api.excluir("modelos_ata", id);
    },
    onSuccess: () => {
      liberado.current = true;
      queryClient.invalidateQueries({ queryKey: chaves.store("modelos_ata") });
      toast.success("Modelo excluído.");
      navigate({ to: "/modelos-ata" });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  if (isLoading) return <Carregando texto="Carregando modelo de ata…" />;
  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader
          titulo="Editar modelo de ata"
          acoes={
            <Button variant="outline" onClick={() => navigate({ to: "/modelos-ata" })}>
              Voltar
            </Button>
          }
        />
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Não foi possível carregar o modelo de ata</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{mensagemErro(error)}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-1.5 size-4" /> Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!modelo) {
    return (
      <PageHeader
        titulo="Modelo de ata não encontrado"
        descricao="O modelo solicitado não existe ou foi removido."
        acoes={
          <Button variant="outline" asChild>
            <Link to="/modelos-ata">Voltar aos modelos de ata</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        titulo="Editar modelo de ata"
        acoes={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/modelos-ata" })}>
              Voltar
            </Button>
            <Button
              permissao="modelos_ata.editar"
              variant="destructive"
              onClick={() => setConfirmarExclusao(true)}
              disabled={excluir.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
            <Button
              permissao="modelos_ata.editar"
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending}
            >
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </div>
        }
      />
      <div className="space-y-4 max-w-3xl">
        <Field rotulo="Nome do modelo" obrigatorio>
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Ata padrão Florianópolis"
          />
        </Field>
        <Field rotulo="Cidade (opcional)" dica="Deixe em branco para um modelo geral.">
          <Input
            value={form.cidade ?? ""}
            onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            placeholder="Ex.: Florianópolis"
          />
        </Field>
        <Field
          rotulo="Cartório (opcional)"
          dica="Deixe em branco para valer em qualquer cartório da cidade."
        >
          <Input
            value={form.cartorio ?? ""}
            onChange={(e) => setForm({ ...form, cartorio: e.target.value })}
            placeholder="Ex.: 1º Ofício"
          />
        </Field>
        <Field
          rotulo="Tipo de assembleia"
          dica="Separe o modelo de ordinária do de extraordinária. Vazio = serve aos dois."
        >
          <Selecao
            value={form.tipo ?? ""}
            onChange={(v) => setForm({ ...form, tipo: v })}
            opcoes={[
              { valor: "", rotulo: "Ordinária e extraordinária" },
              ...OPCOES_TIPO.map((o) => ({ valor: o.valor as string, rotulo: o.rotulo })),
            ]}
          />
        </Field>
        <div className="space-y-1.5">
          <div className="flex justify-end">
            <PainelVariaveis />
          </div>
          <Field
            rotulo="Texto da ata"
            dica="Use variáveis como {{ata.tipo}}, {{ata.data}}, {{condominio.nomeRelatorio}}. Pressione Ctrl+/ para ver todas."
            obrigatorio
          >
            <textarea
              className="min-h-[320px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.texto ?? ""}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.logoEscritorio}
              onChange={(e) => setForm({ ...form, logoEscritorio: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Incluir logo do escritório
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.bordaPagina}
              onChange={(e) => setForm({ ...form, bordaPagina: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Borda de página
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Modelo ativo
          </label>
        </div>
      </div>

      <ConfirmDialog
        aberto={confirmarExclusao}
        aoMudar={setConfirmarExclusao}
        titulo="Excluir modelo de ata?"
        descricao={`O modelo “${form.nome || modelo.nome}” será removido definitivamente. Atas já geradas não serão alteradas.`}
        rotuloConfirmar="Excluir modelo"
        destrutivo
        aoConfirmar={() => excluir.mutateAsync()}
      />
    </>
  );
}
