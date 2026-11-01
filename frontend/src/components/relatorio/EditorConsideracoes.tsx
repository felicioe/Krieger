import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, FileUp, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { CampoRubrica } from "@/components/app/CampoRubrica";
import { cn } from "@/lib/utils";
import { DataInput, DinheiroInput, InteiroInput, MesAnoInput } from "@/components/app/inputs";
import { formatBRL } from "@/lib/format";
import { mensagemErro } from "@/lib/api";
import { considDoCondominio } from "@/domain/exercicio";
import { documentosObrigatoriosPadrao } from "@/domain/condominio";
import { lerApoliceSeguro } from "@/domain/pdfParser";
import type { ConsumoServico } from "@/domain/relatorioFinal";
import type { Condominio, Exercicio } from "@/domain/types";

type Consid = Exercicio["consid"];
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** Editor dos dados de `exercicio.consid` usados na seção "Considerações finais". */
export function EditorConsideracoes({
  consid: c,
  onChange,
  condominio,
  receberMensais,
  agua,
  energia,
  elevador,
}: {
  consid: Consid;
  onChange: (c: Consid) => void;
  condominio: Condominio | null;
  /** Posição de contas a receber do último relatório mensal do período, se houver. */
  receberMensais: { mes: string; valor: number | null } | null;
  agua: ConsumoServico;
  energia: ConsumoServico;
  elevador: ConsumoServico;
}) {
  const [confirmarRecarga, setConfirmarRecarga] = useState(false);
  const set = <K extends keyof Consid>(k: K, v: Consid[K]) => onChange({ ...c, [k]: v });

  // A importação da apólice é assíncrona (lê o PDF, pode levar um instante); se o usuário editar
  // outro campo nesse meio-tempo, `c` do fechamento fica desatualizado — o ref sempre aponta pro
  // estado mais recente, pra aplicar o resultado do PDF por cima dele, não por cima do antigo.
  const cRef = useRef(c);
  cRef.current = c;

  const entradaApolice = useRef<HTMLInputElement>(null);
  const [importandoApolice, setImportandoApolice] = useState(false);

  async function importarApolice(arquivo: File | undefined) {
    if (!arquivo) return;
    setImportandoApolice(true);
    try {
      const { extrairTextoPdf } = await import("@/lib/pdfTexto");
      const texto = await extrairTextoPdf(arquivo);
      const lido = lerApoliceSeguro(texto);
      if (!lido) {
        toast.error("PDF não reconhecido como apólice de seguro (layout Allianz). Preencha os campos manualmente.");
        return;
      }
      const atual = cRef.current;
      onChange({
        ...atual,
        seguradora: lido.seguradora ?? atual.seguradora,
        vigenciaSeguro: lido.vigenciaFim ?? atual.vigenciaSeguro,
        seguro: {
          riscoAbsoluto: lido.riscoAbsoluto ?? atual.seguro.riscoAbsoluto,
          coberturas: lido.coberturas,
        },
      });
      toast.success(`Apólice importada: ${lido.coberturas.length} coberturas, vigência até ${lido.vigenciaFim}. Revise e salve.`);
    } catch (e) {
      toast.error(e instanceof Error && /password|Invalid PDF/i.test(e.message) ? "Não foi possível abrir o PDF (arquivo protegido ou inválido)." : mensagemErro(e));
    } finally {
      setImportandoApolice(false);
      if (entradaApolice.current) entradaApolice.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {condominio && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmarRecarga(true)}>
            <RefreshCw /> Recarregar do cadastro do condomínio
          </Button>
        </div>
      )}

      <SectionCard titulo="Administração">
        <RepeatableList
          itens={c.administracao}
          onChange={(v) => set("administracao", v)}
          novo={() => ({ cargo: "", nome: "", mandatoFim: "" })}
          colunas="grid-cols-1 @min-[14rem]:grid-cols-2 @2xl:grid-cols-[10rem_minmax(0,1fr)_8rem]"
          cabecalhos={["Cargo", "Nome", "Mandato até"]}
          rotuloAdicionar="Adicionar membro"
          render={(m, up) => (
            <>
              <Input aria-label="Cargo" value={m.cargo} onChange={(e) => up({ cargo: e.target.value })} />
              <Input aria-label="Nome" value={m.nome} onChange={(e) => up({ nome: e.target.value })} />
              <MesAnoInput aria-label="Fim do mandato" value={m.mandatoFim ?? ""} onChange={(v) => up({ mandatoFim: v })} />
            </>
          )}
        />
      </SectionCard>

      <SectionCard
        titulo="Seguro"
        descricao="Preencha manualmente ou importe o PDF da apólice (layout Allianz)."
        acoes={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => entradaApolice.current?.click()} disabled={importandoApolice}>
              {importandoApolice ? <Loader2 className="animate-spin" /> : <FileUp />}
              Importar apólice (PDF)
            </Button>
            <input
              ref={entradaApolice}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Arquivo PDF da apólice de seguro"
              onChange={(e) => importarApolice(e.target.files?.[0])}
            />
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field rotulo="Seguradora">
            <Input value={c.seguradora} onChange={(e) => set("seguradora", e.target.value)} />
          </Field>
          <Field rotulo="Vigência até">
            <DataInput value={c.vigenciaSeguro} onChange={(v) => set("vigenciaSeguro", v)} />
          </Field>
          <Field rotulo="Risco absoluto">
            <DinheiroInput value={c.seguro.riscoAbsoluto} onChange={(v) => set("seguro", { ...c.seguro, riscoAbsoluto: v })} />
          </Field>
        </div>
        <div className="mt-4">
          <RepeatableList
            itens={c.seguro.coberturas}
            onChange={(v) => set("seguro", { ...c.seguro, coberturas: v })}
            novo={() => ({ desc: "", valor: null })}
            colunas="grid-cols-1 @xs:grid-cols-[minmax(0,1fr)_9rem] @2xl:grid-cols-[minmax(0,1fr)_11rem]"
            cabecalhos={["Cobertura", "Valor"]}
            rotuloAdicionar="Adicionar cobertura"
            vazio="Nenhuma cobertura."
            render={(cb, up) => (
              <>
                <Input aria-label="Cobertura" value={cb.desc} onChange={(e) => up({ desc: e.target.value })} />
                <DinheiroInput aria-label="Valor da cobertura" value={cb.valor} onChange={(v) => up({ valor: v })} />
              </>
            )}
          />
        </div>
      </SectionCard>

      <SectionCard titulo="Manutenções e vistorias">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field rotulo="Recarga dos extintores até">
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
          <Field rotulo="Ano da vistoria técnica">
            <InteiroInput value={c.vistoriaAno} onChange={(v) => set("vistoriaAno", v)} maxLength={4} />
          </Field>
          <Field rotulo="Intervalo (anos)">
            <InteiroInput value={c.vistoriaIntervalo} onChange={(v) => set("vistoriaIntervalo", v ?? 0)} />
          </Field>
          <Field rotulo="Lei da vistoria" className="sm:col-span-2">
            <Input value={c.vistoriaLei} onChange={(e) => set("vistoriaLei", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        titulo="Documentos obrigatórios"
        descricao="Lista independente dos campos de Manutenções e vistorias — status marcado manualmente, sem data calculada."
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
                className={cn(
                  "justify-center gap-1.5",
                  d.status === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                    : "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
                )}
                onClick={() => up({ status: d.status === "ok" ? "pendente" : "ok" })}
              >
                {d.status === "ok" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                {d.status === "ok" ? "Em dia" : "Pendente"}
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
              <Textarea
                aria-label="Observação"
                placeholder="opcional"
                rows={1}
                className="col-span-2 @2xl:col-span-1"
                value={d.observacao}
                onChange={(e) => up({ observacao: e.target.value })}
              />
            </>
          )}
        />
        {c.documentosObrigatorios.length === 0 && (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => set("documentosObrigatorios", documentosObrigatoriosPadrao())}>
            Usar checklist padrão
          </Button>
        )}
      </SectionCard>

      <SectionCard titulo="Valores">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            rotulo="Contas a receber"
            {...(receberMensais?.valor != null ? { dica: `Relatório de ${receberMensais.mes}: ${formatBRL(receberMensais.valor)}.` } : {})}
          >
            <DinheiroInput value={num(c.contasReceber)} onChange={(v) => set("contasReceber", v)} />
          </Field>
          <div className="flex items-end pb-0.5">
            {receberMensais?.valor != null && num(c.contasReceber) !== receberMensais.valor && (
              <Button type="button" variant="outline" size="sm" onClick={() => set("contasReceber", receberMensais.valor)}>
                Usar valor do relatório mensal
              </Button>
            )}
          </div>
          <Field rotulo="Contas a pagar">
            <DinheiroInput value={num(c.contasPagar)} onChange={(v) => set("contasPagar", v)} />
          </Field>
          <div />
          <CampoRubrica
            rotulo="Palavras-chave de água"
            dica="Despesas do demonstrativo com uma dessas palavras no nome."
            value={c.aguaRubrica}
            onChange={(v) => set("aguaRubrica", v)}
          />
          <Field
            rotulo="Consumo de água (manual)"
            dica={
              agua.manual
                ? "Valor manual em uso. Apague para calcular pelo demonstrativo."
                : agua.rubricas.length
                  ? `Calculado: ${formatBRL(agua.valor)} (${agua.rubricas.join(", ")}).`
                  : "Nenhuma despesa do demonstrativo casa com a rubrica de água."
            }
          >
            <DinheiroInput value={c.consumoAguaManual ?? null} onChange={(v) => set("consumoAguaManual", v)} />
          </Field>
          <div />
          <CampoRubrica
            rotulo="Palavras-chave de energia elétrica"
            dica="Mesmo mecanismo da água, para a seção Consumo de serviços."
            placeholder="ex.: energia, luz"
            value={c.energiaRubrica}
            onChange={(v) => set("energiaRubrica", v)}
          />
          <Field
            rotulo="Consumo de energia (manual)"
            dica={
              energia.manual
                ? "Valor manual em uso. Apague para calcular pelo demonstrativo."
                : energia.rubricas.length
                  ? `Calculado: ${formatBRL(energia.valor)} (${energia.rubricas.join(", ")}).`
                  : "Nenhuma despesa do demonstrativo casa com a rubrica de energia."
            }
          >
            <DinheiroInput value={c.consumoEnergiaManual ?? null} onChange={(v) => set("consumoEnergiaManual", v)} />
          </Field>
          <div />
          <CampoRubrica
            rotulo="Palavras-chave de elevadores"
            dica="Mesmo mecanismo da água, para a seção Consumo de serviços."
            placeholder="ex.: elevador, ascensor"
            value={c.elevadorRubrica}
            onChange={(v) => set("elevadorRubrica", v)}
          />
          <Field
            rotulo="Consumo de elevadores (manual)"
            dica={
              elevador.manual
                ? "Valor manual em uso. Apague para calcular pelo demonstrativo."
                : elevador.rubricas.length
                  ? `Calculado: ${formatBRL(elevador.valor)} (${elevador.rubricas.join(", ")}).`
                  : "Nenhuma despesa do demonstrativo casa com a rubrica de elevadores."
            }
          >
            <DinheiroInput value={c.consumoElevadorManual ?? null} onChange={(v) => set("consumoElevadorManual", v)} />
          </Field>
          <Field rotulo="Fornecedor dos elevadores" dica="Texto livre, impresso junto da linha Elevadores.">
            <Input value={c.elevadorFornecedor} onChange={(e) => set("elevadorFornecedor", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard titulo="Outras considerações" descricao="Texto livre. Cada linha vira um parágrafo, com o título em destaque (opcional).">
        <RepeatableList
          itens={c.extras.map((x) => ({ rotulo: String(x.rotulo ?? ""), valor: String(x.valor ?? "") }))}
          onChange={(v) => set("extras", v)}
          novo={() => ({ rotulo: "", valor: "" })}
          colunas="grid-cols-1 @2xl:grid-cols-[12rem_minmax(0,1fr)]"
          cabecalhos={["Título", "Texto"]}
          rotuloAdicionar="Adicionar consideração"
          vazio="Nenhuma consideração adicional."
          render={(x, up) => (
            <>
              <Input aria-label="Título da consideração" value={x.rotulo} onChange={(e) => up({ rotulo: e.target.value })} />
              <Textarea aria-label="Texto da consideração" value={x.valor} onChange={(e) => up({ valor: e.target.value })} rows={2} />
            </>
          )}
        />
      </SectionCard>

      <ConfirmDialog
        aberto={confirmarRecarga}
        aoMudar={setConfirmarRecarga}
        titulo="Recarregar do cadastro do condomínio?"
        descricao="Administração, seguro, manutenções, vistoria, documentos obrigatórios, rubricas de água/energia/elevadores e índices voltam a ser os do cadastro. Contas a receber/pagar, consumos manuais e as outras considerações são mantidos."
        rotuloConfirmar="Recarregar"
        aoConfirmar={() => {
          if (!condominio) return;
          const base = considDoCondominio(condominio);
          onChange({
            ...base,
            contasReceber: c.contasReceber,
            contasPagar: c.contasPagar,
            consumoAguaManual: c.consumoAguaManual ?? null,
            consumoEnergiaManual: c.consumoEnergiaManual ?? null,
            consumoElevadorManual: c.consumoElevadorManual ?? null,
            extras: c.extras,
          });
        }}
      />
    </div>
  );
}
