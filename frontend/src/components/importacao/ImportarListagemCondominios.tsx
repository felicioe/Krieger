import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Coluna } from "@/components/app/DataTable";
import { SectionCard } from "@/components/app/SectionCard";
import { api, mensagemErro } from "@/lib/api";
import { novoId } from "@/lib/id";
import { chaves, listaQuery } from "@/lib/queries";
import { consultarCnpjsEmLote, enderecoDaReceita } from "@/lib/receitaCnpj";
import { lerListagemCondominios, type CondominioDaListagem } from "@/domain/pdfParser";
import {
  analisarListagemCondominios,
  type CondominioAnalisado,
  type DadosReceitaResolvidos,
} from "@/domain/importacaoListagemCondominios";
import type { Condominio } from "@/domain/types";

/** Não é a Listagem Completa de Condomínios do Systemar. */
const ERRO_NAO_LISTAGEM = 'Este PDF não parece ser a "Listagem Completa de Condomínios"; verifique se é o relatório certo.';

type Progresso = { feito: number; total: number };

/**
 * Importador em lote da "Listagem Completa de Condomínios" do Systemar: lê o PDF, casa cada linha
 * com o cadastro existente (por código, depois CNPJ, depois nome — `encontrarCondominio`),
 * consulta a Receita Federal pra cada CNPJ (nome e endereço), e deixa conferir numa tabela antes de
 * gravar. Nunca trava por CNPJ ausente/duplicado — só sinaliza (alerta vermelho); quem decide se
 * cadastra mesmo assim é quem está importando.
 */
export function ImportarListagemCondominios({ condominios }: { condominios: Condominio[] }) {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  // Preserva o mesmo id por código se o salvamento precisar ser repetido após falha parcial de rede.
  const idsNovosRef = useRef<Record<string, string>>({});
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<CondominioDaListagem[] | null>(null);
  const [receita, setReceita] = useState<Map<string, DadosReceitaResolvidos>>(new Map());
  const [progressoReceita, setProgressoReceita] = useState<Progresso | null>(null);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [progressoSalvar, setProgressoSalvar] = useState<Progresso | null>(null);

  const analise = useMemo(
    () => (linhas ? analisarListagemCondominios(linhas, condominios, receita) : null),
    [linhas, condominios, receita],
  );

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLinhas(null);
    setReceita(new Map());
    setSelecionados({});
    setProgressoReceita(null);
    setLendo(true);
    try {
      const condominiosAtuais = await queryClient
        .fetchQuery({ ...listaQuery<Condominio>("condominios"), staleTime: 0 })
        .catch(() => condominios);
      const { extrairTextoPdf } = await import("@/lib/pdfTexto");
      const texto = await extrairTextoPdf(arquivo);
      const lidas = lerListagemCondominios(texto);
      if (!lidas) throw new Error(ERRO_NAO_LISTAGEM);
      setLinhas(lidas);

      const previa = analisarListagemCondominios(lidas, condominiosAtuais, new Map());
      const iniciais: Record<string, boolean> = {};
      for (const r of previa) iniciais[r.linha.codigo] = !r.excluidoPorPadrao;
      setSelecionados(iniciais);

      const cnpjs = lidas.map((l) => l.cnpj).filter((c): c is string => !!c);
      if (cnpjs.length > 0) {
        setProgressoReceita({ feito: 0, total: 0 });
        const brutos = await consultarCnpjsEmLote(cnpjs, (feito, total) => setProgressoReceita({ feito, total }));
        const resolvidos = new Map<string, DadosReceitaResolvidos>();
        for (const [cnpj, d] of brutos) resolvidos.set(cnpj, { razaoSocial: d?.razaoSocial ?? null, endereco: d ? enderecoDaReceita(d) : null });
        setReceita(resolvidos);
      }
    } catch (e) {
      setErro(e instanceof Error && /password|Invalid PDF/i.test(e.message) ? "Não foi possível abrir o PDF (arquivo protegido ou inválido)." : mensagemErro(e));
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!analise) return;
      const escolhidos = analise.filter((r) => selecionados[r.linha.codigo]);
      setProgressoSalvar({ feito: 0, total: escolhidos.length });
      for (let i = 0; i < escolhidos.length; i++) {
        const r = escolhidos[i]!;
        const idNovo = (idsNovosRef.current[r.linha.codigo] ??= novoId());
        const dados = { ...(r.existente ?? {}), ...r.proposto, id: r.existente?.id ?? idNovo } as Condominio;
        await api.salvar<Condominio>("condominios", dados);
        setProgressoSalvar({ feito: i + 1, total: escolhidos.length });
      }
    },
    onSuccess: async () => {
      toast.success("Listagem de condomínios importada.");
      setLinhas(null);
      setSelecionados({});
      setProgressoSalvar(null);
    },
    onError: (e) => toast.error(mensagemErro(e)),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: chaves.store("condominios") });
    },
  });

  const receitaEmAndamento = !!progressoReceita && progressoReceita.total > 0 && progressoReceita.feito < progressoReceita.total;
  const totalSelecionados = analise ? analise.filter((r) => selecionados[r.linha.codigo]).length : 0;
  const linhasTabela = useMemo(
    () => (analise ? [...analise].sort((a, b) => a.linha.nome.localeCompare(b.linha.nome, "pt-BR")) : []),
    [analise],
  );

  const colunas: Coluna<CondominioAnalisado>[] = [
    {
      chave: "incluir",
      titulo: "Incluir",
      render: (r) => (
        <Checkbox
          checked={!!selecionados[r.linha.codigo]}
          onCheckedChange={(v) => setSelecionados((s) => ({ ...s, [r.linha.codigo]: v === true }))}
          aria-label={`Incluir ${r.linha.nome} na importação`}
        />
      ),
    },
    { chave: "codigo", titulo: "Código", className: "num whitespace-nowrap", render: (r) => r.linha.codigo },
    {
      chave: "nome",
      titulo: "Condomínio",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground">{String(r.proposto.nome ?? r.linha.nome)}</div>
          {r.existente && r.proposto.nome !== r.existente.nome && (
            <div className="text-xs text-muted-foreground line-through">{r.existente.nome}</div>
          )}
        </div>
      ),
    },
    { chave: "cnpj", titulo: "CNPJ", className: "whitespace-nowrap", render: (r) => r.linha.cnpj || "—" },
    {
      chave: "status",
      titulo: "Status",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={r.existente ? "secondary" : "default"}>
            {!r.existente ? "Novo" : r.camposAlterados.length ? `Atualiza ${r.camposAlterados.length} campo(s)` : "Sem mudança"}
          </Badge>
          {r.alertas.length > 0 && (
            <Badge variant="destructive" title={r.alertas.join(" ")}>
              Alerta
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Arquivo PDF da Listagem de Condomínios"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" onClick={() => entrada.current?.click()} disabled={lendo}>
        {lendo ? <Loader2 className="animate-spin" /> : <FileUp />}
        Escolher PDF da Listagem de Condomínios
      </Button>

      {erro && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {progressoReceita && (
        <SectionCard titulo="Consultando a Receita Federal">
          <p className="text-sm text-muted-foreground">
            {progressoReceita.feito} de {progressoReceita.total || "…"} CNPJs consultados{receitaEmAndamento ? "…" : "."}
          </p>
          <Progress value={progressoReceita.total ? (progressoReceita.feito / progressoReceita.total) * 100 : 0} className="mt-2" />
        </SectionCard>
      )}

      {analise && (
        <SectionCard
          titulo={`Prévia (${analise.length} condomínios no PDF, ${totalSelecionados} selecionados)`}
          descricao="Confira nome, CNPJ e os campos que vão mudar antes de confirmar. Linhas com alerta (vermelho) têm CNPJ ausente ou repetido nesta mesma listagem — não impede a importação, só precisa de conferência manual depois."
        >
          <DataTable colunas={colunas} dados={linhasTabela} chaveLinha={(r) => r.linha.codigo} />
          <Button
            type="button"
            className="mt-4"
            onClick={() => salvar.mutate()}
            disabled={receitaEmAndamento || salvar.isPending || totalSelecionados === 0}
          >
            {salvar.isPending && <Loader2 className="animate-spin" />}
            {receitaEmAndamento ? "Aguarde a consulta à Receita Federal…" : `Confirmar importação (${totalSelecionados})`}
          </Button>
          {progressoSalvar && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Salvando {progressoSalvar.feito} de {progressoSalvar.total}…
              </p>
              <Progress value={(progressoSalvar.feito / progressoSalvar.total) * 100} className="mt-1" />
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
