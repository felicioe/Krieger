import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/Field";
import { RepeatableList } from "@/components/app/RepeatableList";
import { DataInput, DinheiroInput } from "@/components/app/inputs";
import { formatBRL } from "@/lib/format";
import { recalcularDemonstrativo } from "@/domain/demonstrativo";
import type { Demonstrativo, LinhaValor } from "@/domain/types";
import { cn } from "@/lib/utils";

function ListaValores({
  itens,
  onChange,
  rotuloNome,
  rotuloAdicionar,
  vazio,
}: {
  itens: LinhaValor[];
  onChange: (v: LinhaValor[]) => void;
  rotuloNome: string;
  rotuloAdicionar: string;
  vazio: string;
}) {
  return (
    <RepeatableList
      itens={itens}
      onChange={onChange}
      novo={() => ({ nome: "", valor: 0 })}
      colunas="grid-cols-[minmax(0,1fr)_9rem] sm:grid-cols-[minmax(0,1fr)_11rem]"
      cabecalhos={[rotuloNome, "Valor"]}
      rotuloAdicionar={rotuloAdicionar}
      vazio={vazio}
      render={(l, up) => (
        <>
          <Input aria-label={rotuloNome} placeholder={rotuloNome} value={l.nome} onChange={(e) => up({ nome: e.target.value })} />
          <DinheiroInput aria-label="Valor" value={l.valor} onChange={(v) => up({ valor: v ?? 0 })} />
        </>
      )}
    />
  );
}

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={cn("mt-3 flex items-center justify-between border-t pt-3 text-sm", destaque && "font-semibold text-primary")}>
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="num font-medium text-foreground">{formatBRL(valor)}</span>
    </div>
  );
}

/**
 * Edição manual de um demonstrativo (prestação de contas anual ou relatório mensal);
 * totais recalculados a cada alteração e aviso quando o saldo não fecha.
 */
export function EditorDemonstrativo({
  valor,
  onChange,
  descricaoDespesas = "Organize as despesas por grupo (Pessoal, Consumo, Manutenção…).",
}: {
  valor: Demonstrativo;
  onChange: (d: Demonstrativo) => void;
  descricaoDespesas?: string;
}) {
  const d = valor;
  const mudar = (parcial: Partial<Demonstrativo>) => onChange(recalcularDemonstrativo({ ...d, ...parcial }));
  const grupos = d.despesas.grupos;
  const mudarGrupos = (g: Demonstrativo["despesas"]["grupos"]) => mudar({ despesas: { ...d.despesas, grupos: g } });

  return (
    <div className="space-y-6">
      <SectionCard titulo="Período" descricao="Intervalo coberto pelo demonstrativo.">
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <Field rotulo="Início">
            <DataInput value={d.periodo.ini} onChange={(v) => mudar({ periodo: { ...d.periodo, ini: v } })} />
          </Field>
          <Field rotulo="Fim">
            <DataInput value={d.periodo.fim} onChange={(v) => mudar({ periodo: { ...d.periodo, fim: v } })} />
          </Field>
        </div>
      </SectionCard>

      <div className="grid gap-6 2xl:grid-cols-2">
        <SectionCard titulo="Saldo anterior">
          <ListaValores
            itens={d.saldoAnterior.contas}
            onChange={(contas) => mudar({ saldoAnterior: { ...d.saldoAnterior, contas } })}
            rotuloNome="Conta"
            rotuloAdicionar="Adicionar conta"
            vazio="Nenhuma conta informada."
          />
          <Total rotulo="Total do saldo anterior" valor={d.saldoAnterior.total} />
        </SectionCard>
        <SectionCard titulo="Saldo atual">
          <ListaValores
            itens={d.saldoAtual.contas}
            onChange={(contas) => mudar({ saldoAtual: { ...d.saldoAtual, contas } })}
            rotuloNome="Conta"
            rotuloAdicionar="Adicionar conta"
            vazio="Nenhuma conta informada."
          />
          <Total rotulo="Total do saldo atual" valor={d.saldoAtual.total} />
        </SectionCard>
      </div>

      <SectionCard titulo="Receitas">
        <ListaValores
          itens={d.receitas.itens}
          onChange={(itens) => mudar({ receitas: { ...d.receitas, itens } })}
          rotuloNome="Receita"
          rotuloAdicionar="Adicionar receita"
          vazio="Nenhuma receita lançada."
        />
        <Total rotulo="Subtotal das receitas" valor={d.receitas.subtotal} />
      </SectionCard>

      <SectionCard
        titulo="Despesas"
        descricao={descricaoDespesas}
        acoes={
          <Button type="button" variant="outline" size="sm" onClick={() => mudarGrupos([...grupos, { nome: "", itens: [] }])}>
            <Plus /> Adicionar grupo
          </Button>
        }
      >
        {grupos.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Nenhum grupo de despesas. Use “Adicionar grupo” para começar.
          </p>
        ) : (
          <div className="space-y-5">
            {grupos.map((g, i) => (
              <div key={i} className="rounded-md border bg-muted/30 p-4">
                <div className="mb-3 flex items-end gap-2">
                  <Field rotulo="Grupo" className="flex-1">
                    <Input
                      value={g.nome}
                      placeholder="Nome do grupo"
                      onChange={(e) => mudarGrupos(grupos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover grupo ${g.nome}`}
                    className="text-destructive hover:text-destructive"
                    onClick={() => mudarGrupos(grupos.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <ListaValores
                  itens={g.itens}
                  onChange={(itens) => mudarGrupos(grupos.map((x, j) => (j === i ? { ...x, itens } : x)))}
                  rotuloNome="Despesa"
                  rotuloAdicionar="Adicionar despesa"
                  vazio="Nenhuma despesa neste grupo."
                />
                <Total rotulo={`Subtotal ${g.nome || "do grupo"}`} valor={g.itens.reduce((s, l) => s + (l.valor || 0), 0)} />
              </div>
            ))}
          </div>
        )}
        <Total rotulo="Total das despesas" valor={d.despesas.subtotal} destaque />
      </SectionCard>

      <SectionCard titulo="Fechamento">
        <dl className="grid gap-2 text-sm sm:max-w-md">
          {[
            ["Saldo anterior", d.totais.saldoAnterior],
            ["(+) Receitas", d.totais.receitas],
            ["(−) Despesas", d.totais.despesas],
            ["(=) Saldo calculado", d.despesas.saldoRestante],
            ["Saldo atual informado", d.totais.saldoAtual],
          ].map(([r, v]) => (
            <div key={r as string} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{r}</dt>
              <dd className="num font-medium">{formatBRL(v as number)}</dd>
            </div>
          ))}
        </dl>
        {d.avisos.length > 0 && (
          <Alert variant="warning" className="mt-4">
            <TriangleAlert />
            <AlertDescription>{d.avisos.join(" ")}</AlertDescription>
          </Alert>
        )}
      </SectionCard>
    </div>
  );
}
