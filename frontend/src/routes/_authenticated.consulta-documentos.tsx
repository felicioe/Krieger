import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { api, mensagemErro } from "@/lib/api";
import { consultaHistoricoQuery, listaQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import type { Condominio, ConsultaOrigem, ConsultaResposta, TipoDocumentoConsulta } from "@/domain/types";

type Busca = { condoId?: string };

export const Route = createFileRoute("/_authenticated/consulta-documentos")({
  head: () => cabecalho("Consulta de Documentos", "Perguntas sobre convenção, regimento interno e atas de assembleia."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const condoId = s["condoId"];
    return typeof condoId === "string" && condoId ? { condoId } : {};
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listaQuery<Condominio>("condominios")),
  component: PaginaConsultaDocumentos,
});

const ORIGEM_ROTULO: Record<ConsultaOrigem, string> = {
  cache: "Resposta em cache",
  local: "Busca local",
  claude: "Interpretado por IA",
};
const ORIGEM_VARIANTE: Record<ConsultaOrigem, "secondary" | "outline" | "success"> = {
  cache: "secondary",
  local: "outline",
  claude: "success",
};
const TIPO_ROTULO: Record<TipoDocumentoConsulta, string> = {
  convencao: "Convenção",
  regimento: "Regimento",
  ata: "Ata",
};

function PaginaConsultaDocumentos() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/consulta-documentos" });
  const { data: condominios } = useSuspenseQuery(listaQuery<Condominio>("condominios"));
  const ordenados = [...condominios].sort((a, b) => (a.nomeRelatorio || a.nome).localeCompare(b.nomeRelatorio || b.nome, "pt-BR"));
  const condoId = busca.condoId && ordenados.some((c) => c.id === busca.condoId) ? busca.condoId : (ordenados[0]?.id ?? "");
  const condo = ordenados.find((c) => c.id === condoId);

  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<ConsultaResposta | null>(null);

  const historico = useQuery(consultaHistoricoQuery(condoId));

  const perguntar = useMutation({
    mutationFn: (p: string) => api.documentos.perguntar(condoId, p),
    onSuccess: (r) => {
      setResposta(r);
      historico.refetch();
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  if (ordenados.length === 0) {
    return (
      <>
        <PageHeader titulo="Consulta de Documentos" descricao="Perguntas sobre convenção, regimento interno e atas de assembleia." />
        <SectionCard titulo="Nenhum condomínio cadastrado">
          <p className="text-sm text-muted-foreground">Cadastre um condomínio para usar a consulta.</p>
        </SectionCard>
      </>
    );
  }

  const opcoesCondo = ordenados.map((c) => ({ valor: c.id, rotulo: c.nomeRelatorio || c.nome }));
  const semPasta = !condo?.pastaDocumentos?.trim();

  function enviar(e: FormEvent) {
    e.preventDefault();
    const p = pergunta.trim();
    if (!p || perguntar.isPending) return;
    perguntar.mutate(p);
  }

  return (
    <>
      <PageHeader titulo="Consulta de Documentos" descricao="Perguntas sobre convenção, regimento interno e atas de assembleia do condomínio." />

      <SectionCard titulo="Condomínio">
        <Field rotulo="Condomínio" className="max-w-md">
          <Selecao value={condoId} onChange={(id) => navigate({ search: { condoId: id }, replace: true })} opcoes={opcoesCondo} />
        </Field>
        {semPasta && (
          <Alert variant="warning" className="mt-4">
            <AlertDescription>
              Este condomínio ainda não tem uma pasta de documentos cadastrada — a busca não encontra nada até que o
              agente de indexação rode sobre ela. Configure em Condomínios → {condo?.nomeRelatorio || condo?.nome} → Pasta de
              documentos.
            </AlertDescription>
          </Alert>
        )}
      </SectionCard>

      <SectionCard titulo="Pergunta" descricao="Responde só com base no que estiver indexado para este condomínio — nunca mistura com os de outros.">
        <form onSubmit={enviar} className="space-y-3">
          <Textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            rows={3}
            placeholder="Ex.: qual é o prazo de convocação da assembleia?"
          />
          <Button type="submit" disabled={perguntar.isPending || !pergunta.trim()}>
            {perguntar.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Perguntar
          </Button>
        </form>
      </SectionCard>

      {resposta && (
        <SectionCard titulo="Resposta">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={ORIGEM_VARIANTE[resposta.origem]}>{ORIGEM_ROTULO[resposta.origem]}</Badge>
            {resposta.semEvidencia && <Badge variant="warning">Sem evidência suficiente</Badge>}
          </div>
          <p className="whitespace-pre-wrap text-sm">{resposta.texto}</p>
          {resposta.fontes.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fontes</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {resposta.fontes.map((f, i) => (
                  <li key={`${f.documentoId}-${i}`}>
                    {f.arquivo} ({TIPO_ROTULO[f.tipo]}) — página {f.paginaInicial === f.paginaFinal ? f.paginaInicial : `${f.paginaInicial}–${f.paginaFinal}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard titulo="Histórico" descricao="Últimas perguntas feitas para este condomínio.">
        {historico.data && historico.data.length > 0 ? (
          <ul className="divide-y text-sm">
            {historico.data.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">{h.pergunta}</span>
                <Badge variant={ORIGEM_VARIANTE[h.origem]}>{ORIGEM_ROTULO[h.origem]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma pergunta feita ainda para este condomínio.</p>
        )}
      </SectionCard>
    </>
  );
}
