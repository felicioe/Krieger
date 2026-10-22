import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { Selecao } from "@/components/app/inputs";
import { focarConteudoApos } from "@/components/app/foco";
import { textoCondominioLido, textoPeriodo } from "./anexos";
import { api, mensagemErro } from "@/lib/api";
import { novoId } from "@/lib/id";
import { lerComoDataUrl } from "@/lib/arquivo";
import { formatBytes } from "@/lib/format";
import { chaves, listaQuery } from "@/lib/queries";
import { lerRelatorio, type RelatorioLido } from "@/domain/pdfParser";
import { anoDoRelatorio, colunaPadrao, encontrarCondominio, novoAnexoImportado } from "@/domain/importacao";
import type { AnexoImportado, Condominio, Exercicio } from "@/domain/types";

/** Mensagem pedida para PDFs que não são o Comparativo Financeiro. */
export const ERRO_NAO_COMPARATIVO = "Este PDF não parece ser um Comparativo Financeiro; verifique se é o relatório certo.";

type Lido = { arquivo: string; tamanho: number; dataUrl: string; relatorio: RelatorioLido };

/**
 * Card "Comparativo Financeiro" do Importador: lê o PDF, confere que é o layout comparativo e
 * o anexa (como referência, sem mexer no demonstrativo) a uma prestação de contas que já existe.
 */
export function AnexarComparativo({ condominios, rotulo = "Anexar comparativo financeiro" }: { condominios: Condominio[]; rotulo?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const vaiNavegar = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<Lido | null>(null);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setAberto(true);
    setLendo(true);
    setErro(null);
    setLido(null);
    try {
      const { extrairTextoPdf } = await import("@/lib/pdfTexto");
      const texto = await extrairTextoPdf(arquivo);
      if (!texto.trim()) throw new Error("O PDF não tem texto legível (pode ser uma imagem digitalizada).");
      const relatorio = lerRelatorio(texto, arquivo.name);
      if (relatorio.layout !== "comparativo") throw new Error(ERRO_NAO_COMPARATIVO);
      const dataUrl = await lerComoDataUrl(arquivo);
      setLido({ arquivo: arquivo.name, tamanho: arquivo.size, dataUrl, relatorio });
    } catch (e) {
      setErro(e instanceof Error && /password|Invalid PDF/i.test(e.message) ? "Não foi possível abrir o PDF (arquivo protegido ou inválido)." : mensagemErro(e));
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <>
      <Button ref={botao} type="button" variant="outline" onClick={() => entrada.current?.click()}>
        <FileUp /> {rotulo}
      </Button>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Arquivo PDF do Comparativo Financeiro"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
          // Abre depois da escolha do arquivo: ao fechar sem navegar, o foco volta ao botão do card.
          onCloseAutoFocus={(ev) => {
            ev.preventDefault();
            if (vaiNavegar.current) {
              vaiNavegar.current = false;
              return;
            }
            botao.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Anexar Comparativo Financeiro</DialogTitle>
            <DialogDescription>
              O PDF fica guardado na prestação de contas como referência, para consulta e download. O demonstrativo não muda.
            </DialogDescription>
          </DialogHeader>
          {lendo ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Lendo o PDF…
            </p>
          ) : erro ? (
            <>
              <Alert variant="destructive" role="alert">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : lido ? (
            <PassoAnexar
              lido={lido}
              condominios={condominios}
              fechar={() => setAberto(false)}
              antesDeNavegar={() => {
                vaiNavegar.current = true;
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PassoAnexar({
  lido,
  condominios,
  fechar,
  antesDeNavegar,
}: {
  lido: Lido;
  condominios: Condominio[];
  fechar: () => void;
  antesDeNavegar: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: exercicios = [], isPending: carregando } = useQuery(listaQuery<Exercicio>("exercicios"));
  const rel = lido.relatorio;
  const encontrado = encontrarCondominio(condominios, rel.condominio);
  const [condoId, setCondoId] = useState<string>(encontrado?.id ?? "");
  const anoSugerido = anoDoRelatorio(rel, colunaPadrao(rel, "exercicios"));

  const doCondo = useMemo(
    () => exercicios.filter((x) => x.condoId === condoId).sort((a, b) => (Number(b.ano) || 0) - (Number(a.ano) || 0)),
    [exercicios, condoId],
  );
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const sugerido = doCondo.find((x) => Number(x.ano) === anoSugerido)?.id ?? doCondo[0]?.id ?? "";
  const exercicioId = escolhido && doCondo.some((x) => x.id === escolhido) ? escolhido : sugerido;
  const exercicio = doCondo.find((x) => x.id === exercicioId);
  const condo = condominios.find((c) => c.id === condoId);

  const outro =
    !!condo &&
    !!(rel.condominio.codigo || rel.condominio.cnpj) &&
    !!(condo.codigo || condo.cnpj) &&
    !encontrarCondominio([condo], rel.condominio);

  const opcoesCondo = [...condominios]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ valor: c.id, rotulo: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome }));
  const opcoesExercicio = doCondo.map((x) => ({ valor: x.id, rotulo: `Exercício ${x.ano}` }));

  const anexar = useMutation({
    mutationFn: () => {
      if (!exercicio) throw new Error("Escolha a prestação de contas.");
      return api.salvar<AnexoImportado>("anexos_importacao", {
        ...novoAnexoImportado(exercicio.id, "comparativo_financeiro", rel, lido.arquivo, lido.dataUrl),
        id: novoId(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.store("anexos_importacao") });
      toast.success(`Comparativo anexado à prestação de contas ${exercicio?.ano ?? ""}.`);
      antesDeNavegar();
      fechar();
      if (exercicio) focarConteudoApos(navigate({ to: "/prestacao-contas/$id", params: { id: exercicio.id } }));
    },
  });

  return (
    <>
      <dl className="grid gap-x-4 gap-y-1.5 rounded-md border p-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Arquivo</dt>
        <dd className="min-w-0 break-words font-medium">
          {lido.arquivo} <span className="font-normal text-muted-foreground">({formatBytes(lido.tamanho)})</span>
        </dd>
        <dt className="text-muted-foreground">Condomínio no PDF</dt>
        <dd className="min-w-0 break-words">{textoCondominioLido(rel)}</dd>
        <dt className="text-muted-foreground">Período</dt>
        <dd className="num">{textoPeriodo(rel)}</dd>
        {rel.meses && rel.meses.length > 0 && (
          <>
            <dt className="text-muted-foreground">Meses</dt>
            <dd className="num min-w-0 break-words">{rel.meses.join(", ")}</dd>
          </>
        )}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field rotulo="Condomínio" obrigatorio>
          <Selecao
            value={condoId}
            onChange={(v) => {
              setCondoId(v);
              setEscolhido(null);
            }}
            opcoes={opcoesCondo}
            placeholder="Escolha o condomínio"
          />
        </Field>
        <Field
          rotulo="Prestação de contas"
          obrigatorio
          {...(!escolhido && exercicio && Number(exercicio.ano) === anoSugerido ? { dica: "Sugerida pelo ano do PDF." } : {})}
        >
          <Selecao
            value={exercicioId}
            onChange={setEscolhido}
            opcoes={opcoesExercicio}
            placeholder={condoId ? "Escolha o exercício" : "Escolha antes o condomínio"}
            disabled={!condoId || doCondo.length === 0}
          />
        </Field>
      </div>

      {!encontrado && !condoId && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>Não achei no cadastro o condomínio deste PDF. Escolha o condomínio e a prestação de contas.</AlertDescription>
        </Alert>
      )}
      {outro && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>Este PDF parece ser de outro condomínio (código/CNPJ diferentes de {condo?.nome}).</AlertDescription>
        </Alert>
      )}
      {condoId && !carregando && doCondo.length === 0 && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            {condo?.nome ?? "Este condomínio"} ainda não tem prestação de contas. Crie a prestação em{" "}
            <Link to="/prestacao-contas" className="font-medium underline">
              Prestação de contas
            </Link>{" "}
            e depois anexe o comparativo.
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={fechar} disabled={anexar.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => anexar.mutate()} disabled={!exercicio || anexar.isPending}>
          {anexar.isPending && <Loader2 className="animate-spin" />}
          Anexar à prestação de contas
        </Button>
      </DialogFooter>
    </>
  );
}
