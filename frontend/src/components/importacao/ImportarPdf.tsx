import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app/Field";
import { InteiroInput } from "@/components/app/inputs";
import { ResumoImportacao } from "./ResumoImportacao";
import { api, mensagemErro } from "@/lib/api";
import { chaves, itemQuery, listaQuery } from "@/lib/queries";
import {
  lerConsideracoesFinais,
  lerPrevisaoSugerida,
  lerRelatorio,
  type ConsideracoesFinaisLidas,
  type PrevisaoSugeridaLida,
  type RelatorioLido,
} from "@/domain/pdfParser";
import { normalizarCondominio } from "@/domain/condominio";
import {
  anoDoRelatorio,
  aplicarConsideracoesAoExercicio,
  colunaPadrao,
  demonstrativoDoRelatorio,
  encontrarCondominio,
  exercicioImportado,
  mensalImportado,
  novaImportacao,
  receberDoRelatorio,
} from "@/domain/importacao";
import { normalizarMensal, validarMensal } from "@/domain/mensal";
import { validarNovoExercicio } from "@/domain/exercicio";
import type { Condominio, ConfigEscritorio, Demonstrativo, DestinoImportacao, Exercicio, Importacao, Mensal } from "@/domain/types";

export type ImportacaoAplicada = {
  demonstrativo: Demonstrativo;
  receber: Mensal["receber"] | null;
  arquivo: string;
  /** Páginas extras do PDF (null quando não existem). */
  consideracoes: ConsideracoesFinaisLidas | null;
  previsaoSugerida: PrevisaoSugeridaLida | null;
};

type Props =
  | {
      /** Preenche o editor aberto (nada é gravado até o usuário salvar). */
      modo: "editor";
      destino: DestinoImportacao;
      condominio: Condominio | undefined;
      nomeCondominio: string;
      aoAplicar: (r: ImportacaoAplicada) => void;
    }
  | {
      /** Cria um relatório novo (ou envia para a conferência do cadastro, se o condomínio não existir). */
      modo: "novo";
      destino: DestinoImportacao;
      condominios: Condominio[];
    };

type Lido = {
  arquivo: string;
  relatorio: RelatorioLido;
  consideracoes: ConsideracoesFinaisLidas | null;
  previsaoSugerida: PrevisaoSugeridaLida | null;
};

/** Botão "Importar PDF": lê o relatório do Systemar no navegador e mostra o resumo para revisão. */
export function ImportarPdf(props: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<Lido | null>(null);
  const [coluna, setColuna] = useState<string | null>(null);

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
      const temSecoes = relatorio.saldoAnterior || relatorio.receitas || relatorio.despesas || relatorio.saldoAtual;
      if (!temSecoes) throw new Error("Não encontrei saldo anterior, receitas, despesas nem saldo atual neste PDF. Confira se é um relatório do Systemar.");
      setLido({
        arquivo: arquivo.name,
        relatorio,
        consideracoes: lerConsideracoesFinais(texto),
        previsaoSugerida: lerPrevisaoSugerida(texto),
      });
      setColuna(colunaPadrao(relatorio, props.destino));
    } catch (e) {
      setErro(e instanceof Error && /password|Invalid PDF/i.test(e.message) ? "Não foi possível abrir o PDF (arquivo protegido ou inválido)." : mensagemErro(e));
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => entrada.current?.click()}>
        <FileUp /> Importar PDF
      </Button>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Arquivo PDF do relatório"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar PDF do Systemar</DialogTitle>
            <DialogDescription>Confira o que foi lido antes de usar. Você ainda poderá corrigir tudo no editor.</DialogDescription>
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
            props.modo === "editor" ? (
              <PassoEditor {...props} lido={lido} coluna={coluna} setColuna={setColuna} fechar={() => setAberto(false)} />
            ) : (
              <PassoNovo {...props} lido={lido} coluna={coluna} setColuna={setColuna} fechar={() => setAberto(false)} />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Passo = { lido: Lido; coluna: string | null; setColuna: (c: string) => void; fechar: () => void };

function PassoEditor({
  destino,
  condominio,
  nomeCondominio,
  aoAplicar,
  lido,
  coluna,
  setColuna,
  fechar,
}: Extract<Props, { modo: "editor" }> & Passo) {
  const demonstrativo = useMemo(
    () => demonstrativoDoRelatorio(lido.relatorio, coluna, nomeCondominio),
    [lido, coluna, nomeCondominio],
  );
  const rc = lido.relatorio.condominio;
  const outro =
    !!condominio &&
    !!(rc.codigo || rc.cnpj) &&
    !!(condominio.codigo || condominio.cnpj) &&
    !encontrarCondominio([condominio], rc);

  return (
    <>
      <ResumoImportacao
        arquivo={lido.arquivo}
        relatorio={lido.relatorio}
        demonstrativo={demonstrativo}
        coluna={coluna}
        aoMudarColuna={setColuna}
        destino={destino}
        consideracoes={lido.consideracoes}
        previsaoSugerida={lido.previsaoSugerida}
      />
      {outro && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            Este PDF parece ser de outro condomínio (código/CNPJ diferentes de {condominio?.nome}).
          </AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        O demonstrativo atual será substituído
        {destino === "mensais"
          ? " (e as contas a receber, se o PDF trouxer)"
          : lido.consideracoes || lido.previsaoSugerida
            ? " e as Considerações finais serão preenchidas com o que foi lido"
            : ""}
        . Nada é gravado até você clicar em Salvar.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={fechar}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            aoAplicar({
              demonstrativo,
              receber: destino === "mensais" ? receberDoRelatorio(lido.relatorio, coluna) : null,
              arquivo: lido.arquivo,
              consideracoes: lido.consideracoes,
              previsaoSugerida: lido.previsaoSugerida,
            });
            fechar();
            toast.success("Demonstrativo preenchido a partir do PDF. Revise e salve.");
          }}
        >
          Preencher demonstrativo
        </Button>
      </DialogFooter>
    </>
  );
}

function PassoNovo({ destino, condominios, lido, coluna, setColuna, fechar }: Extract<Props, { modo: "novo" }> & Passo) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: mensais = [] } = useQuery({ ...listaQuery<Mensal>("mensais"), enabled: destino === "mensais" });
  const { data: exercicios = [] } = useQuery({ ...listaQuery<Exercicio>("exercicios"), enabled: destino === "exercicios" });
  const { data: escritorio } = useQuery(itemQuery<ConfigEscritorio>("config", "escritorio"));
  const [ano, setAno] = useState<number | null>(() => anoDoRelatorio(lido.relatorio, coluna));
  const existente = encontrarCondominio(condominios, lido.relatorio.condominio);
  const condo = existente ? normalizarCondominio(existente) : null;
  const demonstrativo = useMemo(() => demonstrativoDoRelatorio(lido.relatorio, coluna, condo?.nome ?? ""), [lido, coluna, condo?.nome]);
  const rotulo = destino === "mensais" ? "relatório mensal" : "prestação de contas";

  const criar = useMutation({
    mutationFn: async () => {
      if (!condo) throw new Error("Condomínio não encontrado.");
      if (destino === "mensais") {
        const { registro, competencia } = mensalImportado(condo, lido.relatorio, coluna, lido.arquivo);
        const v = validarMensal(condo.id, competencia, mensais.map((m) => normalizarMensal(m)));
        if (!v.ok) throw new Error(v.erro);
        return api.salvar<Omit<Mensal, "id"> & { id?: string }>("mensais", registro);
      }
      const v = validarNovoExercicio(condo.id, ano, exercicios);
      if (!v.ok || !ano) throw new Error(v.ok ? "Informe o ano do exercício." : v.erro);
      const base = exercicioImportado(condo, ano, escritorio?.cidade ?? "", lido.relatorio, coluna, lido.arquivo);
      const registro = { ...base, consid: aplicarConsideracoesAoExercicio(base.consid, lido.consideracoes, lido.previsaoSugerida) };
      return api.salvar<Omit<Exercicio, "id"> & { id?: string }>("exercicios", registro);
    },
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store(destino) });
      queryClient.setQueryData(chaves.item(destino, salvo.id), salvo);
      toast.success(`${destino === "mensais" ? "Relatório mensal criado" : "Prestação de contas criada"} a partir do PDF. Revise e salve as correções.`);
      fechar();
      if (destino === "mensais") navigate({ to: "/relatorio-mensal/$id", params: { id: salvo.id } });
      else navigate({ to: "/prestacao-contas/$id", params: { id: salvo.id } });
    },
  });

  const conferir = useMutation({
    mutationFn: () => api.salvar<Omit<Importacao, "id"> & { id?: string }>("importacoes", novaImportacao(lido.relatorio, lido.arquivo, destino, lido.consideracoes, lido.previsaoSugerida)),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: chaves.store("importacoes") });
      fechar();
      navigate({ to: "/importacoes/$id", params: { id: salvo.id } });
    },
  });

  const ocupado = criar.isPending || conferir.isPending;

  return (
    <>
      <ResumoImportacao
        arquivo={lido.arquivo}
        relatorio={lido.relatorio}
        demonstrativo={demonstrativo}
        coluna={coluna}
        aoMudarColuna={setColuna}
        destino={destino}
        consideracoes={lido.consideracoes}
        previsaoSugerida={lido.previsaoSugerida}
      />
      {condo ? (
        <div className="grid gap-3 rounded-md border p-3 text-sm">
          <p>
            Condomínio cadastrado: <span className="font-medium">{condo.codigo ? `${condo.codigo} · ` : ""}{condo.nome}</span>
          </p>
          {destino === "exercicios" && (
            <Field rotulo="Ano do exercício" obrigatorio className="max-w-[10rem]">
              <InteiroInput value={ano} onChange={setAno} maxLength={4} />
            </Field>
          )}
        </div>
      ) : (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            Nenhum condomínio cadastrado com este código ou CNPJ. Confira o cadastro básico lido do PDF; ao confirmar, o condomínio é criado e o {rotulo} é gravado.
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={fechar} disabled={ocupado}>
          Cancelar
        </Button>
        {condo ? (
          <Button onClick={() => criar.mutate()} disabled={ocupado}>
            {criar.isPending && <Loader2 className="animate-spin" />}
            Criar {rotulo}
          </Button>
        ) : (
          <Button onClick={() => conferir.mutate()} disabled={ocupado}>
            {conferir.isPending && <Loader2 className="animate-spin" />}
            Conferir cadastro
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
