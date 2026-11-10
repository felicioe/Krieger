import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/PageHeader";
import { Field } from "@/components/app/Field";
import { api } from "@/lib/api";
import { chaves } from "@/lib/queries";
import { normalizarModeloAta, validarModeloAta } from "@/domain/modeloAta";
import type { ModeloAta } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/modelos-ata/$id")({
  loader: ({ context: { queryClient }, params: { id } }) =>
    queryClient.ensureQueryData(itemQuery(id)),
  component: RouteComponent,
});

function itemQuery(id: string) {
  return {
    queryKey: chaves.item("modelos_ata", id),
    queryFn: () => api.obter<ModeloAta>("modelos_ata", id).then(normalizarModeloAta),
  };
}

function RouteComponent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: modelo, isLoading } = useQuery(itemQuery(id));

  const [form, setForm] = useState<Omit<ModeloAta, "id">>({
    nome: "",
    cidade: "",
    cartorio: "",
    texto: "",
    logoEscritorio: true,
    bordaPagina: false,
    ativo: true,
    criadoEm: "",
    atualizadoEm: "",
  });

  useEffect(() => {
    if (modelo) {
      setForm({
        nome: modelo.nome ?? "",
        cidade: modelo.cidade ?? "",
        cartorio: modelo.cartorio ?? "",
        texto: modelo.texto ?? "",
        logoEscritorio: modelo.logoEscritorio ?? true,
        bordaPagina: modelo.bordaPagina ?? false,
        ativo: modelo.ativo ?? true,
        criadoEm: modelo.criadoEm ?? "",
        atualizadoEm: modelo.atualizadoEm ?? "",
      });
    }
  }, [modelo]);

  const salvar = useMutation({
    mutationFn: async () => {
      const erros = validarModeloAta(form);
      const msgs = [erros.nome, erros.texto].filter(Boolean);
      if (msgs.length) throw new Error(msgs.join("; "));
      const payload: ModeloAta = { ...form, id } as ModeloAta;
      return api.salvar("modelos_ata", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.store("modelos_ata") });
      queryClient.invalidateQueries({ queryKey: chaves.item("modelos_ata", id) });
      toast.success("Modelo de ata salvo.");
      navigate({ to: "/modelos-ata" });
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar."),
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir("modelos_ata", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.store("modelos_ata") });
      toast.success("Modelo excluído.");
      navigate({ to: "/modelos-ata" });
    },
  });

  if (isLoading) return <div>Carregando...</div>;
  if (!modelo) return notFound();

  return (
    <>
      <PageHeader titulo="Editar modelo de ata" acoes={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/modelos-ata" })}>Voltar</Button>
          <Button variant="destructive" onClick={() => excluir.mutate()} disabled={excluir.isPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
        </div>
      } />
      <div className="space-y-4 max-w-3xl">
        <Field rotulo="Nome do modelo" obrigatorio>
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Ata padrão Florianópolis" />
        </Field>
        <Field rotulo="Cidade (opcional)" dica="Deixe em branco para um modelo geral.">
          <Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex.: Florianópolis" />
        </Field>
        <Field rotulo="Cartório (opcional)" dica="Deixe em branco para valer em qualquer cartório da cidade.">
          <Input value={form.cartorio ?? ""} onChange={(e) => setForm({ ...form, cartorio: e.target.value })} placeholder="Ex.: 1º Ofício" />
        </Field>
        <Field rotulo="Texto da ata" dica="Use variáveis como {{ata.tipo}}, {{ata.data}}, {{condominio.nomeRelatorio}}." obrigatorio>
          <textarea
            className="min-h-[320px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={form.texto ?? ""}
            onChange={(e) => setForm({ ...form, texto: e.target.value })}
          />
        </Field>
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
    </>
  );
}