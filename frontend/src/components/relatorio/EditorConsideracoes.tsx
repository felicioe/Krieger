import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DataInput, DinheiroInput, InteiroInput, MesAnoInput } from "@/components/app/inputs";
import { formatBRL } from "@/lib/format";
import { considDoCondominio } from "@/domain/exercicio";
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
}: {
  consid: Consid;
  onChange: (c: Consid) => void;
  condominio: Condominio | null;
  /** Posição de contas a receber do último relatório mensal do período, se houver. */
  receberMensais: { mes: string; valor: number | null } | null;
  agua: { valor: number; manual: boolean; rubricas: string[] };
}) {
  const [confirmarRecarga, setConfirmarRecarga] = useState(false);
  const set = <K extends keyof Consid>(k: K, v: Consid[K]) => onChange({ ...c, [k]: v });

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

      <SectionCard titulo="Seguro">
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
          <Field rotulo="Rubrica de água" dica="Expressão que identifica a despesa de água no demonstrativo.">
            <Input value={c.aguaRubrica} onChange={(e) => set("aguaRubrica", e.target.value)} className="font-mono text-xs" />
          </Field>
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
        descricao="Administração, seguro, manutenções, vistoria, rubrica de água e índices voltam a ser os do cadastro. Contas a receber/pagar, consumo manual e as outras considerações são mantidos."
        rotuloConfirmar="Recarregar"
        aoConfirmar={() => {
          if (!condominio) return;
          const base = considDoCondominio(condominio);
          onChange({
            ...base,
            contasReceber: c.contasReceber,
            contasPagar: c.contasPagar,
            consumoAguaManual: c.consumoAguaManual ?? null,
            extras: c.extras,
          });
        }}
      />
    </div>
  );
}
