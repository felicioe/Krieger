import { cloneElement, useRef, useState, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, FileUp, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/app/SectionCard";
import { Field, type PropsControle } from "@/components/app/Field";
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

/**
 * Controle + botão auxiliar lado a lado, como filho direto de `Field`: repassa os atributos de
 * acessibilidade que o `Field` injeta (id, aria-describedby etc.) ao controle, não ao wrapper —
 * senão o rótulo e a dica perdem a associação com o campo real.
 */
function ComBotaoLateral({
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  controle,
  botao,
}: PropsControle & { controle: ReactElement<PropsControle>; botao: ReactNode }) {
  return (
    <div className="flex gap-2">
      {cloneElement(controle, { id, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, "aria-required": ariaRequired })}
      {botao}
    </div>
  );
}

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
          novo={() => ({ cargo: "", nome: "", mandatoFim: "", noRelatorio: true })}
          colunas="grid-cols-1 @min-[14rem]:grid-cols-2 @2xl:grid-cols-[10rem_minmax(0,1fr)_8rem_8rem]"
          cabecalhos={["Cargo", "Nome", "Mandato até", "No relatório"]}
          rotuloAdicionar="Adicionar membro"
          render={(m, up) => (
            <>
              <Input aria-label="Cargo" value={m.cargo} onChange={(e) => up({ cargo: e.target.value })} />
              <Input aria-label="Nome" value={m.nome} onChange={(e) => up({ nome: e.target.value })} />
              <MesAnoInput aria-label="Fim do mandato" value={m.mandatoFim ?? ""} onChange={(v) => up({ mandatoFim: v })} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground @2xl:justify-self-center">
                <Switch checked={m.noRelatorio !== false} onCheckedChange={(v) => up({ noRelatorio: v })} aria-label="Incluir no relatório" />
                <span className="@2xl:hidden">Incluir nas Considerações finais</span>
              </label>
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
            novo={() => ({ desc: "", valor: null, noRelatorio: true })}
            colunas="grid-cols-1 @xs:grid-cols-[minmax(0,1fr)_9rem] @2xl:grid-cols-[minmax(0,1fr)_11rem_9rem]"
            cabecalhos={["Cobertura", "Valor", "No relatório"]}
            rotuloAdicionar="Adicionar cobertura"
            vazio="Nenhuma cobertura."
            render={(cb, up) => (
              <>
                <Input aria-label="Cobertura" value={cb.desc} onChange={(e) => up({ desc: e.target.value })} />
                <DinheiroInput aria-label="Valor da cobertura" value={cb.valor} onChange={(v) => up({ valor: v })} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground @2xl:justify-self-center">
                  <Switch checked={cb.noRelatorio !== false} onCheckedChange={(v) => up({ noRelatorio: v })} aria-label="Incluir no relatório" />
                  <span className="@2xl:hidden">Incluir nas Considerações finais</span>
                </label>
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

      <SectionCard titulo="Contas a receber e a pagar">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            rotulo="Contas a receber"
            {...(receberMensais?.valor != null ? { dica: `Relatório de ${receberMensais.mes}: ${formatBRL(receberMensais.valor)}.` } : {})}
          >
            <ComBotaoLateral
              controle={<DinheiroInput value={num(c.contasReceber)} onChange={(v) => set("contasReceber", v)} />}
              botao={
                receberMensais?.valor != null &&
                num(c.contasReceber) !== receberMensais.valor && (
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => set("contasReceber", receberMensais.valor)}>
                    Usar do mensal
                  </Button>
                )
              }
            />
          </Field>
          <Field rotulo="Contas a pagar">
            <DinheiroInput value={num(c.contasPagar)} onChange={(v) => set("contasPagar", v)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        titulo="Consumo de serviços"
        descricao="Calculado automaticamente a partir do demonstrativo, pelas palavras-chave de cada serviço. Ajuste manual é só para exceção."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BlocoConsumoServico
            rotulo="Água"
            placeholder="ex.: água, esgoto"
            rubrica={c.aguaRubrica}
            onRubricaChange={(v) => set("aguaRubrica", v)}
            calculado={agua}
            manual={c.consumoAguaManual ?? null}
            onManualChange={(v) => set("consumoAguaManual", v)}
          />
          <BlocoConsumoServico
            rotulo="Energia elétrica"
            placeholder="ex.: energia, luz"
            rubrica={c.energiaRubrica}
            onRubricaChange={(v) => set("energiaRubrica", v)}
            calculado={energia}
            manual={c.consumoEnergiaManual ?? null}
            onManualChange={(v) => set("consumoEnergiaManual", v)}
          />
          <BlocoConsumoServico
            rotulo="Elevadores"
            placeholder="ex.: elevador, ascensor"
            rubrica={c.elevadorRubrica}
            onRubricaChange={(v) => set("elevadorRubrica", v)}
            calculado={elevador}
            manual={c.consumoElevadorManual ?? null}
            onManualChange={(v) => set("consumoElevadorManual", v)}
          >
            <Field rotulo="Fornecedor" dica="Texto livre, impresso junto da linha Elevadores.">
              <Input value={c.elevadorFornecedor} onChange={(e) => set("elevadorFornecedor", e.target.value)} />
            </Field>
          </BlocoConsumoServico>
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

/**
 * Um serviço de "Consumo de serviços" (água/energia/elevadores): palavra-chave, valor calculado
 * automaticamente em destaque, e o manual como exceção — fechado por padrão, só abre quem já usa.
 */
function BlocoConsumoServico({
  rotulo,
  placeholder,
  rubrica,
  onRubricaChange,
  calculado,
  manual,
  onManualChange,
  children,
}: {
  rotulo: string;
  placeholder: string;
  rubrica: string;
  onRubricaChange: (v: string) => void;
  calculado: ConsumoServico;
  manual: number | null;
  onManualChange: (v: number | null) => void;
  children?: ReactNode;
}) {
  const [manualAberto, setManualAberto] = useState(manual !== null);

  return (
    <div className="min-w-0 rounded-md border p-4">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{rotulo}</h4>
      <CampoRubrica rotulo="Palavras-chave" placeholder={placeholder} value={rubrica} onChange={onRubricaChange} />
      <div className="mt-3 rounded-sm bg-muted/40 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Calculado automaticamente{calculado.manual && " (o relatório usa o valor manual abaixo)"}
        </p>
        <p className="num text-base font-semibold text-foreground">{formatBRL(calculado.automatico.valor)}</p>
        {calculado.automatico.rubricas.length > 0 ? (
          <p className="mt-0.5 break-words text-xs text-muted-foreground">{calculado.automatico.rubricas.join(", ")}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Nenhuma despesa do demonstrativo casa com essas palavras.</p>
        )}
      </div>
      {manualAberto ? (
        <div className="mt-3">
          <Field rotulo="Valor manual (substitui o cálculo acima)">
            <ComBotaoLateral
              controle={<DinheiroInput value={manual} onChange={onManualChange} />}
              botao={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    onManualChange(null);
                    setManualAberto(false);
                  }}
                >
                  Voltar a calcular
                </Button>
              }
            />
          </Field>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setManualAberto(true)}
        >
          Informar valor manual em vez do calculado
        </button>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
